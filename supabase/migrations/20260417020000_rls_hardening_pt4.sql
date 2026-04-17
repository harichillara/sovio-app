-- RLS hardening pt4: lock down SECURITY DEFINER functions.
--
-- Findings from SECURITY DEFINER audit (see .claude/tmp/risky-fns.json):
--   1. get_nearby_available_friends had a NULL-auth.uid() bypass
--      (`if auth.uid() is not null and auth.uid() <> viewer_id then raise`).
--      Anon has auth.uid() = null, so the guard was skipped — anon could
--      pass any viewer_id and read that user's nearby friends + live location.
--   2. notify_insert_and_push was anon-callable. It inserts rows into
--      public.notifications for ANY user_id and fires net.http_post to the
--      edge `notify` endpoint using the stored service_role key — anon-key
--      spam of arbitrary users + push-budget burn.
--   3. apply_beta_pro_access was anon-callable. Body gates on an email
--      match against beta_pro_allowlist, but anon can pass any
--      (target_user_id, target_email) pair. If target_email matches an
--      allowlisted row (only 2 exist today), anon grants Pro to any
--      user_id it chooses.
--   4. handle_new_user, handle_new_profile_entitlements,
--      handle_new_profile_settings lacked SET search_path — flagged by
--      Supabase advisor function_search_path_mutable. Trigger-only use
--      today, but a hostile public.* object could hijack definer-level
--      execution.
--
-- Remediation:
--   * Revoke EXECUTE from anon (and from public, belt-and-suspenders)
--     on all 10 SECURITY DEFINER functions.
--   * Keep EXECUTE on authenticated only for the one user-facing RPC
--     (get_nearby_available_friends).
--   * Rewrite get_nearby_available_friends guard so the bypass path is
--     explicit: service_role JWT OR auth.uid() = viewer_id. No null-uid
--     fallthrough.
--   * Add SET search_path = public, pg_temp to the three missing-config
--     trigger functions.

begin;

------------------------------------------------------------------------------
-- 1. get_nearby_available_friends — fix NULL-auth bypass
------------------------------------------------------------------------------
create or replace function public.get_nearby_available_friends(
  viewer_id uuid,
  center_lat double precision,
  center_lng double precision,
  radius_meters integer default 2500
)
returns table(
  friend_id uuid,
  display_name text,
  avatar_url text,
  lat double precision,
  lng double precision,
  distance_meters integer,
  category text,
  available_until timestamptz,
  confidence_label text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Two legitimate caller shapes:
  --   (a) edge function with service-role JWT (auth.uid() is null, but
  --       role claim = 'service_role')
  --   (b) authenticated user querying their own graph (auth.uid() = viewer_id)
  -- Everything else — including anon (role = 'anon', auth.uid() null) — is
  -- rejected.
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and (auth.uid() is null or auth.uid() <> viewer_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with accepted_friends as (
      select f.friend_id as profile_id
      from public.friendships f
      where f.user_id = viewer_id and f.status = 'accepted'
      union
      select f.user_id as profile_id
      from public.friendships f
      where f.friend_id = viewer_id and f.status = 'accepted'
    ),
    center as (
      select st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography as point
    )
    select
      ma.user_id as friend_id,
      p.display_name,
      p.avatar_url,
      ma.lat,
      ma.lng,
      round(st_distance(ma.geo_point, center.point))::integer as distance_meters,
      ma.category,
      ma.available_until,
      ma.confidence_label
    from public.momentum_availability ma
    join accepted_friends af on af.profile_id = ma.user_id
    join public.profiles p on p.id = ma.user_id
    cross join center
    where ma.available_until > now()
      and ma.geo_point is not null
      and st_dwithin(ma.geo_point, center.point, radius_meters)
    order by distance_meters asc, ma.available_until asc;
end;
$$;

------------------------------------------------------------------------------
-- 2. Add missing SET search_path to trigger functions
------------------------------------------------------------------------------
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.handle_new_profile_entitlements() set search_path = public, pg_temp;
alter function public.handle_new_profile_settings() set search_path = public, pg_temp;

------------------------------------------------------------------------------
-- 3. Revoke EXECUTE from anon + public on all SECURITY DEFINER functions
--    Keep authenticated only on get_nearby_available_friends.
--    service_role and postgres retain EXECUTE by ownership/default.
------------------------------------------------------------------------------

-- User-facing RPC: authenticated keeps execute; revoke anon + public.
revoke all on function public.get_nearby_available_friends(uuid, double precision, double precision, integer) from public;
revoke all on function public.get_nearby_available_friends(uuid, double precision, double precision, integer) from anon;

-- Edge-fn-only RPCs: revoke from anon + authenticated + public.
revoke all on function public.notify_insert_and_push(uuid, text, text, text, jsonb) from public;
revoke all on function public.notify_insert_and_push(uuid, text, text, text, jsonb) from anon;
revoke all on function public.notify_insert_and_push(uuid, text, text, text, jsonb) from authenticated;

-- Trigger-invoked only: revoke from anon + authenticated + public.
revoke all on function public.apply_beta_pro_access(uuid, text) from public;
revoke all on function public.apply_beta_pro_access(uuid, text) from anon;
revoke all on function public.apply_beta_pro_access(uuid, text) from authenticated;

revoke all on function public.handle_beta_pro_allowlist_profile() from public;
revoke all on function public.handle_beta_pro_allowlist_profile() from anon;
revoke all on function public.handle_beta_pro_allowlist_profile() from authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

revoke all on function public.handle_new_profile_entitlements() from public;
revoke all on function public.handle_new_profile_entitlements() from anon;
revoke all on function public.handle_new_profile_entitlements() from authenticated;

revoke all on function public.handle_new_profile_settings() from public;
revoke all on function public.handle_new_profile_settings() from anon;
revoke all on function public.handle_new_profile_settings() from authenticated;

revoke all on function public.trg_notify_new_message() from public;
revoke all on function public.trg_notify_new_message() from anon;
revoke all on function public.trg_notify_new_message() from authenticated;

revoke all on function public.trg_notify_replay_batch() from public;
revoke all on function public.trg_notify_replay_batch() from anon;
revoke all on function public.trg_notify_replay_batch() from authenticated;

revoke all on function public.trg_notify_weekly_insight() from public;
revoke all on function public.trg_notify_weekly_insight() from anon;
revoke all on function public.trg_notify_weekly_insight() from authenticated;

commit;
