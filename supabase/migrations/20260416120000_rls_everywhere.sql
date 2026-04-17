-- ==========================================================================
-- RLS Everywhere — close the PostgREST authorization gap
-- ==========================================================================
-- Supabase exposes PostgREST over the anon key, and both clients use
-- supabase-js directly against these tables, so Postgres RLS is the only
-- authorization boundary. Only a handful of tables had policies before this
-- migration (location_snapshots, intent_candidates SELECT, notifications,
-- weekly_insights). This migration enables RLS on every remaining user-data
-- table and installs the appropriate owner-scoped or participant-scoped
-- policies.
--
-- Conventions used here:
--   * service_role bypasses RLS automatically in Supabase — no explicit
--     service_role policies are written.
--   * Policies are (re)created idempotently via DROP POLICY IF EXISTS /
--     CREATE POLICY so this migration can be re-applied safely.
--   * `enable row level security` without policies is a deliberate
--     deny-by-default (used for audit_log, ai_jobs, entitlements writes, etc.).
--   * Tables already covered by earlier migrations (location_snapshots,
--     intent_candidates, notifications, weekly_insights) are NOT re-policied
--     here — see the REPORT at the bottom of this file.
-- ==========================================================================


-- ============ profiles ============
-- Any authenticated user may read any profile (needed for avatars, thread
-- participant lookups, friend search). Only the owner can update their own
-- row. Inserts happen via the auth trigger (server side); client inserts are
-- blocked. Deletes are blocked for clients (cascade from auth.users handles
-- account deletion).
alter table public.profiles enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ============ user_interests ============
alter table public.user_interests enable row level security;

drop policy if exists user_interests_select_own on public.user_interests;
create policy user_interests_select_own
  on public.user_interests for select
  using (auth.uid() = user_id);

drop policy if exists user_interests_insert_own on public.user_interests;
create policy user_interests_insert_own
  on public.user_interests for insert
  with check (auth.uid() = user_id);

drop policy if exists user_interests_update_own on public.user_interests;
create policy user_interests_update_own
  on public.user_interests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_interests_delete_own on public.user_interests;
create policy user_interests_delete_own
  on public.user_interests for delete
  using (auth.uid() = user_id);


-- ============ user_preferences ============
alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
  on public.user_preferences for select
  using (auth.uid() = user_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_preferences_delete_own on public.user_preferences;
create policy user_preferences_delete_own
  on public.user_preferences for delete
  using (auth.uid() = user_id);


-- ============ plans ============
-- Participant-scoped: visible to the creator and to anyone in plan_participants.
-- Only the creator can create / update / delete the plan itself; participants
-- manage their RSVP via plan_participants.
alter table public.plans enable row level security;

drop policy if exists plans_select_participant on public.plans;
create policy plans_select_participant
  on public.plans for select
  using (
    auth.uid() = creator_id
    or exists (
      select 1 from public.plan_participants pp
      where pp.plan_id = plans.id and pp.user_id = auth.uid()
    )
  );

drop policy if exists plans_insert_creator on public.plans;
create policy plans_insert_creator
  on public.plans for insert
  with check (auth.uid() = creator_id);

drop policy if exists plans_update_creator on public.plans;
create policy plans_update_creator
  on public.plans for update
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop policy if exists plans_delete_creator on public.plans;
create policy plans_delete_creator
  on public.plans for delete
  using (auth.uid() = creator_id);


-- ============ plan_participants ============
-- SELECT: any participant of the plan (or its creator) can see the roster.
-- INSERT: the plan creator adds invitees; a user may insert their own row
-- (self-join for public / invite-code plans is not yet a real flow, but the
-- policy is written narrowly).
-- UPDATE: only the participant themself can change their own RSVP status.
-- DELETE: participant removes self, or creator removes anyone.
alter table public.plan_participants enable row level security;

drop policy if exists plan_participants_select_member on public.plan_participants;
create policy plan_participants_select_member
  on public.plan_participants for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.plans p
      where p.id = plan_participants.plan_id and p.creator_id = auth.uid()
    )
    or exists (
      select 1 from public.plan_participants self
      where self.plan_id = plan_participants.plan_id and self.user_id = auth.uid()
    )
  );

drop policy if exists plan_participants_insert_creator_or_self on public.plan_participants;
create policy plan_participants_insert_creator_or_self
  on public.plan_participants for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.plans p
      where p.id = plan_participants.plan_id and p.creator_id = auth.uid()
    )
  );

drop policy if exists plan_participants_update_self on public.plan_participants;
create policy plan_participants_update_self
  on public.plan_participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists plan_participants_delete_self_or_creator on public.plan_participants;
create policy plan_participants_delete_self_or_creator
  on public.plan_participants for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.plans p
      where p.id = plan_participants.plan_id and p.creator_id = auth.uid()
    )
  );


-- ============ threads ============
-- Participant-scoped. Threads have no creator column, so we gate all access
-- through thread_participants. Client INSERT is permitted (the app creates
-- threads on-demand); the server is expected to follow up with a
-- thread_participants row. No client UPDATE/DELETE — title changes and
-- deletion would need a creator concept that doesn't yet exist in the schema.
alter table public.threads enable row level security;

