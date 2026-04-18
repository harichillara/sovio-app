-- ==========================================================================
--   stripe_idempotency
--
--   Creates `processed_stripe_events` as the authoritative idempotency ledger
--   for the billing webhook. Stripe delivery is at-least-once (network
--   retries + manual "Resend" from the Stripe dashboard + replay during
--   Stripe-side recovery windows all re-deliver the same event.id). Without
--   a database-level unique key, two concurrent deliveries could both pass
--   our application-level "already processed?" check and double-apply a
--   subscription update.
--
--   Design:
--     - PK on event_id: Postgres is the single source of truth for
--       "was this already processed?". The webhook does an
--       INSERT ... ON CONFLICT DO NOTHING RETURNING as its *first* DB
--       action after signature verification. If it RETURNs zero rows,
--       the event is a duplicate and the fn short-circuits with 200.
--     - No RLS policies: service_role bypasses RLS, client access is
--       impossible anyway (no ANON_KEY route), and a stray client with
--       the anon key must never see which events we've seen.
--     - Retention: prune rows older than 90 days in the existing
--       retention cron — Stripe's own retry window is 3 days, so 90
--       days is ~30x headroom. See cron_retention handler.
-- ==========================================================================

create table if not exists public.processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

comment on table public.processed_stripe_events is
  'Idempotency ledger for Stripe webhook deliveries. One row per event.id that the billing-webhook fn has successfully processed. Unique PK is the lock — concurrent duplicate deliveries race to INSERT and exactly one wins.';

alter table public.processed_stripe_events enable row level security;
-- deny-by-default: no policies == no client access. service_role bypasses RLS.

-- Index on processed_at to make retention pruning fast.
create index if not exists processed_stripe_events_processed_at_idx
  on public.processed_stripe_events (processed_at);
