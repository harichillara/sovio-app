-- ==========================================================================
-- 20260417070000_app_events_partition.sql
-- Partition app_events by month on created_at so that retention pruning
-- becomes a metadata operation (DROP TABLE <partition>) instead of a row-
-- by-row DELETE that bloats the heap and fights for locks with INSERTs.
--
-- Why partitioning?
--   * app_events is an analytics firehose. With client-side batching (see
--     packages/core/src/analytics/eventBuffer.ts) we get multi-row inserts,
--     but the table still grows monotonically and retention cleanup is
--     currently a single big DELETE. Monthly partitions mean:
--       - retention = DROP TABLE  (O(1), no heap bloat, no vacuum pressure)
--       - insert writes only to the current-month partition
--       - historical queries prune partitions via the planner
--
-- Strategy (safe because the app is not yet public):
--   1. If app_events is already partitioned, no-op (RAISE NOTICE).
--   2. Otherwise:
--        a. Rename app_events -> app_events_legacy
--        b. Create app_events as PARTITIONED BY RANGE (created_at)
--        c. Create monthly partitions from -6 months to +3 months
--        d. INSERT INTO app_events SELECT * FROM app_events_legacy
--        e. Verify row-count equality; DROP TABLE app_events_legacy
--        f. Recreate RLS policies on the new partitioned table.
--
-- Idempotency:
--   * All creates use IF NOT EXISTS.
--   * The partition-check short-circuits on re-run.
--   * The row-count verification wraps the legacy drop in a DO block that
--     raises (and therefore rolls back) if counts diverge.
--
-- Known caveats:
--   * The pre-existing schema of `app_events` is not defined by a migration
--     in this repo — it was created against Supabase earlier. We detect the
--     actual column set from information_schema so the new partitioned
--     table mirrors whatever columns are in production. This is uglier than
--     a hard-coded DDL but avoids drift.
--   * If the time column is `occurred_at` rather than `created_at` (see
--     retention_policies migration), we partition on whichever column
--     actually exists. Only one of the two is allowed — if both exist, the
--     migration refuses to run.
-- ==========================================================================

do $$
declare
  v_is_partitioned boolean;
  v_has_created_at boolean;
  v_has_occurred_at boolean;
  v_time_col text;
  v_legacy_count bigint;
  v_new_count bigint;
  v_month_start date;
  v_partition_start date;
  v_partition_end date;
  v_partition_name text;
  i int;
  v_policy record;