drop policy if exists threads_select_participant on public.threads;
create policy threads_select_participant
  on public.threads for select
  using (
    exists (
      select 1 from public.thread_participants tp
      where tp.thread_id = threads.id and tp.user_id = auth.uid()
    )
  );

drop policy if exists threads_insert_authenticated on public.threads;
create policy threads_insert_authenticated
  on public.threads for insert
  to authenticated
  with check (true);


-- ============ thread_participants ============
-- SELECT: see your own membership rows and rows for threads you are in
-- (needed so clients can render the participant list in a thread).
-- INSERT: only a current participant of the thread can add another row;
-- a user may add themself only if no participants exist yet (new thread).
-- UPDATE: own row only (used to advance last_read_at).
-- DELETE: own row only (leave thread).
alter table public.thread_participants enable row level security;

drop policy if exists thread_participants_select_member on public.thread_participants;
create policy thread_participants_select_member
  on public.thread_participants for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.thread_participants self
      where self.thread_id = thread_participants.thread_id
        and self.user_id = auth.uid()
    )
  );

drop policy if exists thread_participants_insert_member_or_bootstrap on public.thread_participants;
create policy thread_participants_insert_member_or_bootstrap
  on public.thread_participants for insert
  with check (
    exists (
      select 1 from public.thread_participants self
      where self.thread_id = thread_participants.thread_id
        and self.user_id = auth.uid()
    )
    or (
      auth.uid() = user_id
      and not exists (
        select 1 from public.thread_participants any_row
        where any_row.thread_id = thread_participants.thread_id
      )
    )
  );

drop policy if exists thread_participants_update_own on public.thread_participants;
create policy thread_participants_update_own
  on public.thread_participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists thread_participants_delete_own on public.thread_participants;
create policy thread_participants_delete_own
  on public.thread_participants for delete
  using (auth.uid() = user_id);


-- ============ messages ============
-- Participant-scoped. The sender must be the caller AND a participant of the
-- thread. No client UPDATE/DELETE — edit/delete would need a soft-delete
-- column; today messages are immutable once sent.
alter table public.messages enable row level security;

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant
  on public.messages for select
  using (
    exists (
      select 1 from public.thread_participants tp
      where tp.thread_id = messages.thread_id and tp.user_id = auth.uid()
    )
  );

drop policy if exists messages_insert_participant on public.messages;
create policy messages_insert_participant
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.thread_participants tp
      where tp.thread_id = messages.thread_id and tp.user_id = auth.uid()
    )
  );


-- ============ ai_token_usage ============
-- Read your own usage. Writes are server-side only (ai.service.ts inserts via
-- a server-signed path in production — client-side increment is not trusted).
alter table public.ai_token_usage enable row level security;

drop policy if exists ai_token_usage_select_own on public.ai_token_usage;
create policy ai_token_usage_select_own
  on public.ai_token_usage for select
  using (auth.uid() = user_id);


-- ============ ai_jobs ============
-- Read your own jobs (for the autopilot UI). Job rows are created / updated
-- by the ai-generate Edge Function via service_role.
alter table public.ai_jobs enable row level security;

drop policy if exists ai_jobs_select_own on public.ai_jobs;
create policy ai_jobs_select_own
  on public.ai_jobs for select
  using (auth.uid() = user_id);


-- ============ analytics_events ============
-- Owner-scoped. Clients may write their own events but never read anyone
-- else's. SELECT is still restricted to owner to avoid leaking analytics.
-- Guarded with to_regclass: this table is planned but not yet created in
-- every environment. Skip silently if absent so the migration is
-- reset/restore-safe. When the table lands, the policies are (re)created
-- idempotently by DROP/CREATE POLICY below.
do $$
begin
  if to_regclass('public.analytics_events') is not null then
    execute 'alter table public.analytics_events enable row level security';

    execute 'drop policy if exists analytics_events_select_own on public.analytics_events';
    execute $ddl$create policy analytics_events_select_own
      on public.analytics_events for select
      using (auth.uid() = user_id)$ddl$;

    execute 'drop policy if exists analytics_events_insert_own on public.analytics_events';
    execute $ddl$create policy analytics_events_insert_own
      on public.analytics_events for insert
      with check (auth.uid() = user_id)$ddl$;
  end if;
end $$;


-- ============ app_events ============
-- Owner-scoped audit stream. Clients insert their own events
-- (onboarding, presence breadcrumbs, etc.) and read their own history.
alter table public.app_events enable row level security;

drop policy if exists app_events_select_own on public.app_events;
create policy app_events_select_own
  on public.app_events for select
  using (auth.uid() = user_id);

drop policy if exists app_events_insert_own on public.app_events;
create policy app_events_insert_own
  on public.app_events for insert
  with check (auth.uid() = user_id);


