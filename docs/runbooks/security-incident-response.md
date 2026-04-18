# Security Incident Response Runbook

> **If you are reading this during an incident, read Section 0 first. Don't skip.**

Last reviewed: 2026-04-17
Owner: @harichillara

---

## 0. Is this actually a security incident?

Three things get called "security incidents." Only one is.

**Security incident — run this runbook.** Unauthorized access occurred, is occurring, or is credibly imminent. Examples:
- A secret (service_role, Gemini, Stripe) is confirmed leaked (Git, Sentry, logs, a screenshot in Slack).
- Unknown entity performed writes in `audit_log` or `auth.users`.
- An edge function is being exploited — abnormal traffic shape, unexpected outbound calls, cost spike.
- PII is observably outside our system.

**Bug — do NOT run this runbook. File a P0/P1 and write a migration.** An RLS policy is wrong, a function is missing `auth.uid()` checks, a webhook signature check was skipped. Caught internally, no evidence of exploitation. Action: fix forward + postmortem via Section 5. Skip containment.

**Support ticket — do NOT run this runbook.** User says "my account was hacked" but the evidence is a forgotten password, a family member logged in, or a legitimate but unwanted charge. Route to support. Only escalate if the user provides evidence of credential compromise you cannot explain (unknown IP, unknown device, writes they didn't make).

**The gate:** real incident = containment in next 30 min. Bug = migration in next few days. Support = no engineering action.

If uncertain: **treat as incident** until you have evidence otherwise. Over-rotating a key costs an hour. Under-rotating a leaked key costs the company.

---

## 1. Severity triage

Pick severity first, before containment. Severity drives who you wake up.

| Level | Definition | Sovio examples |
|---|---|---|
| **SEV-1** | Active, ongoing, or unbounded compromise. Service-role access, mass data, or money at stake. | `SUPABASE_SERVICE_ROLE_KEY` leaked; active RCE in an edge function; bulk PII exfiltration confirmed in logs; Stripe billing bypass affecting >10 users or >$X; JWT secret suspected compromised. |
| **SEV-2** | Scoped compromise, bounded blast radius, no spread. | Single-user account takeover; targeted phishing of one Sovio user; Gemini quota exhausted by abuse (single key, single function); one edge function returning 500s under a fuzzing campaign. |
| **SEV-3** | Suspicious but contained. Worth logging, not worth waking anyone. | One rate-limit violation; anomalous Sentry error that could be probing; a single 401 pattern that doesn't escalate. |

**Escalation:** SEV-1 wakes the owner immediately. SEV-2 gets a Slack ping, handled within business hours unless it escalates. SEV-3 gets a ticket.

**If severity is unclear, pick the higher one.** You can downgrade later.

---

## 2. Immediate containment (first 30 min)

Run in this order. **Time-box each step to 5 minutes.** If a step is failing, move to the next and come back.

### 2.1 Start an incident thread

Slack: `#incidents`. Post: severity, one-line summary, you as IC. Pin the thread. Every action goes in this thread with a timestamp (UTC).

### 2.2 Snapshot the evidence BEFORE rotating

Rotation destroys forensic value. First, capture:
- Screenshot the leaked surface (Git commit, log line, Sentry issue URL).
- Export recent edge function logs (see Section 3.5 — they expire in 7 days).
- `pg_dump` a snapshot per `disaster-recovery.md` Section 3.

### 2.3 Rotate the compromised secret

**`SUPABASE_SERVICE_ROLE_KEY` (CATASTROPHIC — bypasses RLS, can read/write anything):**

1. Supabase Dashboard → Project Settings → API → **Reset** under `service_role` secret. Copy new value.
2. Update edge-fn secrets:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<new-value>" --project-ref <ref>
   ```
3. Force redeploy every edge function (they cache secrets in memory):
   ```bash
   supabase functions deploy ai-generate --project-ref <ref>
   supabase functions deploy billing-webhook --project-ref <ref>
   supabase functions deploy intent-refresh --project-ref <ref>
   supabase functions deploy matchmaker --project-ref <ref>
   supabase functions deploy moderation --project-ref <ref>
   supabase functions deploy notify --project-ref <ref>
   ```
4. Verify: hit ai-generate with a test user, check Sentry for new errors.
5. Grep the repo for any other place the key was referenced:
   ```bash
   git log --all -p -S "SUPABASE_SERVICE_ROLE_KEY" | head -200
   ```

**`GEMINI_API_KEY`:**

1. Google Cloud Console → APIs & Services → Credentials → find the key → **Regenerate** (or delete and create new).
2. `supabase secrets set GEMINI_API_KEY="<new-value>" --project-ref <ref>`
3. Redeploy ai-generate and moderation (only functions that use it).
4. Old key remains valid for a few minutes on Google's side — expect a small window of both-working.

**`STRIPE_WEBHOOK_SECRET`:**

1. Stripe Dashboard → Developers → Webhooks → select our endpoint → **Roll secret**. Choose a short expiry (1 hour) for the old one.
2. `supabase secrets set STRIPE_WEBHOOK_SECRET="<new-value>" --project-ref <ref>`
3. Redeploy billing-webhook.
4. Test: in Stripe dashboard, send a test event. Confirm 200 response.

**`STRIPE_SECRET_KEY` (once billing is live):**

1. Stripe Dashboard → Developers → API keys → **Roll** the restricted/secret key.
2. `supabase secrets set STRIPE_SECRET_KEY="<new-value>"`
3. Redeploy any function that calls Stripe API.
4. Audit Stripe dashboard Events tab for unauthorized calls made with the old key.

**`SENTRY_DSN`:** Lower sensitivity — it only authorizes event ingestion. Rotation is optional unless attacker is spamming Sentry with garbage events. If needed: Sentry → Settings → Projects → Client Keys → rotate. Update `SENTRY_DSN` in Vercel env, Expo EAS env, and edge-fn secrets. Redeploy all three surfaces.

**`EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`:** These are shipped to clients and are safe **only if RLS is correct**. If you suspect RLS is broken, rotating the anon key alone does nothing — ship apps still carry the key. The fix is a migration that tightens RLS, not a rotation. If a shipped app version leaks data because of an RLS hole, treat as SEV-1 and follow Section 4 for user notification.

### 2.4 Disable an edge function under active attack

If a specific function is being exploited and you can't fix it in minutes:

```bash
# Nuclear option — deletes the function entirely (returns 404 to callers):
supabase functions delete <name> --project-ref <ref>
```

Preferred: deploy a 503 no-op so clients get a clear shutdown signal. Create `supabase/functions/<name>/index.ts` with:
```ts
export default () => new Response("Service temporarily unavailable", { status: 503 });
```
Then `supabase functions deploy <name> --project-ref <ref>`.

### 2.5 Kicking all user sessions

**Supabase does not expose a global session revoke.** `update auth.users set last_sign_in_at = now()` does **not** invalidate JWTs — JWTs are stateless and valid until their `exp` claim.

The only workaround is rotating the **JWT secret** (Supabase Dashboard → Settings → API → JWT Settings → Generate new secret). This invalidates **every** session for **every** user across mobile and web. Every user must re-login. This is SEV-1-grade disruption; only do it if:
- `SUPABASE_SERVICE_ROLE_KEY` leaked AND you believe attacker minted rogue JWTs, OR
- The JWT secret itself leaked.

Single-user kick: revoke their refresh tokens via `auth.refresh_tokens` — note the access token still lives until its `exp` (default 1 hour):
```sql
delete from auth.refresh_tokens where user_id = '<uuid>';
```

---

## 3. Forensics (first 2 hours)

Goal: reconstruct what the attacker did, what they accessed, and whether they still have access via a secondary vector.

### 3.1 Recent admin actions — `audit_log`

Unlimited retention. Start here.

```sql
select created_at, actor_type, actor_id, action, resource_type, resource_id, metadata
from audit_log
where created_at > now() - interval '48 hours'
order by created_at desc
limit 500;
```

Filter to a suspect actor:
```sql
select * from audit_log where actor_id = '<uuid>' order by created_at desc;
```

**Known gap:** `service_role` actions are NOT automatically written to `audit_log`. A compromised service_role key can read/write without leaving a row here. Cross-reference with `pg_stat_statements` and edge-fn logs to cover this blind spot.

### 3.2 Per-user anomalies — `app_events`

90-day retention (expires via cron). Capture relevant windows to cold storage now:

```sql
copy (
  select * from app_events
  where user_id = '<uuid>' and created_at > now() - interval '30 days'
) to stdout with csv header;
```

Common patterns:
```sql
-- Logins from new IPs
select user_id, metadata->>'ip' as ip, count(*)
from app_events
where event_type = 'auth.login' and created_at > now() - interval '7 days'
group by 1, 2 order by 3 desc;

-- High-velocity writes (scraping, exfiltration)
select user_id, count(*) as events, min(created_at), max(created_at)
from app_events
where created_at > now() - interval '1 hour'
group by 1 having count(*) > 100 order by 2 desc;
```

### 3.3 Currently-running queries — `pg_stat_activity`

```sql
select pid, usename, application_name, client_addr, state, query_start, query
from pg_stat_activity
where state != 'idle' and pid != pg_backend_pid()
order by query_start;
```

Kill a runaway:
```sql
select pg_cancel_backend(<pid>);   -- graceful
select pg_terminate_backend(<pid>);  -- forceful
```

### 3.4 Sentry

Filter by the incident window, both projects (`sovio-web`, `sovio-mobile`, `sovio-edge-fns`):
- Issue URL format: `https://sovio.sentry.io/issues/?query=&statsPeriod=24h&project=<id>`
- For an edge function: `https://sovio.sentry.io/issues/?query=tag%3Afunction%3A<name>`
- Export a saved search to JSON via the Sentry API — Sentry retains longer than our DB does.

### 3.5 Supabase edge-fn logs (7-day window — this is a hard forensics ceiling)

**Capture immediately if the incident window is approaching 7 days.** Logs older than 7 days are gone.

```bash
# Download last 7 days of logs for one function
supabase functions logs ai-generate --project-ref <ref> --since 7d > ai-generate-logs.jsonl
```

Repeat for all six functions. Upload to the incident 1Password item.

### 3.6 Rogue service-role usage check

Since service_role actions don't hit `audit_log`, look indirectly:

```sql
-- Recent DDL from pg_stat_statements (schema-level changes):
select query, calls, total_exec_time, last_call
from pg_stat_statements
where query ilike '%alter%' or query ilike '%drop%' or query ilike '%create%'
order by last_call desc nulls last limit 50;
```

Cross-reference the edge-fn logs for unusual patterns: unexpected function invocations, anomalous row counts in responses, calls from unknown IPs (though with edge fns client IPs come from request headers, not direct).

---

## 4. Notification

**Order matters.** Containment first, internal second, external third. Do not skip ahead.

### 4.1 Internal — Slack `#incidents`

Post a status update every 30 min during active response, every 2 hours once contained. Template:

> **[SEV-N] <one-line>**
> IC: @person
> Status: {investigating | contained | resolved}
> Impact: <users affected, data types>
> Next update: <time>

**Blameless framing.** Write about the system, not the person. "The deploy pipeline shipped the staging secret to prod" not "Alice shipped the staging secret to prod."

### 4.2 Users

**Only after containment.** Notifying users about a live incident before it's contained invites panic and phishing copycats.

Required when:
- PII (email, name, free-text they wrote) was accessed by an unauthorized party. GDPR: within **72 hours** of becoming aware. CCPA: notice-on-request (no fixed window, but don't sit on it).
- Credentials (even hashed) were exfiltrated — force password reset.
- Financial records were read or altered.

Not required when:
- Only internal telemetry was exposed (app_events aggregate counters, not per-user content).
- The compromise was contained before any user data was read (rare — you need evidence).

**Template (adapt per incident):**

> Subject: Important security update about your Sovio account
>
> Hi [name],
>
> On [date UTC], we detected unauthorized access to [system]. We contained the incident within [duration] and are writing to be transparent about what happened.
>
> **What was affected:** [specific data types — "your email address and the content of threads you wrote" not "account data"]
> **What was not affected:** [explicit — "your payment information, which is stored by Stripe, was not accessed"]
> **What we've done:** [rotation, patching, monitoring]
> **What you should do:** [reset password at <link>, review recent account activity at <link>]
>
> We're sorry this happened. If you have questions, reply to this email.
>
> — The Sovio team

### 4.3 Stripe

If the billing system is compromised (leaked Stripe keys, webhook tampering, fraudulent charges): open a support ticket at https://support.stripe.com with the incident summary and ask for:
- Event log for the affected date range
- Disable the compromised key on their side (belt-and-suspenders to our rotation)
- Guidance on customer refunds if fraudulent charges went through

### 4.4 Apple / Google (app stores)

Only if a **shipped app version** leaks user data (e.g., a bad SDK version sending data to an unauthorized third party) or the compromise requires pulling an app version.

- Apple: https://developer.apple.com/contact/ → Account & Organization → Security
- Google: https://support.google.com/googleplay/android-developer/answer/7663230 (Play Console → Help → Contact support → Security)

Expect 24–48 hour response. Do not skip this for data-leak incidents — store teams can expedite removal.

---

## 5. Postmortem template

Write within 5 business days. File at `docs/postmortems/YYYY-MM-DD-<incident-slug>.md`.

Required sections:

- **Summary** — two sentences. What, when, who was affected.
- **Timeline (UTC)** — every timestamp from the Slack thread. Detection → escalation → containment → recovery → notification.
- **Impact** — users affected (count + percentage), data types accessed, duration of exposure, financial impact if any.
- **Root cause** — the technical fault. Not "Alice ran the wrong script" — "the deploy pipeline did not distinguish between staging and prod secrets."
- **Contributing factors** — what made the incident worse or harder to detect. Missing alerts, unclear runbook, ambiguous ownership.
- **What went well** — real positives. Detection was fast, rotation worked first try, team communicated clearly.
- **What didn't** — honest. Took too long to find the right secret, couldn't parse edge-fn logs, ran the wrong SQL.
- **Action items** — each: owner, due date, linked issue. Prefer 3 well-scoped actions over 15 aspirational ones.

Blameless. The goal is "how do we prevent this class of failure," not "who messed up."

---

## 6. Quarterly key rotation drill

**Cadence:** first Monday of each quarter (Jan, Apr, Jul, Oct). 60 min allocated.

**Owner rotation:** whoever ran the previous drill hands off to the next engineer alphabetically.

**Steps:**

1. Announce in `#engineering` 24h before: "Rotating `GEMINI_API_KEY` and `STRIPE_WEBHOOK_SECRET` Monday at 14:00 UTC. Expect possible 1-min blip in ai-generate and billing-webhook."
2. Rotate `GEMINI_API_KEY` per Section 2.3.
3. Rotate `STRIPE_WEBHOOK_SECRET` per Section 2.3.
4. **Don't rotate `SUPABASE_SERVICE_ROLE_KEY` in a drill** — too high-risk; only rotate in a real incident or once-a-year planned maintenance.
5. Verify end-to-end:
   - `curl` a real ai-generate request with a test user JWT. Expect 200 + Gemini response.
   - Send a Stripe test event from the Stripe dashboard. Expect 200 from billing-webhook, row in `billing_events`.
   - Trigger a deliberate error in the web app (`throw new Error('sentry-rotation-drill')`). Confirm it appears in Sentry.
6. Log the drill at `docs/drills/YYYY-QN-keyrotation.md`: actual duration, any surprises, runbook gaps.
7. If any verification fails, that's a SEV-2 — resolve before leaving the drill.

---

## 7. Contacts

- **Supabase support:** https://supabase.com/dashboard/support/new
- **Stripe support:** https://support.stripe.com
- **Google Cloud support (Gemini):** https://console.cloud.google.com/support
- **Sentry:** alerts fire to configured channels; issue URL format `https://sovio.sentry.io/issues/{id}`
- **Apple security:** https://developer.apple.com/contact/
- **Google Play security:** https://support.google.com/googleplay/android-developer (Security category)
- **GDPR DPA (EU):** contact through ICO portal if UK users affected, or lead authority per Art. 56 for EU

---

## Appendix: Commands reference

```bash
# Project ref lookup (need this for every command below)
supabase projects list

# Set any edge-fn secret
supabase secrets set KEY_NAME="value" --project-ref <ref>

# List current edge-fn secrets (names only, values hidden)
supabase secrets list --project-ref <ref>

# Unset a secret
supabase secrets unset KEY_NAME --project-ref <ref>

# Redeploy one function (picks up new secrets)
supabase functions deploy <name> --project-ref <ref>

# Redeploy ALL Sovio functions (after service_role rotation)
for fn in ai-generate billing-webhook intent-refresh matchmaker moderation notify; do
  supabase functions deploy "$fn" --project-ref <ref>
done

# Download logs for forensics (7-day ceiling)
supabase functions logs <name> --project-ref <ref> --since 7d > <name>-logs.jsonl

# Disable a function under attack
supabase functions delete <name> --project-ref <ref>

# Force-revoke refresh tokens for one user (access JWT still valid until exp)
psql "$SUPABASE_DB_URL" -c "delete from auth.refresh_tokens where user_id = '<uuid>';"

# Search git history for a leaked string
git log --all -p -S "<leaked-fragment>" | head -200

# Kill a runaway DB query
psql "$SUPABASE_DB_URL" -c "select pg_terminate_backend(<pid>);"

# Snapshot DB for forensics
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --file="sovio-incident-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

---

## Appendix: Security posture controls

Covers the three gaps identified in the Phase-4+ posture audit that are
configured **outside the code repo** — operational controls that need
owners, cadences, and periodic verification rather than pull requests.
Review this appendix at the same time as the IR tabletop (quarterly).

### A. Auth-callback abuse (Gap 1)

**Surface:** Supabase's hosted `/auth/v1/*` endpoints (sign-in, OAuth exchange,
password reset, magic-link). We **do not expose our own callback route** —
Supabase JS handles the OAuth exchange client-side via `exchangeCodeForSession`,
so there is no Next.js or edge-fn endpoint to rate-limit. That puts abuse
mitigation squarely on Supabase's dashboard controls.

**Controls to verify (Supabase Dashboard → Authentication → Rate Limits):**

| Control | Default | Target | Rationale |
|---|---|---|---|
| Sign-ups per IP / hour | 30 | 10 | Blocks scripted signup floods. |
| Sign-ins (failed) per IP / 5 min | 5 | 5 | Default is fine — don't over-tune or locks real users. |
| Magic link / OTP per address / hour | 30 | 5 | Stops email-bombing attacks via our From: domain. |
| Password reset per address / hour | 30 | 3 | Same reasoning — mailbox abuse protection. |
| Token refresh per session / hour | — | Leave default | Legit apps burn many refreshes. |

**Owner:** Auth owner (see rotation below).
**Cadence:** Verify on dashboard every 30 days; after every Supabase minor
upgrade (defaults can shift).
**Signal of abuse:** spike in `auth.users` inserts with no follow-on
`app_events`; spike in `auth.audit_log_entries` with `action='otp_requested'`.

```sql
-- 15-min smoke query to spot signup/OTP abuse
select date_trunc('hour', created_at) as hour,
       raw_user_meta_data->>'ip' as ip,
       count(*)
  from auth.users
 where created_at > now() - interval '24 hours'
 group by 1, 2
 order by 3 desc
 limit 20;
```

If the dashboard caps are being hit in legitimate traffic, add a
Vercel-Firewall (section B) rule on the sign-in page route rather than
loosening Supabase's limits.

### B. WAF / bot protection (Gap 4)

**Web tier (apps/web):** Vercel Firewall is the control plane. It sits
in front of the Next.js deployment and evaluates before any route runs.

**Required Vercel Firewall rules** (configured at
`https://vercel.com/<team>/sovio-web/settings/firewall`):

1. **Rate-limit `POST /api/*`** — 30 rpm per IP, challenge above.
   Catches anyone trying to abuse our server actions / API routes that
   ultimately call Supabase edge fns.
2. **Challenge non-US/EU traffic to `/auth/*`** — optional, enable
   only if abuse pattern confirms geographic source. Don't default-on;
   legitimate users travel.
3. **Block known-bot UAs on `/`** — Vercel has a managed bot list;
   enable "Managed Challenge" mode, not "Block", to avoid false positives
   on scrapers we want (Open Graph previews, Slack unfurls).
4. **Rate-limit `/login`, `/signup` pages** — 10 rpm per IP. Mirrors
   the Supabase dashboard caps from section A so Vercel absorbs the
   traffic before Supabase sees it.

**Supabase tier (edge functions):** There is no WAF in front of
`*.functions.supabase.co`. Our defense is:
  - `_shared/rate-limit.ts` (Phase 3 Task 16) — per-user/per-IP sliding
    windows enforced in Postgres (`rate_limit_counters`).
  - `authenticateUser` on every user-facing edge fn — rejects without
    a valid JWT before spending Gemini tokens.
  - Service-role gate on cron endpoints — string equality on the
    Authorization header.

If abuse pattern ever reaches the edge fns directly (bypassing web),
the escalation is **Cloudflare in front of Supabase**: proxy the
`<project>.functions.supabase.co` hostname through a CNAME on a domain
we control, then apply Cloudflare's WAF + Bot Fight Mode. Not enabled
today — cost + complexity not justified pre-public-launch.

**Owner:** Platform owner.
**Cadence:** Review Vercel Firewall analytics every 30 days. Verify
rules in a post-deploy smoke after every `apps/web` production deploy
(ensures nothing deleted the rules).

### C. On-call paging rotation (Gap 5)

**Why:** Sentry alerts + Supabase log drain alerts need to reach a human
within minutes. Today all alerts route to founders' email — which is
paging on a best-effort basis, not an SLA. An incident at 2am Saturday
fails silently.

**Rotation structure** (until headcount justifies a proper PagerDuty tier):

| Role | Owner (today) | Backup | Pages for |
|---|---|---|---|
| **Primary on-call** | harichillara@gmail.com | — | All Sentry P1/P2, edge-fn 5xx spikes, Supabase project downtime, `billing-webhook` failures, RLS denial anomalies. |
| **Auth owner** | harichillara@gmail.com | — | Auth-callback abuse alerts (section A), forced-logout events, service-role-key usage anomalies. |
| **Platform owner** | harichillara@gmail.com | — | Vercel Firewall anomalies (section B), deploy rollbacks, CDN/DNS issues. |
| **Data owner** | harichillara@gmail.com | — | pg_cron failures, migration drift, DB CPU > 80% sustained. |

Single-owner today is a known risk and is the *main reason* this
appendix exists — to make the gap visible rather than implicit. When
the team grows past one, fan these out and verify each alert rule still
reaches someone.

**Escalation ladder (tune once a second person joins):**
1. **T+0** — Sentry/alert fires → email + (future) SMS to Primary.
2. **T+15 min** — No ack → page Backup.
3. **T+30 min** — No ack → declare incident, post to status page,
   follow the IR playbook above.

**Page routes to configure:**
  - Sentry → PagerDuty integration (deferred; today: email-only).
  - Supabase log drain → Logflare → email digest (daily), SMS on
    rule-match (critical only: `billing-webhook` 5xx, service-role
    auth failures).
  - Vercel deploy failures → webhook into `#deploys` (when a team
    Slack exists; deferred).

**Cadence:** Tabletop every 90 days walks this rotation end-to-end —
fire a synthetic Sentry event, confirm it reaches the primary, confirm
the IR runbook commands still work. Log the outcome in the internal
security log.

**Signal this appendix is stale:** ownership row says "today" for >60
days without review, or the tabletop hasn't been run in the last
quarter. Either condition → open a follow-up task and revisit.
