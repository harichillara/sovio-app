import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as autopilotService from '../services/autopilot.service';
import { useAuthStore } from '../stores/auth.store';

const AUTOPILOT_KEYS = {
  rules: (userId: string) => ['autopilot-rules', userId] as const,
  proposals: (userId: string) => ['autopilot-proposals', userId] as const,
};

export function useAutopilotRules() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: AUTOPILOT_KEYS.rules(userId ?? ''),
    queryFn: async () => {
      if (!userId) return [];
      return autopilotService.getUserRules(userId);
    },
    enabled: !!userId,
  });
}

export function useSetRule() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({ ruleKey, ruleValue }: { ruleKey: string; ruleValue: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return autopilotService.setRule(userId, ruleKey, ruleValue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: AUTOPILOT_KEYS.rules(userId ?? ''),
      });
    },
  });
}

export function useProposals() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: AUTOPILOT_KEYS.proposals(userId ?? ''),
    queryFn: async () => {
      if (!userId) return [];
      return autopilotService.getProposals(userId);
    },
    enabled: !!userId,
  });
}

export function useApproveProposal() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({ jobId }: { jobId: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return autopilotService.approveProposal(jobId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: AUTOPILOT_KEYS.proposals(userId ?? ''),
      });
    },
  });
}

export function useRejectProposal() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({ jobId }: { jobId: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return autopilotService.rejectProposal(jobId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: AUTOPILOT_KEYS.proposals(userId ?? ''),
      });
    },
  });
}