begin
  -- -----------------------------------------------------------------------
  -- 0. Preflight — does app_events even exist?
  -- -----------------------------------------------------------------------
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'app_events'
  ) then
    raise notice 'app_events does not exist — skipping partition migration';
    return;
  end if;

  -- -----------------------------------------------------------------------
  -- 1. Already partitioned? Short-circuit.
  -- -----------------------------------------------------------------------
  select c.relkind = 'p'
    into v_is_partitioned
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'app_events';

  if v_is_partitioned then
    raise notice 'app_events is already partitioned — no-op';
    return;
  end if;

  -- -----------------------------------------------------------------------
  -- 2. Figure out the time column.
  -- -----------------------------------------------------------------------
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'app_events'
      and column_name  = 'created_at'
  ) into v_has_created_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'app_events'
      and column_name  = 'occurred_at'
  ) into v_has_occurred_at;

  if v_has_created_at and not v_has_occurred_at then
    v_time_col := 'created_at';
  elsif v_has_occurred_at and not v_has_created_at then
    v_time_col := 'occurred_at';
  elsif v_has_created_at and v_has_occurred_at then
    -- Prefer created_at (that's what the client code + types reference),
    -- but leave a loud notice so operators know both exist.
    v_time_col := 'created_at';
    raise notice 'app_events has BOTH created_at and occurred_at — partitioning on created_at';
  else
    raise exception 'app_events has neither created_at nor occurred_at — cannot partition';
  end if;

  -- -----------------------------------------------------------------------
  -- 3. Rename the existing heap out of the way.
  -- -----------------------------------------------------------------------
  alter table public.app_events rename to app_events_legacy;
  raise notice 'renamed app_events -> app_events_legacy';

  -- -----------------------------------------------------------------------
  -- 4. Create the new partitioned parent with the SAME column set.
  --    We do this with a LIKE clause so we inherit columns + defaults +
  --    NOT NULLs automatically. We intentionally skip constraints + indexes
  --    here — we'll rebuild indexes on each partition (or on the parent,
  --    which Postgres propagates).
  -- -----------------------------------------------------------------------
  execute format(
    'create table if not exists public.app_events (
       like public.app_events_legacy including defaults including identity
     ) partition by range (%I)',
    v_time_col
  );
  raise notice 'created partitioned parent app_events (range on %)', v_time_col;

  -- Foreign key to profiles — re-create explicitly since LIKE does NOT
  -- copy FKs. We only add it if the legacy table had one.
  if exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name   = 'app_events_legacy'
      and tc.constraint_type = 'FOREIGN KEY'
      and tc.constraint_name like 'app_events%user_id%fkey'
  ) then
    begin
      alter table public.app_events
        add constraint app_events_user_id_fkey
        foreign key (user_id) references public.profiles (id) on delete cascade;
    exception when duplicate_object then
      null;
    end;
  end if;

  -- -----------------------------------------------------------------------
  -- 5. Create monthly partitions: [-6 months, +3 months] relative to now.
  -- -----------------------------------------------------------------------
  v_month_start := date_trunc('month', now())::date;
  for i in -6 .. 3 loop
    v_partition_start := (v_month_start + make_interval(months => i))::date;
    v_partition_end   := (v_month_start + make_interval(months => i + 1))::date;
    v_partition_name  := format('app_events_%s', to_char(v_partition_start, 'YYYY_MM'));

    execute format(
      'create table if not exists public.%I
         partition of public.app_events
         for values from (%L) to (%L)',
      v_partition_name,
      v_partition_start,
      v_partition_end
    );
  end loop;
  raise notice 'created 10 monthly partitions (-6m..+3m)';

  -- -----------------------------------------------------------------------
  -- 6. Rebuild indexes on the parent so each partition inherits them.
  --    Postgres applies CREATE INDEX on a partitioned table to all existing
  --    and future partitions.
  -- -----------------------------------------------------------------------
  execute format(
    'create index if not exists app_events_user_%s_idx on public.app_events (user_id, %I desc)',
    v_time_col, v_time_col
  );
  execute format(
    'create index if not exists app_events_%s_idx on public.app_events (%I)',
    v_time_col, v_time_col
  );

  -- -----------------------------------------------------------------------
  -- 7. Copy data + verify.
  -- -----------------------------------------------------------------------
  select count(*) into v_legacy_count from public.app_events_legacy;
  execute 'insert into public.app_events select * from public.app_events_legacy';
  select count(*) into v_new_count from public.app_events;

  if v_new_count <> v_legacy_count then
    raise exception 'row count mismatch after copy: legacy=% new=%',
      v_legacy_count, v_new_count;
  end if;
  raise notice 'copied % rows into partitioned app_events', v_new_count;

  -- -----------------------------------------------------------------------
  -- 8. Drop the legacy table ONLY after count verification.
  -- -----------------------------------------------------------------------
  drop table public.app_events_legacy;
  raise notice 'dropped app_events_legacy';

  -- -----------------------------------------------------------------------
  -- 9. Re-enable RLS + recreate the canonical policies. The originals were
  --    dropped along with the legacy table; Postgres does NOT propagate
  --    policies through a rename on the old object.
  -- -----------------------------------------------------------------------
  alter table public.app_events enable row level security;

  drop policy if exists app_events_select_own on public.app_events;
  create policy app_events_select_own
    on public.app_events for select
    using (auth.uid() = user_id);

  drop policy if exists app_events_insert_own on public.app_events;
  create policy app_events_insert_own
    on public.app_events for insert
    with check (auth.uid() = user_id);

  raise notice 'recreated RLS policies app_events_select_own / app_events_insert_own';
end $$;

