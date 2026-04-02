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
      const [entitlement, quota] = await Promise.all([
        entitlementsService.getEntitlement(userId),
        entitlementsService.checkQuota(userId),
      ]);
      return { ...entitlement, ...quota };
    },
    enabled: !!userId,
  });
}

/**
 * Derived boolean: is the current user on a pro plan?
 */
export function useIsPro(): boolean {
  const { data } = useEntitlement();
  if (!data) return false;
  if (data.plan !== 'pro') return false;
  if (!data.pro_until) return false;
  return new Date(data.pro_until) > new Date();
}
