import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { TabScreen, MiniActionCard, EmptyState, LoadingOverlay } from '@sovio/ui';
import { useAuthStore, supabase } from '@sovio/core';
import { useQuery } from '@tanstack/react-query';

function useReplayItems() {
  const userId = useAuthStore((s) => s.user?.id);
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');

  return useQuery({
    queryKey: ['replay-items', userId, tier],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('missed_moments')
        .select('*, plans(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Free tier: last 7 days only
      if (tier === 'free') {
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
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');
  const userId = useAuthStore((s) => s.user?.id);
  const { data: replayItems, isLoading } = useReplayItems();

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
      supabase
        .from('analytics_events')
        .insert({ user_id: userId, event: 'replay_viewed', metadata: {} })
        .then(() => {});
    }
  }, [userId]);

  const items = replayItems ?? [];

  return (
    <TabScreen
      title="Today's Replay"
      subtitle={todayStr}
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
          {tier === 'pro' ? 'Full History' : 'Last 7 Days'}
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="refresh-outline"
          title="Nothing missed!"
          body="You're living it. When you skip a plan or miss a moment, it shows up here for another shot."
        />
      ) : (
        items.map((item: any) => {
          const plan = item.plans;
          return (
            <MiniActionCard
              key={item.id}
              title={plan?.title ?? 'Missed moment'}
              body={item.reason ?? plan?.description ?? 'Turn this into a new plan'}
              label="Do today"
              onPress={() => {
                // Create a new suggestion / plan from replay
                router.push({
                  pathname: '/(modals)/create-plan',
                  params: {
                    title: plan?.title ?? 'Replayed moment',
                    description: plan?.description ?? item.reason ?? '',
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
