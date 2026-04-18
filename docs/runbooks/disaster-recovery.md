# Disaster Recovery Runbook

> **If you are reading this during an incident, read Section 0 first. Don't skip.**

Last reviewed: 2026-04-17
Owner: @harichillara

---

## 0. Decision criteria — do I even run this runbook?

**Run PITR only when ALL of these are true:**

1. Data loss or corruption is **confirmed** (not suspected).
2. The loss is **unrecoverable via application paths** — not "a user deleted their thread" (that's a product feature), but "a bad migration wiped a column" or "someone ran `delete from profiles`".
3. You have an **estimated good timestamp** — the last point at which you know the data was correct. Write it down before touching anything.
4. You have **communicated** with at least one other person (even if just Slack-posting that you're starting).

**If ANY of the above is false: STOP.** Take a snapshot first (Section 3), investigate scope (Section 2), and reconvene.

Bad instinct to suppress: *"let me just restore to 10 minutes ago to be safe."* PITR restores to a **new project** — your live project keeps running. You still have to decide how to reconcile. Restoring prematurely makes that reconciliation harder, not easier.

---

## 1. What Supabase gives us

| Capability | Window | Notes |
|---|---|---|
| **Daily logical backups** | 7 days retained | Free tier. Full `pg_dump` snapshot per day. |
| **Point-In-Time Recovery (PITR)** | 7 days back, 2-minute granularity | **Paid add-on**. Required for tight RPO. |
| **Storage (object) versioning** | Not enabled by default | Enable per-bucket if we start hosting user uploads. |

**RPO target (data-loss tolerance):** 2 minutes, via PITR.
**RTO target (time-to-restore):** 1 hour for a full DB restore; 15 minutes for a table-level reconciliation.

**Known gaps:**
- Edge function logs are retained by Supabase for **7 days** only. Incident postmortem material must be captured to Sentry within that window.
- `auth.users` rows restore with PITR, but **sessions do not** — users must re-login after a restore.
- Storage bucket contents restore via PITR (metadata only if versioning is off).

---

## 2. Triage — what is the scope of damage?

Before restoring anything, answer these three questions **in writing** (Slack thread, incident doc):

1. **What table(s) are affected?** Run:
   ```sql
   -- From Supabase SQL editor on the live (damaged) project
   select n.nspname as schema, c.relname as table, c.reltuples::bigint as est_rows
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' order by est_rows desc limit 50;
   ```
   Compare row counts against the Supabase dashboard's daily metrics.

2. **When did the damage start?** Check:
   - `audit_log` (retention: unlimited) — `select created_at, actor_type, action from audit_log order by created_at desc limit 100;`
   - `pg_stat_activity` — currently running queries.
   - Sentry issue timestamps.

3. **Is the damage still happening?** If yes, **stop the source first**:
   - For a runaway edge function: disable the function (`supabase functions delete` or deploy a no-op build).
   - For a bad migration: revert the deploy that applied it.
   - For compromised credentials: rotate service_role + Stripe + Gemini keys immediately.

---

## 3. Take a snapshot of the current (broken) state

**Always.** Even if you plan to restore. The broken state is forensic evidence.

```bash
# From your workstation, with SUPABASE_DB_URL pointed at the live project.
pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="sovio-incident-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Upload this file to a secure location (1Password vault item, not Slack) before proceeding.

---

## 4. PITR restore (full project)

**Supabase Dashboard → Project Settings → Database → Point in Time Recovery.**

1. Click **Restore**.
2. Pick the recovery timestamp (UTC). Err on the side of **slightly earlier** than the "last known good" time — you can always roll forward with missing writes, but you cannot roll back if you overshoot.
3. Supabase creates a **new project** with the restored DB. **The live project is untouched.**
4. Wait for status `ready` (typically 20–40 min for a small DB).

### After the new project is ready

The new project has its own URL + keys. You have two reconciliation paths:

**Path A — Full swap (catastrophic damage, no usable data in live project).**
   1. Extract writes from the live project between the PITR timestamp and now: `pg_dump --data-only --table=... > delta.sql`. Review carefully — these writes happened *after* the damage started and may themselves be damaged.
   2. Update mobile + web env (`EXPO_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL` in edge-fn secrets) to point at the new project.
   3. Redeploy edge functions to the new project: `supabase functions deploy --project-ref <new-ref>`.
   4. Rotate Stripe webhook endpoint URL in the Stripe dashboard to point at the new project's billing-webhook URL.
   5. Announce: all users must re-login (sessions didn't migrate).

**Path B — Table-level reconciliation (damage scoped to specific tables).** Preferred when possible.
   1. Connect to the new project with `psql` and dump only the affected tables:
      ```bash
      pg_dump "$NEW_PROJECT_URL" --data-only --table=public.plans \
        --file=plans-restored.sql
      ```
   2. On the live project, move current rows aside:
      ```sql
      alter table public.plans rename to plans_broken;
      ```
   3. Import the restored data:
      ```bash
      psql "$LIVE_PROJECT_URL" -f plans-restored.sql
      ```
   4. Reconcile individual rows that had legitimate writes after the PITR timestamp by diffing `plans` against `plans_broken` and merging manually. Log every merge decision.
   5. Once confident, drop `plans_broken`.

---

## 5. Post-incident

1. Within 24 hours: write a postmortem. Template: `docs/postmortems/YYYY-MM-DD-<incident>.md`.
2. Within 7 days: implement the single highest-leverage change that would have prevented this. Don't scope-creep.
3. Within 30 days: run the next scheduled restore drill (Section 6) with this incident as context — did we miss something the runbook should cover?

---

## 6. Monthly restore drill

Cadence: first Monday of every month, 30 min allocated. Rotate among engineers.

**Drill steps:**

1. Pick a non-production project (staging, or spin up a throwaway with `supabase projects create sovio-drill-$(date +%m)`).
2. Apply all migrations: `supabase db push`.
3. Seed synthetic data matching prod volume (script lives at `scripts/seed-drill.sql` — TODO create).
4. Pick a random target timestamp 30–60 minutes in the past.
5. Execute a PITR restore to that timestamp.
6. Verify: row counts match expected, RLS still works (run `supabase/tests/integration/rls-matrix.ts`), cron jobs resume.
7. **Time yourself.** Log actual RTO in `docs/drills/YYYY-MM.md`. If RTO > 60 min, that's a runbook gap — fix it.
8. Tear down: `supabase projects delete sovio-drill-<month>`.

---

## 7. Rollback: bad migration applied to live

Scenario: a migration in `supabase/migrations/` ran in production and broke something, but no data loss yet.

**Option A — Forward fix (preferred).** Write a new migration that reverses the damage. Migrations are append-only; there are no down-migrations.

**Option B — PITR only if forward fix isn't tractable.** See Section 4.

Never `DELETE FROM supabase_migrations.schema_migrations WHERE version = '...'` to "un-apply" a migration — the schema change still happened; you'd just hide it from the migration tracker.

---

## 8. Contacts

- **Supabase support:** https://supabase.com/dashboard/support/new (response SLA depends on plan)
- **Stripe support:** https://support.stripe.com (for webhook replay assistance)
- **Sentry:** alerts fire to the configured notification channels; issue URL format `https://sovio.sentry.io/issues/{id}`

---

## Appendix: Commands reference

```bash
# Connect to the live DB
export SUPABASE_DB_URL="postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
psql "$SUPABASE_DB_URL"

# List recent migrations
supabase migration list --linked

# Diff migrations against live
supabase db diff --linked --schema public

# Snapshot (incident forensics)
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges --file=snapshot.dump

# Restore from snapshot to a fresh project
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$NEW_PROJECT_URL" snapshot.dump
```
