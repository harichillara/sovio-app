import { useQuery } from '@tanstack/react-query';
import * as entitlementsService from '../services/entitlements.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';

/**
 * Fetch the user's entitlement record + quota.
 */
export function useEntitlement() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.entitlements(userId ?? ''),
    queryFn: async () => {
      if (!userId) return null;
      const entitlement = await entitlementsService.getEntitlement(userId);
      const quota = await entitlementsService.checkQuota(userId, entitlement);
      return { ...entitlement, ...quota };
    },
    enabled: !!userId,
  });
}

/**
 * Derived boolean: is the current user on a pro plan?
 */
// Must stay in sync with entitlements.service.ts and billing.service.ts
const CLOCK_SKEW_GRACE_MS = 5 * 60 * 1000;

export function useIsPro(): boolean {
  const { data } = useEntitlement();
  if (!data) return false;
  if (data.plan !== 'pro') return false;
  if (!data.pro_until) return false;
  return new Date(data.pro_until).getTime() > (Date.now() - CLOCK_SKEW_GRACE_MS);
}
