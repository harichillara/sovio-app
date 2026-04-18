import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { TabScreen, MiniActionCard, EmptyState, LoadingOverlay } from '@sovio/ui';
import { useAuthStore, useIsPro, eventsService, supabase } from '@sovio/core';
import type { MissedMoment } from '@sovio/core';
import { useQuery } from '@tanstack/react-query';
import { TopRightActions } from '../../components/TopRightActions';

function useReplayItems(isPro: boolean) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['replay-items', userId, isPro ? 'pro' : 'free'],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('missed_moments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Free tier: last 7 days only
      if (!isPro) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export default function ReplayTab() {
  const { theme } = useTheme();
  const isPro = useIsPro();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: replayItems, isLoading } = useReplayItems(isPro);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // Track replay_viewed event on mount
  useEffect(() => {
    if (userId) {
      eventsService
        .trackEvent(userId, eventsService.EventTypes.REPLAY_VIEWED, {}, 'mobile')
        .catch((e) => console.warn('analytics:', e));
    }
  }, [userId]);

  const items = replayItems ?? [];

  return (
    <TabScreen
      title="Today's Replay"
      subtitle={todayStr}
      headerRight={<TopRightActions />}
    >
      {isLoading && <LoadingOverlay />}

      {/* Tier badge */}
      <View
        style={{
          backgroundColor: theme.surfaceAlt,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 6,
          alignSelf: 'flex-start',
          marginBottom: 12,
        }}
        >
          <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '800' }}>
            {isPro ? 'Full History' : 'Last 7 Days'}
          </Text>
        </View>

      {items.length === 0 ? (
        <EmptyState
          icon="refresh-outline"
          title="Nothing missed!"
          body="You're living it. When you skip a plan or miss a moment, it shows up here for another shot."
        />
      ) : (
        items.map((item: MissedMoment) => {
          return (
            <MiniActionCard
              key={item.id}
              title="Missed moment"
              body={item.reason ?? 'Turn this almost-plan into a real one tonight.'}
              label="Do today"
              onPress={() => {
                router.push({
                  pathname: '/(modals)/create-plan',
                  params: {
                    title: 'Replayed moment',
                    description: item.reason ?? '',
                  },
                });
              }}
            />
          );
        })
      )}
    </TabScreen>
  );
}
