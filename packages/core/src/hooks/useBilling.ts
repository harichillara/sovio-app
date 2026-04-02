import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as billingService from '../services/billing.service';
import { useAuthStore } from '../stores/auth.store';

const BILLING_KEYS = {
  subscription: (userId: string) => ['subscription', userId] as const,
};

export function useSubscription() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: BILLING_KEYS.subscription(userId ?? ''),
    queryFn: async () => {
      if (!userId) return null;
      return billingService.getSubscription(userId);
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

  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Not authenticated');
      return billingService.cancelSubscription(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: BILLING_KEYS.subscription(userId ?? ''),
      });
    },
  });
}
