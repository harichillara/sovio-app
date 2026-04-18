-- ==========================================================================
-- Sovio Cron Jobs
-- ==========================================================================
-- Jobs 1-4 use pg_net to call the ai-generate Edge Function (need LLM).
-- Jobs 5-6 run pure SQL directly (no AI needed).
--
-- SETUP REQUIRED: Before running this migration, set the app settings in
-- Supabase Dashboard > Project Settings > Database > App Settings, or run:
--
--   ALTER DATABASE postgres SET app.settings.edge_function_url = 'https://kfqjapikievrgmszrimw.supabase.co/functions/v1';
--   ALTER DATABASE postgres SET app.settings.service_role_key = '<your-service-role-key>';
--
-- ==========================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- ---------------------------------------------------------------------------
-- 1. Precompute Suggestions — Hourly
--    Generates Intent Cloud cards for active users who don't have fresh ones.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'precompute_suggestions',
  '0 * * * *',
  $$
  select extensions.http_post(
    'https://kfqjapikievrgmszrimw.supabase.co/functions/v1/ai-generate',
    '{"op": "cron_suggestions"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- ---------------------------------------------------------------------------
-- 2. Compute Presence Score — Daily at 02:00 UTC
-- ---------------------------------------------------------------------------
select cron.schedule(
  'compute_presence',
  '0 2 * * *',
  $$
  select extensions.http_post(
    'https://kfqjapikievrgmszrimw.supabase.co/functions/v1/ai-generate',
    '{"op": "cron_presence"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- ---------------------------------------------------------------------------
-- 3. Compute Reality Replay — Daily at 07:00 UTC
-- ---------------------------------------------------------------------------
select cron.schedule(
  'compute_replay',
  '0 7 * * *',
  $$
  select extensions.http_post(
    'https://kfqjapikievrgmszrimw.supabase.co/functions/v1/ai-generate',
    '{"op": "cron_replay"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- ---------------------------------------------------------------------------
-- 4. Weekly Strategic Insight — Monday at 08:00 UTC
-- ---------------------------------------------------------------------------
select cron.schedule(
  'weekly_insight',
  '0 8 * * 1',
  $$
  select extensions.http_post(
    'https://kfqjapikievrgmszrimw.supabase.co/functions/v1/ai-generate',
    '{"op": "cron_weekly_insight"}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- ---------------------------------------------------------------------------
-- 5. Expire & Cleanup — Every 15 minutes (pure SQL, no Edge Function)
--    Expires stale suggestions + removes expired momentum availability.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'expire_cleanup',
  '*/15 * * * *',
  $$
  -- Expire old suggestions
  update public.suggestions
    set status = 'expired'
    where status = 'new'
      and expires_at < now();

  -- Remove expired momentum availability
  delete from public.momentum_availability
    where available_until < now();
  $$
);

-- ---------------------------------------------------------------------------
-- 6. Retention Purge — Daily at 03:30 UTC (pure SQL, no Edge Function)
--    Deletes app_events older than 90 days.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'retention_purge',
  '30 3 * * *',
  $$
  delete from public.app_events
    where occurred_at < now() - interval '90 days';
  $$
);
