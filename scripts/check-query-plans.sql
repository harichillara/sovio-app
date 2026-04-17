-- Usage:
--   Run against production via
--     psql $SUPABASE_DB_URL -f scripts/check-query-plans.sql > query-plans-$(date +%Y%m%d).txt
--
--   Then diff successive runs to spot regressions. The script is read-only —
--   EXPLAIN ANALYZE executes the query but we wrap everything in a BEGIN / ROLLBACK
--   so any side effects (hint: there shouldn't be any; these are all SELECTs) are
--   discarded.
--
-- What to look for in the output
-- ------------------------------
--   "Seq Scan on <table>"         on any table with > 10k rows = missing index.
--   "Sort Method: external merge" = work_mem too low; the sort spilled to disk.
--   "Rows Removed by Filter: N"   high N means the index isn't selective enough.
--   "Planning Time" > 50ms        query planner working too hard — check stats freshness.
--   "Execution Time" > 200ms      user-facing latency budget blown.
--   "Buffers: shared read=N"      high N = cold cache; not a bug unless consistent.
--
-- The 10 queries below mirror the hottest user-facing reads in
-- packages/core/src/services/*.service.ts. Update this file when those fetchers change.
--
-- Important notes
-- ---------------
-- - Replace the `SET LOCAL my.test_user_id = ...` value with a real user's UUID
--   from the target environment. For prod, pick a power user (lots of threads,
--   messages, suggestions) — that's where the plans actually matter.
-- - pg_stat_statements is enabled on Supabase; after running this, also review
--     select query, calls, total_exec_time, mean_exec_time
--       from pg_stat_statements order by total_exec_time desc limit 30;
--   to catch anything we didn't hand-list here.

BEGIN;

-- Swap this out for a real user in the target environment.
SET LOCAL my.test_user_id = '00000000-0000-0000-0000-000000000000';

-- Ensure we print timing and buffers, not just the plan shape.
SET LOCAL client_min_messages = WARNING;

\echo '================================================================'
\echo 'Q1 — threads for the authenticated user'
\echo '      Source: messages.service.ts getThreads() / get_thread_summaries RPC'
\echo '      Expect: Index Scan on thread_participants(user_id). If seq scan, add that index.'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT t.*
FROM public.threads t
JOIN public.thread_participants tp ON tp.thread_id = t.id
WHERE tp.user_id = current_setting('my.test_user_id')::uuid
ORDER BY t.updated_at DESC
LIMIT 50;

\echo '================================================================'
\echo 'Q2 — messages in a thread, newest first (pagination)'
\echo '      Source: messages.service.ts getMessages()'
\echo '      Expect: Index Scan using (thread_id, created_at DESC). If Sort node appears, the index is missing or wrong direction.'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.messages
WHERE thread_id = (
  SELECT id FROM public.threads LIMIT 1
)
ORDER BY created_at DESC
LIMIT 50;

\echo '================================================================'
\echo 'Q3 — active plans for a user (creator OR participant)'
\echo '      Source: plans.service.ts getPlans()'
\echo '      Expect: Bitmap-OR over plans.creator_id index + plan_participants.user_id index.'
\echo '              If the OR devolves to Seq Scan on plans, we need a composite or covering index.'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT p.*
FROM public.plans p
LEFT JOIN public.plan_participants pp ON pp.plan_id = p.id
WHERE p.creator_id = current_setting('my.test_user_id')::uuid
   OR pp.user_id = current_setting('my.test_user_id')::uuid
ORDER BY p.created_at DESC
LIMIT 20;

\echo '================================================================'
\echo 'Q4 — entitlements row for a user (hot: every paywall check)'
\echo '      Source: entitlements.service.ts getEntitlement() / isPro()'
\echo '      Expect: Index Scan using entitlements_user_id_key. Execution Time should be < 5ms.'
\echo '              This is called on every AI draft — a slow plan here is a direct p95 problem.'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.entitlements
WHERE user_id = current_setting('my.test_user_id')::uuid;

\echo '================================================================'
\echo 'Q5 — app_events in the last 7 days (replay screen, presence)'
\echo '      Source: events.service.ts getRecentEvents() + presence.service.ts computeScore()'
\echo '      Expect: Index Scan on (user_id, created_at DESC). At high event volume this is the'
\echo '              single most expensive read per user — watch for "Rows Removed by Filter".'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.app_events
WHERE user_id = current_setting('my.test_user_id')::uuid
  AND created_at > now() - interval '7 days'
ORDER BY created_at DESC
LIMIT 500;

\echo '================================================================'
\echo 'Q6 — unread notifications count'
\echo '      Source: notifications.service.ts getUnreadCount()'
\echo '      Expect: Index-Only Scan if a partial index "where read = false" exists, otherwise'
\echo '              Bitmap Index Scan on user_id + filter on read. If Heap Fetches is high, vacuum'
\echo '              may be behind.'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT count(*)
FROM public.notifications
WHERE user_id = current_setting('my.test_user_id')::uuid
  AND read = false;

\echo '================================================================'
\echo 'Q7 — recent suggestions for the home feed'
\echo '      Source: suggestions.service.ts getSuggestions()'
\echo '      Expect: Index Scan on (user_id, created_at DESC). The OR on expires_at should resolve'
\echo '              via filter, not a separate index path — verify it does not cause a Seq Scan.'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.suggestions
WHERE user_id = current_setting('my.test_user_id')::uuid
  AND status = 'new'
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY created_at DESC
LIMIT 20;

\echo '================================================================'
\echo 'Q8 — accepted friendships (bidirectional)'
\echo '      Source: friendships.service.ts getFriends()'
\echo '      Expect: Two index scans (user_id, friend_id separately) — the code does two queries, not'
\echo '              a UNION. If we change that, re-run this plan. Watch for Seq Scan on the larger'
\echo '              side once friendships exceed ~100k rows.'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.friendships
WHERE user_id = current_setting('my.test_user_id')::uuid
  AND status = 'accepted';

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.friendships
WHERE friend_id = current_setting('my.test_user_id')::uuid
  AND status = 'accepted';

\echo '================================================================'
\echo 'Q9 — presence_daily history (presence-score modal, weekly insight)'
\echo '      Source: presence.service.ts list queries'
\echo '      Expect: Index Scan on (user_id, day DESC). Upserts rely on the (user_id, day) unique'
\echo '              constraint — confirm it is still PRIMARY or UNIQUE (not just a regular index).'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM public.presence_daily
WHERE user_id = current_setting('my.test_user_id')::uuid
ORDER BY day DESC
LIMIT 30;

\echo '================================================================'
\echo 'Q10 — thread_participants membership check (every message send/read)'
\echo '      Source: messages.service.ts assertThreadParticipant()'
\echo '      Expect: Index Scan on (thread_id, user_id) — ideally a UNIQUE composite. Called on every'
\echo '              sendMessage() and getMessages(); a seq scan here is a scalability wall at any DAU.'
\echo '================================================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id
FROM public.thread_participants
WHERE thread_id = (SELECT id FROM public.threads LIMIT 1)
  AND user_id = current_setting('my.test_user_id')::uuid;

ROLLBACK;
