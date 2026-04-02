import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, PresenceScoreRing, Button } from '@sovio/ui';
import {
  usePresenceScore,
  usePresenceHistory,
  useTrackEvent,
  eventsService,
} from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

// Simple bar chart row (View-based, no SVG needed)
function ScoreBar({
  label,
  value,
  maxValue,
  color,
  trackColor,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  trackColor: string;
}) {
  const pct = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  return (
    <View style={barStyles.row}>
      <Text style={[barStyles.label, { color }]}>{label}</Text>
      <View style={[barStyles.track, { backgroundColor: trackColor }]}>
        <View
          style={[
            barStyles.fill,
            { backgroundColor: color, width: `${Math.round(pct * 100)}%` },
          ]}
        />
      </View>
      <Text style={[barStyles.value, { color }]}>{value}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 13, fontWeight: '600', width: 70 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  value: { fontSize: 13, fontWeight: '700', width: 30, textAlign: 'right' },
});

export default function PresenceScoreModal() {
  const { theme } = useTheme();
  const { data: today } = usePresenceScore();
  const { data: history = [] } = usePresenceHistory(7);
  const trackEvent = useTrackEvent();

  // Track that the user viewed this screen
  React.useEffect(() => {
    trackEvent.mutate({
      eventType: eventsService.EventTypes.PRESENCE_SCORE_VIEWED,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const score = today?.score ?? 0;
  const activityScore = today?.activity_score ?? 0;
  const socialScore = today?.social_score ?? 0;
  const movementScore = today?.movement_score ?? 0;

  // Day labels for history
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Close button */}
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>

        {/* Big ring */}
        <View style={styles.ringContainer}>
          <PresenceScoreRing score={score} size={180} />
          <Text style={[styles.heading, { color: theme.text }]}>
            Presence Score
          </Text>
          <Text style={[styles.sub, { color: theme.muted }]}>
            How engaged you've been today
          </Text>
        </View>

        {/* Component breakdown */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Breakdown
          </Text>
          <View style={styles.bars}>
            <ScoreBar
              label="Activity"
              value={activityScore}
              maxValue={33}
              color={theme.accent}
              trackColor={theme.border}
            />
            <ScoreBar
              label="Social"
              value={socialScore}
              maxValue={34}
              color={theme.success}
              trackColor={theme.border}
            />
            <ScoreBar
              label="Movement"
              value={movementScore}
              maxValue={33}
              color={theme.accentSoft}
              trackColor={theme.border}
            />
          </View>
        </View>

        {/* 7-day history */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Last 7 days
          </Text>
          <View style={styles.historyRow}>
            {history.map((d) => {
              const dayIndex = new Date(d.day + 'T12:00:00').getDay();
              const heightPct = Math.max(d.score, 5);
              return (
                <View key={d.day} style={styles.historyCol}>
                  <View
                    style={[
                      styles.historyBar,
                      {
                        backgroundColor: theme.accent,
                        height: heightPct * 0.8,
                      },
                    ]}
                  />
                  <Text style={[styles.historyLabel, { color: theme.muted }]}>
                    {dayLabels[dayIndex]}
                  </Text>
                  <Text style={[styles.historyValue, { color: theme.text }]}>
                    {d.score}
                  </Text>
                </View>
              );
            })}
            {/* Fill empty days */}
            {Array.from({ length: Math.max(0, 7 - history.length) }).map(
              (_, i) => (
                <View key={`empty-${i}`} style={styles.historyCol}>
                  <View
                    style={[
                      styles.historyBar,
                      { backgroundColor: theme.border, height: 4 },
                    ]}
                  />
                  <Text style={[styles.historyLabel, { color: theme.muted }]}>
                    --
                  </Text>
                </View>
              ),
            )}
          </View>
        </View>

        {/* Explanation */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            How scoring works
          </Text>
          <Text style={[styles.explainer, { color: theme.muted }]}>
            Your Presence Score reflects how engaged you are with your social
            life. It combines three dimensions: Activity (viewing suggestions,
            replays, insights), Social (messaging, joining plans, accepting
            drafts), and Movement (creating plans, toggling availability,
            completing experiments). Each dimension contributes roughly a third
            of the total score. The score resets daily and is calculated
            automatically.
          </Text>
        </View>
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
  ringContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
  },
  sub: {
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  bars: {
    gap: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
  },
  historyCol: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  historyBar: {
    width: 18,
    borderRadius: 4,
    minHeight: 4,
  },
  historyLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  historyValue: {
    fontSize: 10,
    fontWeight: '700',
  },
  explainer: {
    fontSize: 14,
    lineHeight: 20,
  },
});
