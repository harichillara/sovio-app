# Realtime Scaling Runbook

> **If messages are silently not arriving in threads at scale, read Section 2 first.** The multiplex has one known failure mode (channel-error amnesia) that produces exactly that symptom.

Last reviewed: 2026-04-17
Owner: @harichillara

---

## 0. Current design — why a multiplex

The mobile and web clients use **one shared Supabase Realtime channel** for every INSERT on `public.messages`, not one channel per open thread.

Source: `packages/core/src/providers/messagesChannel.ts`
Consumers: `useRealtimeMessages(threadId)` in `packages/core/src/hooks/useMessages.ts` (mounted from `apps/mobile/app/(modals)/thread-detail.tsx`).

**Why:**

- Supabase's JS client has a practical ceiling of ~200 concurrent channels per socket; power users who stack thread-detail modals, skim 30 threads in a session, or hit React strict-mode double mounts can exhaust that budget far faster than it sounds.
- One INSERT stream is cheaper than N filtered streams both client-side (single WebSocket subscription) and server-side (one replication slot consumer vs. N).
- RLS on `public.messages` (`"Thread members view messages"`) already restricts events to threads the user participates in, so the per-thread `thread_id=eq.<id>` filter was pure duplication.

**Mechanics:**

- First subscriber creates the singleton channel (`messages-multiplex`).
- `threadListeners: Map<threadId, Set<listener>>` dispatches each incoming row to only the listeners for `row.thread_id`. Events for threads with no listener are silently dropped — next refetch of the thread list picks them up.
- Ref-counted teardown: last unsubscribe removes the channel and nulls the singleton, so logout → login creates a fresh channel instead of leaking a WebSocket.
- There is also a separate `global-realtime` channel in `RealtimeProvider.tsx` for the user's own `notifications` row. That is intentional: notifications are user-scoped, not thread-scoped, and invalidate different React Query keys.

Total expected channels per authenticated client: **2** (messages-multiplex + global-realtime). At ~1k DAU the client-side ceiling is not the bottleneck. The server-side concern at scale is total concurrent sockets and messages/sec throughput on a single channel — see Section 1.

---

## 1. Known ceilings

| Limit | Value | Source |
|---|---|---|
| Channels per connected client | ~200 (practical) | Supabase realtime docs / our architecture review. We use 2. |
| Messages/sec per channel | ~500 on free/pro; higher on team+ | Supabase realtime limits, subject to change. Check the dashboard before assuming. |
| Concurrent connected clients per project | ~10k on pro plan (soft), higher tiers available | Dashboard → Realtime settings. |
| Max payload size per realtime message | 256 KB | Postgres changes payload is the whole row; large columns (long messages, blobs) inflate it. |
| DB replication slot consumers | 1 per realtime replica | Scaling realtime is scaling replication, not just web-tier. |

**At ~1k DAU the practical bottleneck is messages/sec/channel.** If every user sends one message per minute during a busy hour (say 300 concurrent active), that's 5 INSERTs/sec across the one `messages-multiplex` channel, fanned out to every listening client. Still well under the 500/sec ceiling. The headroom disappears if we add typing indicators, read receipts, or reactions as separate INSERT streams through the same channel.

---

## 2. Findings from the 2026-04-17 audit

Source read: `messagesChannel.ts` (183 lines), its test file, `RealtimeProvider.tsx`, `useMessages.useRealtimeMessages`.

### F1. Channel-error amnesia (follow-up, NOT fixed in this pass)

**Severity:** medium. **Symptom under load:** messages silently stop arriving until the user navigates away from all thread detail screens (dropping refCount to 0 and re-creating the channel).

The `.subscribe()` call in `messagesChannel.ts` has **no status callback** (compare against `RealtimeProvider.tsx` which logs CHANNEL_ERROR / TIMED_OUT). On a CHANNEL_ERROR or socket timeout the singleton channel reference is kept; subsequent `subscribeToThreadMessages` calls see `state.channel !== null` and skip re-creation; existing subscribers silently stop receiving events until the last listener unsubscribes.

**Why not fixed in this pass:** a correct fix has to handle the race between an in-flight subscribe and the status-callback-triggered teardown, and has to decide whether to invalidate all live React Query caches on reconnect (otherwise clients have stale views). That is >20 lines and not obviously correct — flagging per the audit constraint.

**Mitigation until fixed:** the Supabase client auto-reconnects the underlying socket on network changes; this only bites when the server closes the *channel* specifically. Incidence expected to be low at current scale. Monitor `CHANNEL_ERROR` counts in the Realtime dashboard (Section 3).

### F2. Auth-token rotation not explicitly handled (low risk)

When Supabase auth refreshes a token mid-session, supabase-js is supposed to propagate it to the realtime socket. There is no explicit test for this in `messagesChannel.test.ts`. If the rotation silently fails on the multiplex channel, the symptom is the same as F1. Not an action item today — just something to rule out first if F1 monitoring starts firing.

### F3. Dispatch map leak on thread deletion (not a bug, worth documenting)

