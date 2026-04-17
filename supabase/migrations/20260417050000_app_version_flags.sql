-- ==========================================================================
--   app_version_flags
--
--   Runtime kill-switch + upgrade-gating for shipped mobile builds.
--
--   The mobile app queries this table on cold-start and after every resume
--   to answer: "is this installed version force-update-required (show
--   blocking screen), soft-upgrade-suggested (show dismissible banner),
--   or OK to run?"
--
--   Without this, an OTA bug that ships via expo-updates has no kill
--   switch — we'd have to publish a new store build and wait for review.
--   A single row-update here flips the gate at runtime.
--
--   Shape:
--     platform       — 'ios' | 'android'   (no web — web auto-updates)
--     min_version    — builds below this are force-update-required
--     latest_version — builds at or above this are OK
--     builds in-between get the soft-upgrade banner
--     message        — optional text shown alongside the prompt (e.g.
--                      "Required security update")
--
--   RLS: SELECT is open to authenticated users (they need to read their
--   own gate). Writes are service_role only — flipping the kill switch
--   is an ops action, never a client action.
-- ==========================================================================

create table if not exists public.app_version_flags (
  platform text primary key check (platform in ('ios', 'android')),
  min_version text not null,
  latest_version text not null,
  message text,
  updated_at timestamptz not null default now()
);

comment on table public.app_version_flags is
  'Runtime upgrade-gate for mobile builds. One row per platform. Clients read on startup to decide force-update vs. soft-upgrade vs. OK.';

alter table public.app_version_flags enable row level security;

drop policy if exists app_version_flags_select_auth on public.app_version_flags;
create policy app_version_flags_select_auth
  on public.app_version_flags for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies: service_role bypasses RLS for ops
-- writes; everyone else is denied by default.

-- Trigger to keep updated_at fresh on any write. Saves a round trip for
-- the ops person flipping the gate.
create or replace function public.touch_app_version_flags_updated_at()
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

drop trigger if exists app_version_flags_touch_updated_at on public.app_version_flags;
create trigger app_version_flags_touch_updated_at
  before update on public.app_version_flags
  for each row
  execute function public.touch_app_version_flags_updated_at();

-- Seed rows so the client always gets a definitive answer. Ops can
-- bump these at any time.
insert into public.app_version_flags (platform, min_version, latest_version, message)
values
  ('ios',     '1.0.0', '1.0.0', null),
  ('android', '1.0.0', '1.0.0', null)
on conflict (platform) do nothing;
