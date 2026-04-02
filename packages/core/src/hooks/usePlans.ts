import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as plansService from '../services/plans.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';
import { usePlansStore } from '../stores/plans.store';
import type { PlanInsert, PlanUpdate } from '../supabase/types';

export function usePlans(filters?: { status?: string; limit?: number }) {
  const userId = useAuthStore((s) => s.user?.id);
  const setActivePlans = usePlansStore((s) => s.setActivePlans);

  return useQuery({
    queryKey: queryKeys.plans(filters),
    queryFn: async () => {
      if (!userId) return [];
      const plans = await plansService.getPlans(userId, filters);
      setActivePlans(plans);
      return plans;
    },
    enabled: !!userId,
  });
}

export function usePlan(planId: string) {
  return useQuery({
    queryKey: queryKeys.plan(planId),
    queryFn: () => plansService.getPlanById(planId),
    enabled: !!planId,
  });
}

export function useSuggestedPlans() {
  const userId = useAuthStore((s) => s.user?.id);
  const setSuggestedPlans = usePlansStore((s) => s.setSuggestedPlans);

  return useQuery({
    queryKey: ['suggested-plans', userId],
    queryFn: async () => {
      if (!userId) return [];
      const plans = await plansService.getSuggestedPlans(userId);
      setSuggestedPlans(plans);
      return plans;
    },
    enabled: !!userId,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: PlanInsert) => plansService.createPlan(plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      planId,
      data,
    }: {
      planId: string;
      data: Partial<PlanUpdate>;
    }) => plansService.updatePlan(planId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.plan(variables.planId),
      });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => plansService.deletePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useInviteToPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, userId }: { planId: string; userId: string }) =>
      plansService.inviteToPlan(planId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.plan(variables.planId),
      });
    },
  });
}

export function useRespondToInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      planId,
      userId,
      status,
    }: {
      planId: string;
      userId: string;
      status: 'accepted' | 'declined' | 'maybe';
    }) => plansService.respondToInvite(planId, userId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.plan(variables.planId),
      });
    },
  });
}
