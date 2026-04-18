/**
 * Test-user lifecycle helpers.
 *
 * Safety contract:
 *   - All test users are created with email matching TEST_EMAIL_PATTERN.
 *   - `sweepLeakedTestUsers` refuses to delete anything that doesn't match.
 *   - Test users are flagged via raw_user_meta_data.rls_test = true so even
 *     if the email pattern mutates, the metadata still identifies them.
 */
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Any email that matches this pattern is a test-user we are allowed to delete. */
export const TEST_EMAIL_PATTERN = /^rls-test-[0-9a-f-]+@sovio\.test$/i;

export type TestUser = {
  id: string;
  email: string;
  password: string;
};

export async function createTestUser(admin: SupabaseClient, label?: string): Promise<TestUser> {
  const uuid = randomUUID();
  const email = `rls-test-${uuid}@sovio.test`;
  const password = `Rls-Test-${uuid}!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { rls_test: true, label: label ?? 'unlabeled' },
  });
  if (error) throw new Error(`createTestUser: ${error.message}`);
  if (!data.user) throw new Error('createTestUser: no user returned');

  return { id: data.user.id, email, password };
}

export async function deleteTestUser(admin: SupabaseClient, user: TestUser): Promise<void> {
  // Double-safety: refuse to delete anything that doesn't match the pattern.
  if (!TEST_EMAIL_PATTERN.test(user.email)) {
    throw new Error(`refusing to delete non-test user: ${user.email}`);
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(`[deleteTestUser] ${user.email}: ${error.message}`);
  }
}

/**
 * Scans all auth users, deletes anything matching TEST_EMAIL_PATTERN.
 * Returns count of deleted users. Called from setup.ts pre- and post-suite.
 *
 * Supabase's admin API pages at 50 users per call; we iterate until empty.
 */
export async function sweepLeakedTestUsers(admin: SupabaseClient): Promise<number> {
  let deleted = 0;
  let page = 1;
  const perPage = 200;
  // Safety cap: don't scan more than 5 pages. At 200/page that's 1000 users —
  // if the pattern ever falsely matches real users, we stop before a massacre.
  const MAX_PAGES = 5;

  while (page <= MAX_PAGES) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[sweepLeakedTestUsers] listUsers page=${page}: ${error.message}`);
      break;
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const u of users) {
      if (!u.email || !TEST_EMAIL_PATTERN.test(u.email)) continue;
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) {
        // eslint-disable-next-line no-console
        console.warn(`[sweepLeakedTestUsers] delete ${u.email}: ${delErr.message}`);
        continue;
      }
      deleted += 1;
    }

    if (users.length < perPage) break;
    page += 1;
  }
  return deleted;
}
