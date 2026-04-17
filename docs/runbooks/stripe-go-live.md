# Stripe Go-Live Runbook

> **If you are reading this because you want to flip Stripe from staged to live, read Section 0 first. Don't skip.**

Last reviewed: 2026-04-17
Owner: @harichillara

---

## 0. Pre-flight gate

**Do not run this runbook unless ALL of the following are true:**

1. The `processed_stripe_events` migration (`20260417040000_stripe_idempotency.sql`) has been applied to the target project. Verify: `supabase migration list --linked | grep stripe_idempotency`.
2. The `billing-webhook` edge function is deployed and currently responds `200 { mode: "staged" }` to a test POST.
3. A **Stripe account** exists, identity verification is complete, and payouts are enabled. Check: https://dashboard.stripe.com/settings/account.
4. You have access to `supabase secrets` for the target project (`supabase projects list` shows it and you can run `supabase secrets list --project-ref <ref>` without error).
5. You have a **real personal card** available for the smoke test in Section 4, and you're prepared to refund your own charge afterward.
6. At least one other person knows you're running this (Slack post, incident-channel ping — just a paper trail).

**If ANY of the above is false: STOP.** Close this document and resolve the gap first.

Bad instinct to suppress: *"let me flip it on first and smoke-test later."* Going live means real webhooks start mutating real `entitlements` rows. A bad secret, a missing migration, or a dashboard endpoint pointed at the wrong URL all produce silent failures that are harder to diagnose once traffic is flowing.

---

## 1. Stripe Dashboard setup

Work in **live mode** (toggle top-left of the dashboard). Test-mode setup is fine for rehearsal but the secrets provisioned below must be the live-mode ones.

### 1.1 Create the Pro product

1. Dashboard → **Products** → **Add product**.
2. Name: `Sovio Pro`.
3. Description: `Sovio Pro subscription — unlocks Presence Score history, unlimited drafts, weekly insights.`
4. Save.

### 1.2 Create prices

Two recurring prices on the same product:

1. **Monthly:** Amount set per current pricing page, **Recurring**, **Billing period = Monthly**, Currency `usd`.
2. **Annual:** Amount set per current pricing page, **Recurring**, **Billing period = Yearly**, Currency `usd`.

Record both **Price IDs** (`price_...`) — they go in the client checkout config, not in this runbook.

### 1.3 Create the webhook endpoint

