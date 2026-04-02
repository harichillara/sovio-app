import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as momentumService from '../services/momentum.service';
import * as eventsService from '../services/events.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';

/**
 * Check if the current user is available.
 */
export function useMyAvailability() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.momentum(userId ?? ''),
    queryFn: async () => {
      if (!userId) return null;
      return momentumService.getMyAvailability(userId);
    },
    enabled: !!userId,
    refetchInterval: 30_000, // poll every 30 s to catch expiry
  });
}

/**
 * Set the user as available in a location bucket.
 */
export function useSetAvailable() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({
      bucket,
      category,
      durationMins,
    }: {
      bucket: string;
      category: string | null;
      durationMins: number;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      const result = await momentumService.setAvailable(
        userId,
        bucket,
        category,
        durationMins,
      );
      await eventsService.trackEvent(
        userId,
        eventsService.EventTypes.MOMENTUM_AVAILABLE_TOGGLED,
        { bucket, category, durationMins, action: 'on' },
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['momentum'] });
    },
  });
}

/**
 * Remove the user's availability.
 */
export function useRemoveAvailability() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      await momentumService.removeAvailability(userId);
      await eventsService.trackEvent(
        userId,
        eventsService.EventTypes.MOMENTUM_AVAILABLE_TOGGLED,
        { action: 'off' },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['momentum'] });
    },
  });
}
