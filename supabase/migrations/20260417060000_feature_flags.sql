-- ==========================================================================
--   feature_flags
--
--   Runtime feature-flag store. Single-project (we are not running a
--   separate staging Supabase project) — scoping is instead done via the
--   optional `user_ids` allowlist: a flag can be globally off but enabled
--   for a specific list of test users.
--
--   Shape:
--     key              — stable machine-readable identifier (snake_case)
--     enabled          — global default. If user_ids is non-null, only
--                        users in that list see the flag as "on"; all
--                        others get `enabled` (typically false).
--     user_ids         — optional allowlist for cohort testing
--     description      — human context for the ops dashboard
--     updated_at       — touched by trigger on any write
--
--   RLS: SELECT is open to authenticated (clients need to resolve flags).
--   Writes are service_role only — flag changes are an ops action.
-- ==========================================================================

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  user_ids uuid[] null,
  description text,
  updated_at timestamptz not null default now()
);

comment on table public.feature_flags is
  'Feature-flag store. Clients resolve flags at login via public.is_flag_enabled(key, user_id). Non-null user_ids restricts the flag to a cohort even when enabled=false globally.';

alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_select_auth on public.feature_flags;
create policy feature_flags_select_auth
  on public.feature_flags for select
  to authenticated
  using (true);

-- No write policies: service_role bypasses RLS for ops writes.

-- Touch trigger for updated_at
create or replace function public.touch_feature_flags_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists feature_flags_touch_updated_at on public.feature_flags;
create trigger feature_flags_touch_updated_at
  before update on public.feature_flags
  for each row
  execute function public.touch_feature_flags_updated_at();

-- Resolver function: returns true iff the flag is enabled for the user.
-- SECURITY DEFINER so clients can call it without needing select on the
-- table (they have it anyway, but this keeps the contract narrow).
create or replace function public.is_flag_enabled(p_key text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when ff.user_ids is not null then p_user_id = any(ff.user_ids)
    else ff.enabled
  end
  from public.feature_flags ff
  where ff.key = p_key;
$$;

comment on function public.is_flag_enabled(text, uuid) is
  'Resolve a feature flag for a user. Returns true iff: (a) user is in the flag''s allowlist, OR (b) allowlist is null and the flag is globally enabled. Returns NULL if the flag key does not exist (callers should treat NULL as "off").';

-- Seed a couple of always-useful flags so ops has examples to copy.
insert into public.feature_flags (key, enabled, description) values
  ('ai_proposals_enabled', true,  'Decision-proposal UI in the autopilot modal'),
  ('weekly_insight_push', true,  'Push-notify users when their weekly insight is ready'),
  ('stripe_live',         false, 'Master switch for Stripe-live billing path')
on conflict (key) do nothing;
