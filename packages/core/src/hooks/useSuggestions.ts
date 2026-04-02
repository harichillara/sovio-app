import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as suggestionsService from '../services/suggestions.service';
import * as eventsService from '../services/events.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';
import { useSuggestionsStore } from '../stores/suggestions.store';

export function useSuggestions() {
  const userId = useAuthStore((s) => s.user?.id);
  const setSuggestions = useSuggestionsStore((s) => s.setSuggestions);

  return useQuery({
    queryKey: queryKeys.suggestions(userId ?? ''),
    queryFn: async () => {
      if (!userId) return [];
      const suggestions = await suggestionsService.getSuggestions(userId);
      setSuggestions(suggestions);
      return suggestions;
    },
    enabled: !!userId,
  });
}

export function useAcceptSuggestion() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      await suggestionsService.acceptSuggestion(suggestionId);
      if (userId) {
        await eventsService.trackEvent(
          userId,
          eventsService.EventTypes.SUGGESTION_ACCEPTED,
          { suggestionId },
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });
}

export function useDismissSuggestion() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({
      suggestionId,
      reason,
    }: {
      suggestionId: string;
      reason?: string;
    }) => {
      await suggestionsService.dismissSuggestion(suggestionId, reason);
      if (userId) {
        await eventsService.trackEvent(
          userId,
          eventsService.EventTypes.SUGGESTION_DISMISSED,
          { suggestionId, reason },
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });
}
