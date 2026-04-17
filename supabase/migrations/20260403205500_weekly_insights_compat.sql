-- ==========================================================================
-- Weekly insights compatibility
-- ==========================================================================
-- The app and edge functions now expect a canonical `weekly_insights` table.
-- Some live environments still have the older `insights` table shape.
-- This migration creates the canonical table and backfills from the legacy
-- table when needed so the product flow and notification wiring stay aligned.

create table if not exists public.weekly_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_of date not null,
  insight text not null,
  experiment text,
  experiment_done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, week_of)
);

create index if not exists idx_weekly_insights_user_week
  on public.weekly_insights (user_id, week_of desc);

alter table public.weekly_insights enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_insights'
      and policyname = 'Users can view own weekly insights'
  ) then
    create policy "Users can view own weekly insights"
      on public.weekly_insights for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_insights'
      and policyname = 'Users can update own weekly insights'
  ) then
    create policy "Users can update own weekly insights"
      on public.weekly_insights for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_insights'
      and policyname = 'Service role can manage weekly insights'
  ) then
    create policy "Service role can manage weekly insights"
      on public.weekly_insights for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if to_regclass('public.insights') is not null then
    insert into public.weekly_insights (user_id, week_of, insight, experiment, experiment_done, created_at)
    select
      i.user_id,
      i.week_of,
      i.insight_text,
      i.experiment,
      false,
      i.created_at
    from public.insights i
    on conflict (user_id, week_of) do update
    set
      insight = excluded.insight,
      experiment = excluded.experiment,
      created_at = excluded.created_at;
  end if;
end $$;
