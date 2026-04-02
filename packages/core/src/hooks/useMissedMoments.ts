import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';
import { supabase } from '../supabase/client';

export function useMissedMoments() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.missedMoments(userId ?? ''),
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('missed_moments')
        .select(`
          *,
          plans(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}
