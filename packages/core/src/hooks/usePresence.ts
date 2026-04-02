import { useQuery } from '@tanstack/react-query';
import * as presenceService from '../services/presence.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';
import { usePresenceStore } from '../stores/presence.store';

/**
 * Fetch today's (or a specific day's) presence score.
 */
export function usePresenceScore(day?: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const setTodayScore = usePresenceStore((s) => s.setTodayScore);

  return useQuery({
    queryKey: queryKeys.presence(userId ?? '', day),
    queryFn: async () => {
      if (!userId) return null;
      const score = await presenceService.getDailyScore(userId, day);
      if (score && !day) setTodayScore(score);
      return score;
    },
    enabled: !!userId,
  });
}

/**
 * Fetch score history for the last N days.
 */
export function usePresenceHistory(days = 7) {
  const userId = useAuthStore((s) => s.user?.id);
  const setScoreHistory = usePresenceStore((s) => s.setScoreHistory);

  return useQuery({
    queryKey: queryKeys.presenceHistory(userId ?? '', days),
    queryFn: async () => {
      if (!userId) return [];
      const history = await presenceService.getScoreHistory(userId, days);
      setScoreHistory(history);
      return history;
    },
    enabled: !!userId,
  });
}
