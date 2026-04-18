/**
 * Vitest global setup. Runs once before the suite, and once after.
 *
 * On setup:
 *   - Loads .env (dotenv).
 *   - Validates required env vars; aborts if missing.
 *   - Runs a pre-sweep to delete any test users leaked from prior runs
 *     (defensive — if a previous run crashed in the middle, there may be
 *     orphaned rls-test-* users).
 *
 * On teardown:
 *   - Final sweep of rls-test-* users. Individual test files do their own
 *     afterAll cleanup too; this is belt-and-suspenders.
 */
import 'dotenv/config';
import { afterAll, beforeAll } from 'vitest';
import { getAdminClient } from './helpers/clients';
import { sweepLeakedTestUsers } from './helpers/test-users';
import { requireEnv } from './helpers/env';

beforeAll(async () => {
  requireEnv();
  const swept = await sweepLeakedTestUsers(getAdminClient());
  if (swept > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[integration:setup] swept ${swept} leaked rls-test-* user(s) from prior runs`);
  }
}, 60_000);

afterAll(async () => {
  await sweepLeakedTestUsers(getAdminClient());
}, 60_000);
