import { supabase } from '../supabase/client';

// Feature flags are resolved via one query at login, cached in React Query.
// Flag changes propagate on the next session — they're NOT auth checks, so
// staleness is acceptable. Anything security-sensitive (entitlements,
// authorization) stays off this system.

export type FeatureFlagRow = {
  key: string;
  enabled: boolean;
  user_ids: string[] | null;
  description: string | null;
};

/**
 * Fetch all feature flags visible to the caller.
 *
 * RLS grants SELECT to any authenticated user, so we get every row.
 * Client-side we resolve per-user using the same logic as `is_flag_enabled`
 * in the DB — allowlist wins if set, otherwise global `enabled`. Keeping the
 * resolution client-side means UI flag checks stay sync after the initial
 * load.
 */
export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key, enabled, user_ids, description');

  if (error) throw error;
  return (data ?? []) as FeatureFlagRow[];
}

/**
 * Resolve a single flag for a given user. Mirrors the DB function
 * `public.is_flag_enabled(key, user_id)` exactly:
 *   - allowlist non-null  -> only allowlisted users get `true`
 *   - allowlist null      -> everyone gets `enabled`
 *   - flag not in list    -> false (safe default)
 */
export function resolveFlag(
  flags: FeatureFlagRow[],
  key: string,
  userId: string | null | undefined,
): boolean {
  const flag = flags.find((f) => f.key === key);
  if (!flag) return false;
  if (flag.user_ids && flag.user_ids.length > 0) {
    return !!userId && flag.user_ids.includes(userId);
  }
  return flag.enabled;
}