1. Dashboard → **Developers** → **Webhooks** → **Add endpoint**.
2. Endpoint URL: `https://<project-ref>.functions.supabase.co/billing-webhook` (replace `<project-ref>` with the live project's ref).
3. API version: leave at the account default (the handler is version-tolerant via the zod `.passthrough()` schemas).
4. **Events to send** — select exactly these three:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click **Add endpoint**.
6. On the endpoint's page, click **Reveal** under **Signing secret**. Copy the `whsec_...` value — you'll need it in Section 2.

---

## 2. Secret provisioning

Run these against the live Supabase project. **`--project-ref` is load-bearing — an accidental staging ref here will look like it worked and silently misroute webhooks.**

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME --project-ref <ref>
supabase secrets set STRIPE_SECRET_KEY=sk_live_REPLACE_ME --project-ref <ref>
supabase secrets set STRIPE_READY=true --project-ref <ref>
```

Verify all three are present:

```bash
supabase secrets list --project-ref <ref>
```

Expected output contains `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_READY`. The values are redacted in the list output — that's fine, only presence matters here.

---

## 3. Deploy

```bash
supabase functions deploy billing-webhook --project-ref <ref>
```

Confirm the new revision is live by hitting the endpoint with an unsigned body — it should now return **401** (`Missing stripe-signature header`) rather than the previous **200 staged** response. That 401 is the signal the live path is active.

```bash
curl -i -X POST "https://<ref>.functions.supabase.co/billing-webhook" \
  -H "Content-Type: application/json" \
  -d '{}'
```

If this still returns `{"received":true,"mode":"staged"}`: either the deploy didn't take, `STRIPE_READY` isn't set, or `STRIPE_WEBHOOK_SECRET` is empty (the fail-safe forced back to staged — check `supabase functions logs billing-webhook` for `stripe_ready_without_secret`).

---

## 4. Smoke test

Use a **real personal card**. Stripe test cards will not work against a live-mode account.

### 4.1 Create a $1 throwaway product

1. Stripe Dashboard (live mode) → Products → Add product → name `Go-live smoke test`, price `$1.00`, one-time (or monthly — either works).
2. Create a payment link for it: Products → the throwaway → **Create payment link**.

### 4.2 Run through checkout

1. Open the payment link in an incognito window.
2. **Crucially**: attach a `user_id` via metadata. Easiest path — use the same checkout-session creation flow the app uses (`billing.service.ts` → `createCheckoutSession`) with a known test user's UUID. The raw payment link won't carry `metadata.user_id` and the webhook will no-op on it (by design).
3. Complete checkout with your real card.

### 4.3 Verify DB state

```sql
-- Replace <user_id> with the test user's UUID.
select user_id, plan, status, pro_until, stripe_customer_id, stripe_subscription_id
from public.entitlements
where user_id = '<user_id>';

select id, subscription_tier from public.profiles where id = '<user_id>';

select event_id, event_type, processed_at
from public.processed_stripe_events
order by processed_at desc limit 5;

select created_at, action, target
from public.audit_log
where action like 'stripe_%'
order by created_at desc limit 5;
```

Expected: `entitlements.plan = 'pro'`, `entitlements.status = 'active'`, `profiles.subscription_tier = 'pro'`, one `checkout.session.completed` row in `processed_stripe_events`, one `stripe_checkout.session.completed` row in `audit_log`.

### 4.4 Cancel + refund

1. Stripe Dashboard → Customers → your customer → cancel the subscription (if recurring). This fires `customer.subscription.deleted`.
2. Dashboard → Payments → find the $1 charge → **Refund**.
3. Re-run the SQL above. Expected: `entitlements.plan = 'free'`, `status = 'canceled'`, `pro_until = null`, `profiles.subscription_tier = 'free'`.
4. Delete the throwaway product from the Stripe dashboard.

If any assertion above fails: jump straight to Section 6 (rollback) and investigate in staged mode.

---

## 5. First 48 hours

Watch these four signals. Set a calendar reminder to check at +2h, +12h, +24h, +48h.

- **Sentry error rate on `fn:billing-webhook`**: https://sovio.sentry.io/issues/?query=fn%3Abilling-webhook. Any sustained 5xx rate above ~1% is a problem. Signature-verification failures land here too — expected volume is near-zero.
- **`audit_log` growth**: `select count(*) from audit_log where action like 'stripe_%' and created_at > now() - interval '1 hour';` — should roughly match your checkout volume.
- **`processed_stripe_events` row count**: `select count(*), max(processed_at) from processed_stripe_events;` — should monotonically increase. A flat counter while Stripe dashboard shows deliveries means webhooks are 4xx'ing before the idempotency insert.
- **Supabase function logs**: `supabase functions logs billing-webhook --project-ref <ref> | grep -i error` — any 500 entries want reading.

Cross-check in the Stripe dashboard: **Developers → Webhooks → <endpoint> → Events tab.** Every event there should show HTTP 200 from our endpoint. Non-200s are retried by Stripe for up to 3 days — don't let them accumulate.

---

## 6. Rollback

The safe, instant revert:

```bash
supabase secrets unset STRIPE_READY --project-ref <ref>
```

This takes effect on the next function invocation (cold start is ~1–2s; warm instances pick up the new env on their next cold start — force it with `supabase functions deploy billing-webhook --project-ref <ref>` if you need it immediately). Within <30s, the webhook flips back to `{ received: true, mode: "staged" }` for all incoming events.

**What this does NOT do:**

- It does not cancel anyone's Stripe subscription. Active subscriptions keep billing on Stripe's side; customers retain access on Stripe's records.
- It does not revert `entitlements` rows already written during the live window. Those are correct data — leave them alone.

**What it DOES do:**

- All incoming webhook events get 200-acknowledged but not applied to our DB. State drifts between Stripe and our `entitlements` table for the duration of the outage.

### 6.1 Reconciliation after a rollback

Once you've diagnosed and fixed the issue, before flipping back on:

1. In the Stripe dashboard → **Developers → Events**, filter by date range covering the outage. Export the event list (CSV).
2. Cross-reference against our DB:
   ```sql
   select event_id from public.processed_stripe_events
   where processed_at between '<outage-start>' and '<outage-end>';
   ```
3. For each Stripe event ID NOT present in our table, **replay it**: Dashboard → Events → click the event → **Resend** (top-right). The idempotency table guarantees a replay of an event we *did* process is a harmless no-op.
4. Flip `STRIPE_READY=true` again and watch the live path absorb the replay queue.

Stripe retains events for 30 days, so reconciliation must happen inside that window. If the outage exceeds 30 days, escalate to Stripe support (`https://support.stripe.com`) for a longer event export.

---

## 7. Contacts

- **Stripe support:** https://support.stripe.com
- **Supabase support:** https://supabase.com/dashboard/support/new
- **Sentry:** https://sovio.sentry.io
