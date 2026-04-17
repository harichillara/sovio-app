-- ==========================================================================
-- Retention policies (Phase 3, Task 20)
-- ==========================================================================
-- Adds age-based purge for the three high-volume / compliance-sensitive
-- tables. Wraps all three DELETEs in a single `security definer` function
-- so the daily cron has one thing to call and we can log counts per table
-- via RAISE NOTICE (pg_cron captures that into cron.job_run_details).
--
-- Retention windows — chosen per-table:
--   app_events  : 90 days  — analytics/telemetry, ephemeral by nature
--   messages    : 365 days — chat history, meaningful to users but
--                            unbounded retention is a GDPR / storage-cost
--                            problem
--   audit_log   : 730 days — 2 years. Long enough for compliance disputes
--                            (Stripe disputes max out ~120 days; auth
--                            incident reviews ~12 months), short enough
--                            to avoid indefinite PII accumulation
--
-- This migration ALSO replaces the broken `retention_purge` cron job.
-- The previous version ran:
--     delete from public.app_events where created_at < now() - interval '90 days'
-- but app_events has no `created_at` column (the time column is
-- `occurred_at`). The job was silently failing on every run. The new cron
-- calls the consolidated function, so it won't drift out of sync with the
-- actual column names on each table. (See spawned task chip: this
-- migration subsumes the standalone retention_purge fix.)
-- ==========================================================================

-- --------------------------------------------------------------------------
-- apply_retention_policies()
-- --------------------------------------------------------------------------
-- security definer lets this function bypass RLS on messages/audit_log.
-- Only the cron job calls it — no grants for anon/authenticated.
create or replace function public.apply_retention_policies()
returns table (
  table_name   text,
  rows_deleted integer,
  cutoff       timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now                timestamptz := now();
  -- Windows expressed as intervals so they're easy to tune in one place.
  v_app_events_max_age interval    := interval '90 days';
  v_messages_max_age   interval    := interval '365 days';
  v_audit_log_max_age  interval    := interval '730 days';

  v_app_events_cutoff  timestamptz := v_now - v_app_events_max_age;
  v_messages_cutoff    timestamptz := v_now - v_messages_max_age;
  v_audit_log_cutoff   timestamptz := v_now - v_audit_log_max_age;

  v_deleted integer;
begin
  -- -----------------------------------------------------------------------
  -- 1. app_events — time column is `occurred_at` (NOT created_at)
  -- -----------------------------------------------------------------------
  delete from public.app_events where occurred_at < v_app_events_cutoff;
  get diagnostics v_deleted = row_count;
  raise notice 'apply_retention_policies: app_events rows_deleted=% cutoff=%', v_deleted, v_app_events_cutoff;
  table_name   := 'app_events';
  rows_deleted := v_deleted;
  cutoff       := v_app_events_cutoff;
  return next;

  -- -----------------------------------------------------------------------
  -- 2. messages — participant chat history
  -- -----------------------------------------------------------------------
  delete from public.messages where created_at < v_messages_cutoff;
  get diagnostics v_deleted = row_count;
  raise notice 'apply_retention_policies: messages rows_deleted=% cutoff=%', v_deleted, v_messages_cutoff;
  table_name   := 'messages';
  rows_deleted := v_deleted;
  cutoff       := v_messages_cutoff;
  return next;

  -- -----------------------------------------------------------------------
  -- 3. audit_log — long retention (compliance window)
  -- -----------------------------------------------------------------------
  delete from public.audit_log where created_at < v_audit_log_cutoff;
  get diagnostics v_deleted = row_count;
  raise notice 'apply_retention_policies: audit_log rows_deleted=% cutoff=%', v_deleted, v_audit_log_cutoff;
  table_name   := 'audit_log';
  rows_deleted := v_deleted;
  cutoff       := v_audit_log_cutoff;
  return next;
end;
$$;

comment on function public.apply_retention_policies() is
  'Age-based purge for app_events (90d on occurred_at), messages (365d), audit_log (730d). Security definer — bypasses RLS. Called daily by cron job retention_purge.';

-- Lock down: service_role and pg_cron run this; nobody else needs to.
revoke all on function public.apply_retention_policies() from public;
revoke all on function public.apply_retention_policies() from anon, authenticated;

-- --------------------------------------------------------------------------
-- Replace the broken cron job
-- --------------------------------------------------------------------------
-- cron.schedule with the same jobname overwrites the existing schedule.
-- Keeping the name `retention_purge` preserves whatever history the
-- operator has been watching in cron.job_run_details.
select cron.schedule(
  'retention_purge',
  '30 3 * * *',
  $cron$
    select public.apply_retention_policies();
  $cron$
);
