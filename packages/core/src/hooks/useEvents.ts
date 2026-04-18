import { useMutation } from '@tanstack/react-query';
import * as eventsService from '../services/events.service';
import type { EventType } from '../services/events.service';
import type { Json } from '../supabase/database.types';
import { useAuthStore } from '../stores/auth.store';

/**
 * Mutation hook for tracking app events.
 */
export function useTrackEvent() {
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({
      eventType,
      payload,
      source,
    }: {
      eventType: EventType;
      payload?: Json;
      source?: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      return eventsService.trackEvent(userId, eventType, payload, source);
    },
  });
}
