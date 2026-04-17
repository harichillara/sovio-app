-- ==========================================================================
-- RLS hardening, part 3 (fixes a latent bug + documents tight-by-default state)
-- ==========================================================================
-- This migration has one functional change + two documentation no-ops:
--
-- 1. ai_jobs: add SECURITY DEFINER RPCs for autopilot approve/reject.
--    BEFORE: ai_jobs has only a SELECT policy (see rls_everywhere pt1). No
--            INSERT/UPDATE/DELETE policies means client writes were silently
--            denied by RLS — which silently broke `approveProposal` and
--            `rejectProposal` in packages/core/src/services/autopilot.service.ts
--            (both do client-side UPDATEs on ai_jobs). This was flagged as
--            follow-up in 20260416195000_ai_jobs_unify.sql:34.
--    AFTER : Two SECURITY DEFINER RPCs that can ONLY flip `status` on
--            user-owned autopilot rows. The client calls the RPC instead
--            of writing ai_jobs directly; ai_jobs RLS stays deny-all for
--            client writes. Strictly tighter than adding a broad UPDATE
--            policy (user can't mutate `result`, `job_type`, `kind`, etc.).
--
-- 2. ai_token_usage: documentation-only. RLS is already SELECT-only from
--    20260416120000_rls_everywhere, and the dead client-side `incrementTokens`
--    in ai.service.ts was removed in this sweep — it would have been silently
--    RLS-denied in prod anyway. Leaving a comment so future devs don't
--    accidentally re-introduce a client write path.
--
-- 3. momentum_availability: documentation-only. SELECT is already
--    `auth.uid() = user_id` (pt1). The dead-code `getAvailableUsers` cross-user
--    listing in momentum.service.ts was removed in this sweep — cross-user
--    discovery now only goes through the SECURITY DEFINER RPC
--    `get_nearby_available_friends`, which enforces friendship + radius.
-- ==========================================================================


-- --------------------------------------------------------------------------
-- 1. ai_jobs: SECURITY DEFINER RPCs for autopilot approve/reject
-- --------------------------------------------------------------------------
-- Design notes:
--   * SECURITY DEFINER so the function runs with the owner's privileges and
--     bypasses the deny-all client write policies on ai_jobs. Safe because
--     the function's body scopes every mutation with
--     `user_id = auth.uid() AND kind = 'autopilot'` — the caller's identity
--     is pulled from auth.uid() inside the function, not from a parameter.
--   * `set search_path = public, pg_temp` prevents search_path hijacks (a
--     SECURITY DEFINER best practice — without it, a role-owned schema on
--     the caller's search_path could shadow `public.ai_jobs`).
--   * We only mutate `status`. No column for `result` / `job_type` / `kind`
--     is exposed, so clients cannot abuse the RPC to rewrite the body.
--   * Revoke PUBLIC execute + grant to `authenticated` only — unauthenticated
--     calls must not flip rows.

create or replace function public.approve_autopilot_proposal(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated int;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  update public.ai_jobs
     set status = 'approved'
   where id = p_job_id
     and user_id = auth.uid()
     and kind = 'autopilot'
     and status = 'done';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    -- Either the proposal doesn't exist, isn't owned by the caller, isn't an
    -- autopilot row, or has already been approved/rejected. Treat uniformly
    -- as not-found so we don't leak ownership info.
    raise exception 'proposal not found or not actionable' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.reject_autopilot_proposal(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated int;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  update public.ai_jobs
     set status = 'rejected'
   where id = p_job_id
     and user_id = auth.uid()
     and kind = 'autopilot'
     and status = 'done';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'proposal not found or not actionable' using errcode = 'P0002';
  end if;
end;
$$;

-- Lock down callers. Supabase's `create function` auto-grants execute to
-- `anon`, `authenticated`, and `service_role` via default grants; `revoke
-- from public` doesn't remove those role-specific grants. Revoke explicitly
-- from `anon` so unauthenticated requests can't even enter the function
-- (belt-and-suspenders: the body already raises on null auth.uid()).
revoke all on function public.approve_autopilot_proposal(uuid) from public;
revoke all on function public.reject_autopilot_proposal(uuid)  from public;
revoke all on function public.approve_autopilot_proposal(uuid) from anon;
revoke all on function public.reject_autopilot_proposal(uuid)  from anon;
grant execute on function public.approve_autopilot_proposal(uuid) to authenticated;
grant execute on function public.reject_autopilot_proposal(uuid)  to authenticated;


-- --------------------------------------------------------------------------
-- 2. Policy cleanup — drop the compound ALL policies pt1 + canonical names
--    deliberately deferred, and replace with per-command tight policies.
-- --------------------------------------------------------------------------
-- Live DB audit (2026-04-17) showed three latent wide policies still in place:
--
--   * ai_jobs          "Users manage own jobs"       cmd=ALL    — client writes allowed
--   * ai_token_usage   "Users manage own tokens"     cmd=ALL    — client writes allowed
--   * momentum_avail.  "Anyone sees availability"    cmd=SELECT using true — cross-user read
--
-- The canonical pt1 migration (rls_everywhere) assumed these had been
-- replaced, but the drops only matched the new names — the original
-- spoken-language names survived. This block drops them and rebuilds the
-- tight policy set idempotently.

-- ai_jobs: SELECT-only for clients. All writes are done by the ai-generate
-- Edge Function via service_role (which bypasses RLS) or via the
-- approve/reject_autopilot_proposal RPCs defined above.
drop policy if exists "Users manage own jobs" on public.ai_jobs;
drop policy if exists ai_jobs_select_own on public.ai_jobs;
create policy ai_jobs_select_own
  on public.ai_jobs for select
  to authenticated
  using (auth.uid() = user_id);

-- ai_token_usage: SELECT-only for clients. `incrementTokens` was dead code
-- and has been removed from ai.service.ts; any future server-side token
-- tracking should route through a SECURITY DEFINER RPC, not a client write.
drop policy if exists "Users manage own tokens" on public.ai_token_usage;
drop policy if exists ai_token_usage_select_own on public.ai_token_usage;
create policy ai_token_usage_select_own
  on public.ai_token_usage for select
  to authenticated
  using (auth.uid() = user_id);

-- momentum_availability: tighten SELECT to self-only (was `using (true)`,
-- which leaked availability rows cross-user). Friend discovery is mediated
-- by the SECURITY DEFINER RPC get_nearby_available_friends, which enforces
-- friendship + radius server-side and runs privileged. Dead-code
-- getAvailableUsers was removed from momentum.service.ts in this sweep.
drop policy if exists "Anyone sees availability" on public.momentum_availability;
-- Normalize the legacy INSERT/DELETE policy names to the canonical form.
-- The behaviour is unchanged; only the policyname changes so verification
-- lists look clean.
drop policy if exists "Users set own availability" on public.momentum_availability;
drop policy if exists "Users remove own availability" on public.momentum_availability;
drop policy if exists momentum_availability_select_own on public.momentum_availability;
drop policy if exists momentum_availability_insert_own on public.momentum_availability;
drop policy if exists momentum_availability_delete_own on public.momentum_availability;
create policy momentum_availability_select_own
  on public.momentum_availability for select
  to authenticated
  using (auth.uid() = user_id);
create policy momentum_availability_insert_own
  on public.momentum_availability for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy momentum_availability_delete_own
  on public.momentum_availability for delete
  to authenticated
  using (auth.uid() = user_id);
-- The UPDATE policy (momentum_availability_update_own) was added in pt2 and
-- is already tight (qual + with_check both `auth.uid() = user_id`). Left
-- untouched here.


-- ==========================================================================
-- Verification (informational):
--
--   -- 1. RPCs exist with SECURITY DEFINER and correct grants
--   select p.proname, p.prosecdef,
--          array_agg(distinct r.rolname) filter (where r.rolname is not null)
--            as granted_to
--   from pg_proc p
--   left join pg_catalog.aclexplode(p.proacl) a on true
--   left join pg_roles r on r.oid = a.grantee and a.privilege_type = 'EXECUTE'
--   where p.pronamespace = 'public'::regnamespace
--     and p.proname in ('approve_autopilot_proposal','reject_autopilot_proposal')
--   group by p.proname, p.prosecdef;
--
--   -- Expected: prosecdef = true for both; granted_to includes 'authenticated'
--   --           and NOT 'anon' / 'public'.
--
--   -- 2. ai_jobs has SELECT-only for clients (no ALL/INSERT/UPDATE/DELETE)
--   select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='ai_jobs' order by cmd, policyname;
--   -- Expected: single ai_jobs_select_own, cmd='SELECT'.
-- ==========================================================================
