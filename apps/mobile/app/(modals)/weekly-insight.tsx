import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppScreen, InsightCard, Button, EmptyState } from '@sovio/ui';
import {
  useAuthStore,
  useTrackEvent,
  eventsService,
  supabase,
  queryKeys,
} from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeeklyInsight {
  id: string;
  user_id: string;
  week_of: string;
  insight: string;
  experiment: string | null;
  experiment_done: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Local data fetching (these would ideally live in a service, but kept here
// for self-contained screen completeness)
// ---------------------------------------------------------------------------

function useWeeklyInsights() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.insights(userId ?? ''),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('weekly_insights')
        .select('*')
        .eq('user_id', userId)
        .order('week_of', { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as WeeklyInsight[];
    },
    enabled: !!userId,
  });
}

function useMarkExperimentDone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (insightId: string) => {
      const { error } = await supabase
        .from('weekly_insights')
        .update({ experiment_done: true })
        .eq('id', insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WeeklyInsightModal() {
  const { theme } = useTheme();
  const { data: insights = [] } = useWeeklyInsights();
  const markDone = useMarkExperimentDone();
  const trackEvent = useTrackEvent();

  // Track view
  React.useEffect(() => {
    trackEvent.mutate({
      eventType: eventsService.EventTypes.WEEKLY_INSIGHT_VIEWED,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = insights[0] ?? null;
  const past = insights.slice(1);

  const handleMarkDone = (insightId: string) => {
    markDone.mutate(insightId);
    trackEvent.mutate({
      eventType: eventsService.EventTypes.EXPERIMENT_COMPLETED,
      payload: { insightId },
    });
  };

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Close */}
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>

        <Text style={[styles.heading, { color: theme.text }]}>
          Weekly Insight
        </Text>
        <Text style={[styles.sub, { color: theme.muted }]}>
          A reflection on your week, with a small experiment to try
        </Text>

        {/* Current insight */}
        {current ? (
          <View style={styles.currentSection}>
            <InsightCard
              insight={current.insight}
              experiment={current.experiment ?? undefined}
              weekOf={current.week_of}
            />

            {current.experiment && !current.experiment_done && (
              <Button
                label="Mark experiment as done"
                onPress={() => handleMarkDone(current.id)}
                variant="primary"
              />
            )}

            {current.experiment_done && (
              <View
                style={[
                  styles.doneBadge,
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={theme.success}
                />
                <Text style={[styles.doneText, { color: theme.success }]}>
                  Experiment completed
                </Text>
              </View>
            )}
          </View>
        ) : (
          <EmptyState
            icon="bulb-outline"
            title="No insights yet"
            body="Your first weekly insight will appear after a few days of activity. Keep using Sovio!"
          />
        )}

        {/* Past insights */}
        {past.length > 0 && (
          <View style={styles.pastSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Past insights
            </Text>
            {past.map((item) => (
              <View key={item.id} style={styles.pastCard}>
                <InsightCard
                  insight={item.insight}
                  experiment={item.experiment ?? undefined}
                  weekOf={item.week_of}
                />
                {item.experiment_done && (
                  <View style={styles.pastDoneRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={theme.success}
                    />
                    <Text
                      style={[styles.pastDoneText, { color: theme.success }]}
                    >
                      Experiment done
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  close: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
  },
  currentSection: {
    gap: 14,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pastSection: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  pastCard: {
    gap: 6,
  },
  pastDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
  },
  pastDoneText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
