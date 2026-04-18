-- RLS hardening pt5: replace implicit `public`-role policies with explicit
-- `authenticated` or `service_role` targets.
--
-- Why:
--   Several earlier migrations declared policies with `create policy ... for
--   select using (...)` without a `to <role>` clause. Postgres defaults that
--   to role `public`, which in DB terms includes every role (anon,
--   authenticated, service_role, postgres). The qualifiers (usually
--   `auth.uid() = user_id`) gate access correctly in practice — null
--   auth.uid() on anon can't match — but:
--     1. It's less defensible on audit. A future qual regression (someone
--        writes `true` by accident) would immediately open anon read.
--     2. It trips snapshot invariants (see supabase/tests/pg_policies.snapshot.test.ts).
--     3. Explicit target roles are the Supabase-recommended convention.
--
-- Each block: drop the old policy, recreate with identical qual/with_check
-- but targeted at the correct role.

begin;

------------------------------------------------------------------------------
-- intent_candidates
------------------------------------------------------------------------------
drop policy if exists "intent_candidates_select_own" on public.intent_candidates;
create policy "intent_candidates_select_own"
  on public.intent_candidates
  for select
  to authenticated
  using (auth.uid() = user_id);

------------------------------------------------------------------------------
-- location_snapshots
------------------------------------------------------------------------------
drop policy if exists "location_snapshots_insert_own" on public.location_snapshots;
create policy "location_snapshots_insert_own"
  on public.location_snapshots
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "location_snapshots_select_own" on public.location_snapshots;
create policy "location_snapshots_select_own"
  on public.location_snapshots
  for select
  to authenticated
  using (auth.uid() = user_id);

------------------------------------------------------------------------------
-- notifications
------------------------------------------------------------------------------
-- This one stays targeted at service_role. Defense-in-depth: service_role
-- already bypasses RLS, but writing the policy explicitly documents the
-- intent that only service-role callers should INSERT notifications. (The
-- triggers trg_notify_* and edge fns are the legitimate callers.)
drop policy if exists "Service role can insert notifications" on public.notifications;
create policy "notifications_insert_service_role"
  on public.notifications
  for insert
  to service_role
  with check (true);

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can mark own notifications read" on public.notifications;
create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

------------------------------------------------------------------------------
-- thread_participants
------------------------------------------------------------------------------
-- Preserves the bootstrap case: a user can INSERT themselves into a thread
-- that has no participants yet (first row), OR into a thread where they're
-- already a participant.
drop policy if exists "thread_participants_insert_member_or_bootstrap" on public.thread_participants;
create policy "thread_participants_insert_member_or_bootstrap"
  on public.thread_participants
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.thread_participants self
      where self.thread_id = thread_participants.thread_id
        and self.user_id = auth.uid()
    )
    or (
      auth.uid() = user_id
      and not exists (
        select 1
        from public.thread_participants any_row
        where any_row.thread_id = thread_participants.thread_id
      )
    )
  );

------------------------------------------------------------------------------
-- weekly_insights
------------------------------------------------------------------------------
drop policy if exists "Service role can manage weekly insights" on public.weekly_insights;
create policy "weekly_insights_all_service_role"
  on public.weekly_insights
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Users can view own weekly insights" on public.weekly_insights;
create policy "weekly_insights_select_own"
  on public.weekly_insights
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update own weekly insights" on public.weekly_insights;
create policy "weekly_insights_update_own"
  on public.weekly_insights
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
