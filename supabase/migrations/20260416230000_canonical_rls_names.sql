-- ==========================================================================
-- Canonical RLS policy names (cleanup of naming drift)
-- ==========================================================================
-- Live DB has RLS fully enabled on all user-data tables, but the policy
-- NAMES come from older migrations (schema_alignment, notifications, etc.)
-- and are spoken-language strings like "Thread members view messages".
--
-- 20260416120000_rls_everywhere.sql defines the *canonical* snake_case
-- naming convention (e.g. messages_select_participant). This migration
-- aligns the live policy names to the canonical form WHERE the rename is
-- a pure no-op — identical cmd, qual, with_check, and roles.
--
-- SCOPE: rename-only. Eight policies match exactly and are renamed here.
-- The remaining ~15 older-named policies have subtle behavioural
-- differences vs their canonical equivalents (missing with_check on UPDATE,
-- broader INSERT on thread_participants, compound ALL policies where mig
-- 11 splits per-command). Those are real hardening opportunities, but
-- changing them is a *behaviour change*, not a rename, so they are left
-- alone here. A follow-up migration can address them explicitly.
--
-- SAFETY: every rename is wrapped in a pg_policies existence check so this
-- is idempotent — re-running has no effect once the canonical names are
-- in place, and running before the target tables exist is also safe.
-- ==========================================================================


-- Helper: rename policy if the OLD name currently exists AND the new name
-- does not. We use plpgsql because ALTER POLICY does not support IF EXISTS
-- on Postgres 15/16.
do $$
declare
  r record;
  renames text[][] := array[
    -- table,              old name,                                     new canonical name
    ['app_events',         'Users view own events',                      'app_events_select_own'],
    ['app_events',         'Users insert own events',                    'app_events_insert_own'],
    ['entitlements',       'Users view own entitlements',                'entitlements_select_own'],
    ['plans',              'Plans viewable by creator and participants', 'plans_select_participant'],
    ['plans',              'Users create plans',                         'plans_insert_creator'],
    ['plans',              'Creators delete own plans',                  'plans_delete_creator'],
    ['messages',           'Thread members view messages',               'messages_select_participant'],
    ['messages',           'Thread members send messages',               'messages_insert_participant']
  ];
  tbl text;
  old_name text;
  new_name text;
  i int;
begin
  for i in 1 .. array_length(renames, 1) loop
    tbl      := renames[i][1];
    old_name := renames[i][2];
    new_name := renames[i][3];

    -- Only rename if old exists and new does not (idempotent).
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl and policyname = old_name
    ) and not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl and policyname = new_name
    ) then
      execute format(
        'alter policy %I on public.%I rename to %I',
        old_name, tbl, new_name
      );
      raise notice 'canonical_rls_names: renamed %.% -> %', tbl, old_name, new_name;
    else
      raise notice 'canonical_rls_names: skipped %.% (old missing or new exists)', tbl, old_name;
    end if;
  end loop;
end $$;


-- ==========================================================================
-- Verification (informational — run manually if desired):
--
--   select tablename, policyname
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('app_events','entitlements','plans','messages')
--   order by tablename, policyname;
--
-- Expected after apply: all 8 target policies appear under the canonical
-- snake_case names. The eight older-named entries should be gone.
-- ==========================================================================
