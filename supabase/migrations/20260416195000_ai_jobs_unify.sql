-- ==========================================================================
-- ai_jobs unification (Phase 3, pre-Task 15 reconcile)
-- ==========================================================================
-- Schema drift audit against live DB (kfqjapikievrgmszrimw) surfaced three
-- issues before Task 15 (queue promotion) could apply:
--
--   1. Columns in live DB are `input` / `output`, but the TS types and some
--      code paths reference `payload` / `result`. Callers writing to the
--      latter fail at runtime.
--   2. `ai_jobs` is already in active use for *autopilot proposals* with a
--      user-facing approve/reject workflow (status in 'done','approved',
--      'rejected'). The Task 15 queue semantics (status in 'queued',
--      'claimed', 'succeeded', 'failed', 'dlq') would collide.
--   3. A broken INSERT in ai-generate referencing `result` was silently
--      dead until now.
--
-- This migration reconciles the table so both use cases can coexist under a
-- single `ai_jobs` table, keyed by a new `kind` discriminator column.
--
-- Design:
--   * Rename input→payload and output→result so storage matches the type
--     system and the natural semantic. Safe: the live table had 0 rows at
--     audit time and nothing writes to the old names in code paths that
--     actually execute.
--   * Add `kind` ('autopilot' | 'queue'). No default — callers must be
--     explicit. Existing code gets a backfill on any rows present (0 today).
--   * Merge status vocab into one CHECK that's valid for BOTH kinds, scoped
--     by a predicate so autopilot statuses can't appear on queue rows and
--     vice versa. One table, two non-overlapping state machines.
--
-- Follow-up work (spawned as separate tasks, not in this migration):
--   * Regenerate database.types.ts against the post-unify schema.
--   * Audit autopilot.service.ts approve/reject paths — they UPDATE from the
--     client but ai_jobs has no UPDATE RLS policy, so those paths may be
--     silently broken. Separate reliability investigation.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Column renames (storage ↔ semantic alignment)
-- --------------------------------------------------------------------------
-- `alter table rename column` is idempotent only via the "information_schema
-- check first" pattern. We wrap each rename in a DO block that no-ops if the
-- target name already exists — lets the migration re-apply cleanly.

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'ai_jobs'
       and column_name  = 'input'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'ai_jobs'
       and column_name  = 'payload'
  ) then
    alter table public.ai_jobs rename column input to payload;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'ai_jobs'
       and column_name  = 'output'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'ai_jobs'
       and column_name  = 'result'
  ) then
    alter table public.ai_jobs rename column output to result;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 2. `kind` discriminator
-- --------------------------------------------------------------------------
-- No default: forces callers to be explicit ('autopilot' or 'queue'). For
-- existing rows (only autopilot use cases predate this migration), backfill
-- with 'autopilot' before we add NOT NULL.

alter table public.ai_jobs
  add column if not exists kind text;

update public.ai_jobs
   set kind = 'autopilot'
 where kind is null;

alter table public.ai_jobs
  alter column kind set not null;

alter table public.ai_jobs
  drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs
  add constraint ai_jobs_kind_check
  check (kind in ('autopilot', 'queue'));

-- --------------------------------------------------------------------------
-- 3. Merged status CHECK
-- --------------------------------------------------------------------------
-- One constraint, two state machines. Enforces that only autopilot statuses
-- can appear on kind='autopilot' rows and only queue statuses on
-- kind='queue' rows. Task 15's queue migration will rely on this — it no
-- longer adds its own ai_jobs_status_check.
--
-- Autopilot:  done → approved | rejected    (proposal lifecycle)
-- Queue:      queued → claimed → succeeded | failed → dlq    (job lifecycle)

alter table public.ai_jobs
  drop constraint if exists ai_jobs_status_check;

alter table public.ai_jobs
  add constraint ai_jobs_status_check check (
    (kind = 'autopilot' and status in ('done', 'approved', 'rejected'))
    or
    (kind = 'queue'     and status in ('queued', 'claimed', 'succeeded', 'failed', 'dlq'))
  );

-- --------------------------------------------------------------------------
-- 4. Documentation
-- --------------------------------------------------------------------------

comment on column public.ai_jobs.kind is
  'Discriminator. ''autopilot'' rows are user-facing proposals awaiting approve/reject. ''queue'' rows are background jobs processed by the cron_worker.';
comment on column public.ai_jobs.payload is
  'Input to the job. For autopilot: not used. For queue: the enqueue_ai_job p_payload argument.';
comment on column public.ai_jobs.result is
  'Output of the job. For autopilot: the AI-generated proposal payload. For queue: the handler return value on success.';
