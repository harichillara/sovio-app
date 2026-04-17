-- ==========================================================================
-- Fix hardcoded Edge Function URLs in cron jobs
-- ==========================================================================
-- The original cron_jobs migration hardcoded the Supabase project URL.
-- This migration replaces all four AI-calling cron jobs to use the
-- app.settings.edge_function_url database setting instead, making the
-- jobs portable across environments (staging, production, local).
--
-- PREREQUISITE: Ensure the setting is configured:
--   ALTER DATABASE postgres
--     SET app.settings.edge_function_url = 'https://<project>.supabase.co/functions/v1';
-- ==========================================================================

-- Drop old jobs
select cron.unschedule('precompute_suggestions');
select cron.unschedule('compute_presence');
select cron.unschedule('compute_replay');
select cron.unschedule('weekly_insight');

-- 1. Precompute Suggestions — Hourly
select cron.schedule(
  'precompute_suggestions',
  '0 * * * *',
  $$
  select extensions.http_post(
    current_setting('app.settings.edge_function_url', true) || '/ai-generate',
    '{"op": "cron_suggestions"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- 2. Compute Presence Score — Daily at 02:00 UTC
select cron.schedule(
  'compute_presence',
  '0 2 * * *',
  $$
  select extensions.http_post(
    current_setting('app.settings.edge_function_url', true) || '/ai-generate',
    '{"op": "cron_presence"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- 3. Compute Reality Replay — Daily at 07:00 UTC
select cron.schedule(
  'compute_replay',
  '0 7 * * *',
  $$
  select extensions.http_post(
    current_setting('app.settings.edge_function_url', true) || '/ai-generate',
    '{"op": "cron_replay"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- 4. Weekly Strategic Insight — Monday at 08:00 UTC
select cron.schedule(
  'weekly_insight',
  '0 8 * * 1',
  $$
  select extensions.http_post(
    current_setting('app.settings.edge_function_url', true) || '/ai-generate',
    '{"op": "cron_weekly_insight"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);