If a thread is deleted server-side while a user has it open, the listener stays registered until the component unmounts. Dispatch for that threadId simply never fires (the Set is empty of fans for a row that never arrives). No leak — RLS filters events, and the Set is GCed on unmount.

### F4. Confirmed safe under the "user opens 50 threads" scenario

With 50 concurrent `useRealtimeMessages` hooks mounted: `refCount` hits 50, `threadListeners.size === 50`, **exactly 1** `supabase.channel()` call. Teardown on last unmount releases cleanly. Test coverage in `messagesChannel.test.ts` exercises this (counts channels after repeated subscribes).

---

## 3. Monitoring

**Graphs to keep on the on-call dashboard:**

| Metric | Source | Alert threshold |
|---|---|---|
| Realtime concurrent clients | Supabase dashboard → Realtime | > 70% of plan limit |
| Messages/sec on `messages-multiplex` channel | Supabase dashboard → Realtime → per-channel stats | > 300/sec sustained (60% of 500/sec ceiling) |
| CHANNEL_ERROR count (client-logged) | Sentry (add a breadcrumb + counter in F1's eventual fix) | > 5 per user per session (p95) |
| WebSocket disconnect rate | Supabase dashboard | > 2% of active clients / 5 min |
| `pg_stat_replication` lag for the realtime slot | Supabase SQL editor / pg_stat_statements | > 10 MB behind for > 1 min |

**Client-side synthetic:** `scripts/load-test-realtime.ts` is the harness to reproduce pressure without touching prod. Run it against a staging project before any feature that adds another INSERT stream (typing indicators, reactions, read receipts). See the script header for usage.

**What "healthy" looks like at 1k DAU:**
- ~300-500 concurrent realtime clients at peak.
- 1-10 INSERTs/sec on the messages channel.
- Zero CHANNEL_ERRORs per user per session in the steady state.

---

## 4. Escalation path

Decision tree, cheapest first:

### Step 1 — Confirm the ceiling is actually the ceiling.

Before scaling anything, verify the symptom. Common false positives:
- A single pathological client in an infinite remount loop (Sentry will show it).
- An edge function accidentally fan-writing 1000 messages per user action (check `ai-generate` logs).
- RLS regression returning too many rows (every client sees events for every thread, fan-out explodes).

Fix the root cause if it's one of these. Do not scale through a bug.

### Step 2 — Tune within the existing project.

- **Upgrade the Supabase plan tier.** Pro → Team raises realtime throughput soft-caps. Coordinate with billing; irreversible within a billing period.
- **Shrink payloads.** If message rows carry large payloads (AI draft metadata, location blobs), consider omitting those from the replicated columns via a publication filter. Requires a migration.

### Step 3 — Add a second realtime project (short-term relief).

Spin up a separate Supabase project purely for realtime fan-out. Application flow:
1. Writes still go to the primary project (single source of truth).
2. A trigger/edge function on primary publishes a stripped-down event to a broadcast channel on the secondary project.
3. Clients subscribe to the secondary for realtime, fetch from primary on demand.

This doubles operational surface area — only do it if Step 2 is exhausted and Step 4 is more than a month away.

### Step 4 — Move to server-side fan-out (medium-term).

Replace the shared `postgres_changes` subscription with a server-owned fan-out:
1. Edge function subscribes to `messages` changes with the service_role key (one consumer, not N).
2. It re-broadcasts on a Supabase `broadcast` channel keyed by `thread_id` or `user_id`.
3. Clients subscribe to `broadcast` channels they care about.

**Why this is better at scale:** `postgres_changes` replays every qualifying row to every client through RLS filtering. `broadcast` is pub/sub — messages go only to subscribed channels, no RLS re-evaluation per delivery. Costs more to operate but scales near-linearly.

### Step 5 — Move realtime off Supabase entirely.

Ably / Pusher / self-hosted (Soketi, Phoenix Channels). Last resort. Commit at least a sprint to migration planning.

**Rule of thumb for when to trigger each step:**
- Step 1: always first.
- Step 2: when sustained load exceeds 50% of plan cap.
- Step 3: when a single project can't hit the target DAU even on the highest tier.
- Step 4: when fan-out cost exceeds compute cost by more than 2x on the Supabase bill.
- Step 5: only if Supabase realtime becomes a correctness problem we can't work around.

---

## 5. Load-test harnesses

- `scripts/load-test-realtime.ts` — Deno script, simulates N clients each subscribing to K threads, reports dropped-message % and channel counts.
- `scripts/load-test-ai-generate.ts` — Deno script, hammers the `ai-generate` edge function under concurrency to verify the 60/hr free / 600/hr pro rate limit actually enforces.
- `scripts/check-query-plans.sql` — EXPLAIN ANALYZE on the 10 hottest user-facing reads. Run against prod on a release cadence.

All three refuse to run in CI (`Deno.env.get('CI')` check at the top) and each has a `// Usage:` header.

---

## 6. Contacts

- **Supabase support (realtime issues):** https://supabase.com/dashboard/support/new — tag the ticket "realtime" for faster triage.
- **On-call:** whoever owns the Sentry issue for the firing alert.
