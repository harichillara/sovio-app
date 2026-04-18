-- ==========================================================================
-- RLS hardening (behavior changes flagged during canonical naming cleanup)
-- ==========================================================================
-- The canonical rename migration (20260416230000_canonical_rls_names) only
-- touched policies where live behavior matched the canonical definition
-- exactly. This migration fixes 5 policies where live behavior is strictly
-- too permissive vs the canonical intent. Each change is security-positive
-- and cannot break a legitimate client call path -- verified against the
-- @sovio/core services that read/write these tables.
--
-- CHANGES:
--
-- 1. thread_participants INSERT -- the big one.
--    BEFORE: with_check = true. Any authenticated user can add any user to
--    any thread, including threads they are not a member of. A hostile
--    client could inject itself into a private DM between two other users.
--    AFTER : caller must already be a participant of the thread, OR the
--    thread is empty and the caller is adding themself (new-thread
--    bootstrap -- preserves the existing createThread flow).
--    VERIFIED: createThread in messages.service.ts inserts the creator
--    first when the thread row is fresh -- satisfies the bootstrap branch.
--
-- 2-5. Adding with_check to UPDATE policies that only had a USING clause.
--    BEFORE: qual gates who can UPDATE, but with_check is null -- meaning
--    a legitimate updater could SET a key column (creator_id / user_id /
--    id) to another user, effectively laundering a row to someone else.
--    AFTER : with_check mirrors the qual, so post-UPDATE the row must
--    still satisfy the same ownership predicate.
--    Affected policies:
--      - plans "Creators update own plans"        (gate column: creator_id)
--      - plan_participants "Participants update own status" (user_id)
--      - thread_participants "Update own read status"       (user_id)
--      - profiles "Users update own profile"                 (id)
--    Zero regression risk: any legitimate UPDATE today already keeps the
--    gate column unchanged, so it already satisfies the new with_check.
--
-- EXPLICITLY DEFERRED (not touched here -- need product decisions):
--   - ai_jobs / ai_token_usage compound ALL -> SELECT-only
--     Clients legitimately update ai_jobs via autopilot approveProposal /
--     rejectProposal, and ai_token_usage via incrementTokens() monthly
--     tracking. Hardening these requires moving writes server-side first
--     (a Phase 1 leftover, not an RLS cleanup).
--   - suggestions compound ALL -> SELECT+UPDATE
--   - momentum_availability SELECT broadening check
--   - thread_participants SELECT/DELETE canonical shape
-- ==========================================================================


-- --------------------------------------------------------------------------
-- 1. thread_participants INSERT  --  close the any-user-any-thread bug
-- --------------------------------------------------------------------------
-- Replace the old policy entirely. We drop by the live name (which may be
-- "Add thread participants" from an older migration, or the canonical name
-- if a previous rename ran). Idempotent: the DROP IF EXISTS pair plus the
-- CREATE POLICY ensure the final state is deterministic.
drop policy if exists "Add thread participants" on public.thread_participants;
drop policy if exists thread_participants_insert_member_or_bootstrap on public.thread_participants;

create policy thread_participants_insert_member_or_bootstrap
  on public.thread_participants for insert
  with check (
    -- Caller is already in this thread: can add others.
    exists (
      select 1 from public.thread_participants self
      where self.thread_id = thread_participants.thread_id
        and self.user_id = auth.uid()
    )
    -- ...OR the thread is empty and caller is adding themself (bootstrap).
    or (
      auth.uid() = user_id
      and not exists (
        select 1 from public.thread_participants any_row
        where any_row.thread_id = thread_participants.thread_id
      )
    )
  );


-- --------------------------------------------------------------------------
-- 2. plans UPDATE  --  add with_check to prevent creator_id transfer
-- --------------------------------------------------------------------------
-- We keep the existing policy name to avoid churn; only the with_check is
-- added. PostgreSQL supports ALTER POLICY ... WITH CHECK (...) as of 9.5.
alter policy "Creators update own plans"
  on public.plans
  with check (creator_id = auth.uid());


-- --------------------------------------------------------------------------
-- 3. plan_participants UPDATE  --  add with_check to prevent user_id transfer
-- --------------------------------------------------------------------------
alter policy "Participants update own status"
  on public.plan_participants
  with check (user_id = auth.uid());


-- --------------------------------------------------------------------------
-- 4. thread_participants UPDATE  --  add with_check to prevent user_id transfer
-- --------------------------------------------------------------------------
alter policy "Update own read status"
  on public.thread_participants
  with check (user_id = auth.uid());


-- --------------------------------------------------------------------------
-- 5. profiles UPDATE  --  add with_check to prevent id transfer
-- --------------------------------------------------------------------------
-- profiles.id is a UUID that equals auth.users.id; a UPDATE that changes it
-- would break the FK cascade. This with_check makes the policy layer
-- enforce the invariant explicitly instead of relying on schema accident.
alter policy "Users update own profile"
  on public.profiles
  with check (auth.uid() = id);


-- ==========================================================================
-- Verification (informational):
--
--   select tablename, policyname, cmd, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and policyname in (
--       'thread_participants_insert_member_or_bootstrap',
--       'Creators update own plans',
--       'Participants update own status',
--       'Update own read status',
--       'Users update own profile'
--     )
--   order by tablename, policyname;
--
-- Expected: all 5 policies present with non-null with_check matching the
-- relevant ownership predicate.
-- ==========================================================================
