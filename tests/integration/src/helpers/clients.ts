/**
 * Supabase clients for integration tests.
 *
 * - `getAdminClient()` uses the service-role key. Bypasses RLS. Used only
 *   in setup/teardown to create and delete test users + seed rows that
 *   the test harness legitimately needs to exist but the tested client
 *   cannot create (e.g. a peer user's message so we can assert we can't
 *   read it).
 * - `createUserClient(email, password)` returns a fresh anon-key client
 *   signed in as that user. These are the "subject under test" clients —
 *   their queries must behave exactly as a real end-user's queries would.
 *
 * We turn off `persistSession` because we don't want any cross-run state.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let _admin: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (_admin) return _admin;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _admin;
}

export async function createUserClient(email: string, password: string): Promise<SupabaseClient> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env();
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`createUserClient: signIn failed for ${email}: ${error.message}`);
  }
  return client;
}
