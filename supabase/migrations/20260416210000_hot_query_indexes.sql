-- ==========================================================================
-- Hot-query indexes (Phase 3, Task 17)
-- ==========================================================================
-- Audit of the service-layer + edge-function query patterns turned up a
-- handful of frequent filters that fall back to seq scan today. This
-- migration adds the missing indexes. All `create index if not exists` so
-- the file is safe to re-apply.
--
-- Methodology: grep service files (`packages/core/src/services/*`) and all
-- edge functions for `.from('X').eq(...)` / `.gte(...)` patterns, then
-- cross-reference against the index list in prior migrations AND the live
-- DB's `pg_indexes`. Added an index when:
--   (a) the column appears in WHERE/ORDER BY on a hot path, AND
--   (b) no existing index (including the primary key) already serves it.
--
-- Pre-application live-DB audit (2026-04-16) caught three issues:
--   * app_events has no `created_at` column — the time column is
--     `occurred_at`. Original draft tried to index `created_at` and would
--     have failed. Fixed.
--   * `idx_app_events_user` already exists as `(user_id, occurred_at DESC)`
--     — the same thing this migration was going to add under a different
--     name. Dropped the duplicate.
--   * `idx_suggestions_user` already exists as
--     `(user_id, status, created_at DESC)` — same deal. Dropped.
--   * `idx_plans_creator` exists as just `(creator_id)` — strictly narrower
--     than the `(creator_id, created_at desc)` composite we actually want.
--     This migration creates the composite and drops the narrower one.
--
-- Not added: BRIN on app_events.occurred_at — BRIN is cheaper for a
-- time-series table of this size, but a btree works fine at the current
-- row count. Revisit when pg_stat_statements shows retention_purge above
-- a few hundred ms.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- app_events
-- --------------------------------------------------------------------------
-- Hot paths:
--   (a) per-user activity window: `WHERE user_id = $1 AND occurred_at >= $2`
--       — used in processPresenceForUser (fires once per queued job).
--       *Already covered by existing `idx_app_events_user`
--       (user_id, occurred_at DESC). No new index needed here.*
--   (b) active-user discovery (no user filter):
--       `SELECT user_id FROM app_events WHERE occurred_at >= $1`
--       — used in every fan-out cron producer.
--   (c) retention purge (daily):
--       `DELETE FROM app_events WHERE occurred_at < now() - interval '90 days'`
--       — currently referenced in a broken cron (see separate fix task;
--       cron has stale `created_at` reference).
--
-- (b) and (c) benefit from a standalone `(occurred_at)` btree; the
-- composite's leading column (user_id) can't be skipped.

create index if not exists app_events_occurred_at_idx
  on public.app_events (occurred_at);

-- --------------------------------------------------------------------------
-- suggestions
-- --------------------------------------------------------------------------
-- Hot paths:
--   (a) "fresh for this user":
--       `WHERE user_id = $1 AND status = 'new' AND expires_at > now()`
--   (b) "latest new title":
--       `WHERE user_id = $1 AND status = 'new' ORDER BY created_at DESC LIMIT 1`
--   (c) replay-yesterday users:
--       `WHERE user_id = $1 AND status IN ('dismissed','expired')
--          AND created_at >= $2 AND created_at < $3`
--     → All THREE user-scoped paths are covered by existing
--       `idx_suggestions_user (user_id, status, created_at DESC)`.
--
--   (d) replay producer (no user filter):
--       `SELECT user_id FROM suggestions WHERE status IN (...) AND created_at >= $1`
--   (e) expire cron (every 15m):
--       `UPDATE suggestions SET status='expired'
--          WHERE status='new' AND expires_at < now()`
--
-- (d) wants `(status, created_at)` — no existing index serves this.
-- (e) wants `(expires_at)` where status='new' — a partial index lets us
-- avoid indexing dismissed/expired rows (the majority over time).

create index if not exists suggestions_status_created_idx
  on public.suggestions (status, created_at);

create index if not exists suggestions_new_expires_idx
  on public.suggestions (expires_at)
  where status = 'new';

-- --------------------------------------------------------------------------
-- plan_participants
-- --------------------------------------------------------------------------
-- PK is (plan_id, user_id). Left-prefix lookup by plan_id is covered, but
-- the "plans I'm a participant in" query filters by user_id alone (see
-- getPlans in plans.service.ts) which currently seq-scans.

create index if not exists plan_participants_user_idx
  on public.plan_participants (user_id);

-- --------------------------------------------------------------------------
-- plans
-- --------------------------------------------------------------------------
-- `WHERE creator_id = $1 ORDER BY created_at DESC` is the dashboard load.
-- Live DB has a narrower `idx_plans_creator (creator_id)` — the new
-- composite below covers everything the narrower one does *plus* the
-- ORDER BY, so we drop the narrower one to avoid paying insert overhead
-- on two near-identical indexes.

create index if not exists plans_creator_created_idx
  on public.plans (creator_id, created_at desc);

drop index if exists public.idx_plans_creator;

-- --------------------------------------------------------------------------
-- friendships
-- --------------------------------------------------------------------------
-- Bidirectional relationship read in parallel (getSuggestedPlans):
--   `WHERE user_id   = $1 AND status = 'accepted'`
--   `WHERE friend_id = $1 AND status = 'accepted'`
-- Add both. Keep status in the index so we don't read non-accepted rows
-- at all.

create index if not exists friendships_user_status_idx
  on public.friendships (user_id, status);

create index if not exists friendships_friend_status_idx
  on public.friendships (friend_id, status);

-- --------------------------------------------------------------------------
-- ANALYZE so the planner sees the new indexes immediately
-- --------------------------------------------------------------------------
-- Without this, the first few queries may still prefer seq scan because
-- pg_class stats haven't been refreshed since the index came online.

analyze public.app_events;
analyze public.suggestions;
analyze public.plan_participants;
analyze public.plans;
analyze public.friendships;