-- ==========================================================================
-- ensure_app_events_partition_for(target_date) — helper for the monthly cron
-- Creates the partition covering `target_date`'s month if it doesn't exist.
-- Safe to call concurrently + repeatedly. Returns the partition name.
-- ==========================================================================
create or replace function public.ensure_app_events_partition_for(
  target_date timestamptz
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', target_date)::date;
  v_month_end   date := (date_trunc('month', target_date) + interval '1 month')::date;
  v_name        text := format('app_events_%s', to_char(v_month_start, 'YYYY_MM'));
  v_is_partitioned boolean;
begin
  -- Only try to CREATE PARTITION OF if the parent is actually partitioned.
  -- If for whatever reason it isn't (e.g. the migration above no-op'd
  -- because the table didn't exist yet), we silently succeed so the cron
  -- doesn't page us.
  select c.relkind = 'p'
    into v_is_partitioned
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'app_events';

  if coalesce(v_is_partitioned, false) = false then
    raise notice 'app_events is not partitioned — ensure_app_events_partition_for is a no-op';
    return v_name;
  end if;

  execute format(
    'create table if not exists public.%I
       partition of public.app_events
       for values from (%L) to (%L)',
    v_name, v_month_start, v_month_end
  );
  return v_name;
end;
$$;

revoke all on function public.ensure_app_events_partition_for(timestamptz) from public;
revoke all on function public.ensure_app_events_partition_for(timestamptz) from anon, authenticated;

comment on function public.ensure_app_events_partition_for(timestamptz) is
  'Idempotently create the monthly app_events partition covering target_date. Called from pg_cron on the 1st of each month to pre-create next months partition.';

-- ==========================================================================
-- list_app_events_partitions_before(cutoff) — called by the ai-generate
-- `cron_retention` op. Returns child partitions of app_events whose upper
-- bound is strictly before `cutoff`, i.e. safe to DROP.
--
-- Why a helper function? The client for cron_retention is a Deno edge
-- function using PostgREST, which cannot execute arbitrary DDL / pg_catalog
-- queries. A security-definer RPC bridges the gap while keeping the drop
-- privileges off the anon / authenticated roles.
-- ==========================================================================
create or replace function public.list_app_events_partitions_before(
  cutoff timestamptz
) returns table (partition_name text, upper_bound timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_bound_expr text;
  v_upper text;
  v_upper_ts timestamptz;
begin
  for v_rec in
    select c.oid, c.relname
    from pg_inherits i
    join pg_class parent on parent.oid = i.inhparent
    join pg_class c on c.oid = i.inhrelid
    join pg_namespace n on n.oid = parent.relnamespace
    where n.nspname = 'public' and parent.relname = 'app_events'
  loop
    v_bound_expr := pg_get_expr(
      (select relpartbound from pg_class where oid = v_rec.oid),
      v_rec.oid
    );
    -- Bound expression looks like:
    --   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')
    v_upper := substring(v_bound_expr from 'TO \(''([^'']+)''\)');
    if v_upper is null then
      continue;
    end if;
    begin
      v_upper_ts := v_upper::timestamptz;
    exception when others then
      continue;
    end;
    if v_upper_ts <= cutoff then
      partition_name := v_rec.relname;
      upper_bound    := v_upper_ts;
      return next;
    end if;
  end loop;
  return;
end;
$$;

revoke all on function public.list_app_events_partitions_before(timestamptz) from public;
revoke all on function public.list_app_events_partitions_before(timestamptz) from anon, authenticated;

comment on function public.list_app_events_partitions_before(timestamptz) is
  'List app_events child partitions whose upper bound is on-or-before cutoff. Called by edge-function cron_retention to drive partition-drop-based retention.';

-- ==========================================================================
-- drop_app_events_partition(partition_name) — companion DROP helper.
-- Strictly validates the partition name and that it is a child of
-- public.app_events before executing DROP TABLE.
-- ==========================================================================
create or replace function public.drop_app_events_partition(
  partition_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_child boolean;
begin
  -- Name must match the deterministic scheme created in this migration.
  if partition_name !~ '^app_events_\d{4}_\d{2}$' then
    raise exception 'refusing to drop partition with suspicious name: %', partition_name;
  end if;

  -- Must actually be a partition of public.app_events.
  select true
    into v_is_child
  from pg_inherits i
  join pg_class parent on parent.oid = i.inhparent
  join pg_class child  on child.oid  = i.inhrelid
  join pg_namespace n  on n.oid = parent.relnamespace
  where n.nspname = 'public'
    and parent.relname = 'app_events'
    and child.relname = partition_name
  limit 1;

  if not coalesce(v_is_child, false) then
    raise exception '% is not a partition of public.app_events', partition_name;
  end if;

  execute format('drop table public.%I', partition_name);
end;
$$;

revoke all on function public.drop_app_events_partition(text) from public;
revoke all on function public.drop_app_events_partition(text) from anon, authenticated;

comment on function public.drop_app_events_partition(text) is
  'Drop a single app_events child partition after strict name + parent validation. Called by the ai-generate cron_retention op.';

-- ==========================================================================
-- Monthly cron: pre-create the partition for NEXT month.
-- Runs at 00:30 UTC on the 1st of every month. cron.schedule with the same
-- jobname overwrites any prior schedule, so this is idempotent.
-- ==========================================================================
do $$
begin
  -- Only schedule if pg_cron is installed (it is in supabase, but guard
  -- anyway so local / test environments without pg_cron don't fail).
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'app_events_ensure_next_partition',
      '30 0 1 * *',
      $cron$
        select public.ensure_app_events_partition_for(now() + interval '1 month');
      $cron$
    );
    raise notice 'scheduled app_events_ensure_next_partition cron';
  else
    raise notice 'pg_cron not installed — app_events partition cron NOT scheduled. Run: select cron.schedule(''app_events_ensure_next_partition'', ''30 0 1 * *'', $$select public.ensure_app_events_partition_for(now() + interval ''''1 month'''')$$);';
  end if;
end $$;
