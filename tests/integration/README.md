# Integration tests (live Supabase)

These tests run against a **live Supabase project** and assert that Row Level
Security actually blocks cross-user access. They're opt-in because they
require credentials and they touch a real database.

## Safety contract

The suite is fenced so it cannot damage anything it didn't create:

1. **Ephemeral users only.** Every test user is created with email
   `rls-test-<uuid>@sovio.test` and the metadata flag `rls_test=true`.
2. **Pattern-gated teardown.** `deleteTestUser` refuses to delete anything
   that doesn't match `/^rls-test-[0-9a-f-]+@sovio\.test$/`. A test suite
   bug cannot wipe real users.
3. **Pre- and post-sweep.** `setup.ts` sweeps leaked test users at the
   start (from prior crashed runs) and end of every run.
4. **No DDL, no TRUNCATE, no schema mutations.** Tests only INSERT, SELECT,
   UPDATE, DELETE on rows they created.
5. **Serial execution.** `fileParallelism: false` in `vitest.config.ts`
   means one test at a time — no race conditions.

## Running against free-tier Supabase

Free tier is fine for this suite. Constraints you should know about:

- **No DB branching.** These tests run against your actual project. The
  safety contract above is your entire isolation.
- **Pause after 7 days idle.** If the project has been paused, the first
  test-user creation will take ~30s to wake it up. Subsequent runs are fast.
- **MAU counting.** Test users count toward your MAU cap (50k on free).
  Teardown deletes them each run, and MAU resets monthly. Non-issue unless
  you're already near the cap.
- **No PITR.** If a test ever does destructive DDL (it doesn't, but worth
  knowing), there's no rollback. The safety contract above is hard-enforced
  in code to make this structurally impossible.

When you upgrade to Pro and get branching, point these at a preview branch
instead — no code changes needed.

## Running locally

```bash
# One-time setup
cp tests/integration/.env.example tests/integration/.env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# (find these in Dashboard → Settings → API)

# From repo root — on Windows pnpm, you may need the -w flag:
pnpm test:integration           # macOS / Linux
pnpm -w run test:integration    # Windows (pnpm resolves scripts differently)
```

## Running in CI

Wire these three secrets (Repo → Settings → Secrets → Actions):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Then invoke `pnpm test:integration` in a workflow step. See
`.github/workflows/ci.yml` (create if missing).

## What this suite asserts

- `messages`: user A cannot read or forge-insert messages into user B's
  thread.
- `entitlements`: user A cannot SELECT user B's row; user A cannot UPDATE
  their own plan to `pro` (server-only writes).
- `ai_jobs`: user A cannot read user B's jobs.
- `profiles`: user A **can** read user B's profile (positive test for the
  intentional social-app open-read policy).
- `get_nearby_available_friends`: user A cannot pass `viewer_id=B` (the
  null-uid bypass from the pt4 audit must stay closed).
- `notify_insert_and_push`, `apply_beta_pro_access`: authenticated role has
  no EXECUTE grant (pt4 revoke must stay in effect).

## Adding new tests

Keep new tests inside the same safety contract:

- Don't touch rows you didn't create. If you need seed data, use the
  admin client in `beforeAll` and clean it up in `afterAll`.
- Don't bypass the email pattern. If you legitimately need another fixture
  user, use `createTestUser(admin, 'label')` and the pattern stays intact.
- Assert on error `.code` (Postgres SQLSTATE), not on error `.message`
  string-match. Messages change across versions; SQLSTATEs don't.
