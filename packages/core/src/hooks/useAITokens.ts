import { useQuery } from '@tanstack/react-query';
import * as aiService from '../services/ai.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';
import { useAIStore } from '../stores/ai.store';

export function useAITokens() {
  const userId = useAuthStore((s) => s.user?.id);
  const setTokensUsed = useAIStore((s) => s.setTokensUsed);
  const setTokensLimit = useAIStore((s) => s.setTokensLimit);

  return useQuery({
    queryKey: queryKeys.aiTokens(userId ?? ''),
    queryFn: async () => {
      if (!userId) return null;
      const result = await aiService.checkCanUseAI(userId);
      setTokensUsed(result.tokensUsed);
      setTokensLimit(result.tokensLimit);
      return result;
    },
    enabled: !!userId,
  });
}
