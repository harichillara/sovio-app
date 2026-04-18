import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as suggestionsService from '../services/suggestions.service';
import * as eventsService from '../services/events.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';
import { useSuggestionsStore } from '../stores/suggestions.store';
import { useLocationStore } from '../stores/location.store';
import { supabase } from '../supabase/client';

export function useSuggestions() {
  const userId = useAuthStore((s) => s.user?.id);
  const setSuggestions = useSuggestionsStore((s) => s.setSuggestions);
  const coords = useLocationStore((s) => s.currentCoords);

  return useQuery({
    queryKey: queryKeys.suggestions(userId ?? ''),
    queryFn: async () => {
      if (!userId) return [];
      let suggestions = await suggestionsService.getSuggestions(userId);

      if (suggestions.length === 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            suggestions = await suggestionsService.refreshSuggestions({
              userId,
              accessToken: session.access_token,
              coords: coords
                ? { lat: coords.latitude, lng: coords.longitude }
                : undefined,
              includePredictHQ: true,
            });
          } catch (error) {
            console.warn('Intent refresh unavailable, leaving Home empty for now.', error);
          }
        }
      }

      setSuggestions(suggestions);
      return suggestions;
    },
    enabled: !!userId,
  });
}

export function useRefreshSuggestions() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const coords = useLocationStore((s) => s.currentCoords);
  const setSuggestions = useSuggestionsStore((s) => s.setSuggestions);

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const suggestions = await suggestionsService.refreshSuggestions({
        userId,
        accessToken: session.access_token,
        coords: coords
          ? { lat: coords.latitude, lng: coords.longitude }
          : undefined,
        includePredictHQ: true,
      });
      await eventsService.trackEvent(
        userId,
        eventsService.EventTypes.SUGGESTION_REFRESHED,
        {
          has_coords: Boolean(coords),
        },
      );
      setSuggestions(suggestions);
      return suggestions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions(userId ?? '') });
    },
  });
}

export function useAcceptSuggestion() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      if (!userId) throw new Error('Not authenticated');
      await suggestionsService.acceptSuggestion(suggestionId, userId);
      await eventsService.trackEvent(
        userId,
        eventsService.EventTypes.SUGGESTION_ACCEPTED,
        { suggestionId },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions(userId ?? '') });
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
      if (!userId) throw new Error('Not authenticated');
      await suggestionsService.dismissSuggestion(suggestionId, userId, reason);
      await eventsService.trackEvent(
        userId,
        eventsService.EventTypes.SUGGESTION_DISMISSED,
        { suggestionId, reason },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions(userId ?? '') });
    },
  });
}
