import { useQuery } from '@tanstack/react-query';
import {
  listFeatureFlags,
  resolveFlag,
  type FeatureFlagRow,
} from '../services/featureFlags.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';

/**
 * Fetch all feature flags in one query. Cached for the session — flag
 * changes propagate on next cold start or on explicit invalidation.
 * Gated on `enabled: !!userId` so unauth'd screens don't fetch.
 *
 * Staleness is by design. Flags aren't authorization. If you need a
 * security-grade gate, use RLS + entitlements, not this.
 */
export function useFeatureFlags() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery<FeatureFlagRow[]>({
    queryKey: queryKeys.featureFlags(userId ?? ''),
    queryFn: listFeatureFlags,
    enabled: !!userId,
    // 5 min cache is enough; flags don't flap.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Resolve a single flag. Returns false until the flags query resolves —
 * UI should treat "unknown" as "off" (safer default: the new experience
 * only appears after we've confirmed it's enabled).
 */
export function useFeatureFlag(key: string): boolean {
  const { data: flags } = useFeatureFlags();
  const userId = useAuthStore((s) => s.user?.id);
  if (!flags) return false;
  return resolveFlag(flags, key, userId);
}