-- ============ audit_log ============
-- Security-sensitive. NO client access at all — RLS is enabled with zero
-- policies, which is deny-by-default. Only service_role (which bypasses RLS)
-- may read / write.
alter table public.audit_log enable row level security;


-- ============ entitlements ============
-- SELECT by owner only so the app can render paywall / pro state. NO client
-- INSERT/UPDATE/DELETE — all writes flow through the Stripe webhook Edge
-- Function running as service_role. (The beta_pro_allowlist trigger also
-- writes via a security-definer function, which bypasses RLS.)
alter table public.entitlements enable row level security;

drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own
  on public.entitlements for select
  using (auth.uid() = user_id);


-- ============ missed_moments ============
-- Read your own replay rows. Writes come from the cron_replay Edge Function
-- (service_role).
alter table public.missed_moments enable row level security;

drop policy if exists missed_moments_select_own on public.missed_moments;
create policy missed_moments_select_own
  on public.missed_moments for select
  using (auth.uid() = user_id);


-- ============ friendships ============
-- Either side of the edge can read / act on the row. INSERT must set the
-- caller as the user_id side (the requester). UPDATE allows accept / block
-- by either side. DELETE is allowed by either side (unfriend).
alter table public.friendships enable row level security;

drop policy if exists friendships_select_endpoint on public.friendships;
create policy friendships_select_endpoint
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists friendships_insert_self on public.friendships;
create policy friendships_insert_self
  on public.friendships for insert
  with check (auth.uid() = user_id);

drop policy if exists friendships_update_endpoint on public.friendships;
create policy friendships_update_endpoint
  on public.friendships for update
  using (auth.uid() = user_id or auth.uid() = friend_id)
  with check (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists friendships_delete_endpoint on public.friendships;
create policy friendships_delete_endpoint
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);


-- ============ momentum_availability ============
-- Clients manage their own availability row. SELECT is intentionally broad to
-- the owner only — nearby-friends access is mediated by
-- get_nearby_available_friends() which runs as security-definer.
alter table public.momentum_availability enable row level security;

drop policy if exists momentum_availability_select_own on public.momentum_availability;
create policy momentum_availability_select_own
  on public.momentum_availability for select
  using (auth.uid() = user_id);

drop policy if exists momentum_availability_insert_own on public.momentum_availability;
create policy momentum_availability_insert_own
  on public.momentum_availability for insert
  with check (auth.uid() = user_id);

drop policy if exists momentum_availability_update_own on public.momentum_availability;
create policy momentum_availability_update_own
  on public.momentum_availability for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists momentum_availability_delete_own on public.momentum_availability;
create policy momentum_availability_delete_own
  on public.momentum_availability for delete
  using (auth.uid() = user_id);


-- ============ presence_daily ============
-- Read own presence scores. Writes come from the cron_presence Edge Function
-- (service_role).
alter table public.presence_daily enable row level security;

drop policy if exists presence_daily_select_own on public.presence_daily;
create policy presence_daily_select_own
  on public.presence_daily for select
  using (auth.uid() = user_id);


-- ============ push_tokens ============
-- Owner-scoped. Clients upsert their own device token on app launch.
alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own
  on public.push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own
  on public.push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own
  on public.push_tokens for delete
  using (auth.uid() = user_id);


-- ============ reports ============
-- Reporters can create and read their own reports. Admin triage happens via
-- service_role. The reported user does NOT see reports filed against them.
-- Guarded with to_regclass: this table is planned but not yet created in
-- every environment (moderation feature is staged). Skip silently if absent.
do $$
begin
  if to_regclass('public.reports') is not null then
    execute 'alter table public.reports enable row level security';

    execute 'drop policy if exists reports_select_own on public.reports';
    execute $ddl$create policy reports_select_own
      on public.reports for select
      using (auth.uid() = reporter_id)$ddl$;

    execute 'drop policy if exists reports_insert_own on public.reports';
    execute $ddl$create policy reports_insert_own
      on public.reports for insert
      with check (auth.uid() = reporter_id)$ddl$;
  end if;
end $$;


-- ============ suggestions ============
-- Owner-scoped Intent Cloud cards. SELECT own; UPDATE own (for dismiss /
-- accept / dismiss_reason). Fresh rows are generated by the
-- precompute_suggestions cron and by ai-generate (service_role); there is no
-- legitimate client INSERT path today, so we omit the INSERT policy.
-- DELETE is not exposed to clients (status transitions are soft).
alter table public.suggestions enable row level security;

drop policy if exists suggestions_select_own on public.suggestions;
create policy suggestions_select_own
  on public.suggestions for select
  using (auth.uid() = user_id);

drop policy if exists suggestions_update_own on public.suggestions;
create policy suggestions_update_own
  on public.suggestions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ==========================================================================
-- Verification
-- ==========================================================================
-- After applying this migration, sanity-check the policy set with:
--
--   select schemaname, tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   order by tablename, policyname;
--
-- And confirm RLS is enabled on every user-data table:
--
--   select n.nspname, c.relname, c.relrowsecurity
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r'
--   order by c.relname;
-- ==========================================================================
