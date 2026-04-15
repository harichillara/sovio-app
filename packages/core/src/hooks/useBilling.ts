import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as billingService from '../services/billing.service';
import { useAuthStore } from '../stores/auth.store';
import { queryKeys } from './queryKeys';

const BILLING_KEYS = {
  subscription: (userId: string) => ['subscription', userId] as const,
};

export function useSubscription() {
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  return useQuery({
    queryKey: BILLING_KEYS.subscription(userId ?? ''),
    queryFn: async () => {
      if (!userId) return null;
      const subscription = await billingService.getSubscription(userId);

      if (profile) {
        const nextTier = subscription.is_pro_active ? 'pro' : 'free';
        if (profile.subscription_tier !== nextTier) {
          setProfile({ ...profile, subscription_tier: nextTier });
        }
      }

      return subscription;
    },
    enabled: !!userId,
  });
}

export function useCreateCheckout() {
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({ plan }: { plan: 'pro' }) => {
      if (!userId) throw new Error('Not authenticated');
      return billingService.createCheckout(userId, plan);
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Not authenticated');
      return billingService.cancelSubscription(userId);
    },
    onSuccess: (subscription) => {
      if (profile) {
        setProfile({
          ...profile,
          subscription_tier: subscription.is_pro_active ? 'pro' : 'free',
        });
      }

      queryClient.invalidateQueries({
        queryKey: BILLING_KEYS.subscription(userId ?? ''),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.entitlements(userId ?? ''),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.profile(userId ?? ''),
      });
    },
  });
}
