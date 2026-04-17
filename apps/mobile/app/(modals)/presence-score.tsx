import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, PresenceScoreRing } from '@sovio/ui';
import {
  usePresenceScore,
  usePresenceHistory,
  useTrackEvent,
  eventsService,
} from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

function getPresenceState(score: number) {
  if (score >= 80) {
    return {
      label: 'Locked in',
      body: 'You are converting momentum into real follow-through today.',
    };
  }
  if (score >= 60) {
    return {
      label: 'Magnetic',
      body: 'Your social energy is alive and Sovio can feel a real opening.',
    };
  }
  if (score >= 35) {
    return {
      label: 'In motion',
      body: 'You have started moving. One more real action could turn the day.',
    };
  }
  if (score >= 15) {
    return {
      label: 'Warming up',
      body: 'There is signal here, but the day still needs a little follow-through.',
    };
  }
  return {
    label: 'Quiet start',
    body: 'Nothing is wrong. Sovio just has very little real-world motion to read yet.',
  };
}

function getNextMove(weakest: 'activity' | 'social' | 'movement') {
  switch (weakest) {
    case 'activity':
      return 'Open Intent Cloud or Replay once. Browsing with intent is enough to wake the signal up.';
    case 'social':
      return 'Reply to one thread or follow through on an AI draft. Social follow-through lifts the score fastest.';
    case 'movement':
      return 'Toggle Momentum or turn a suggestion into a real plan. Real action matters more than passive reading.';
  }
}

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
  const recentAverage = history.length
    ? Math.round(history.reduce((sum, day) => sum + day.score, 0) / history.length)
    : null;
  const daysInMotion = history.filter((day) => day.score >= 35).length;
  const socialWins = history.filter((day) => day.social_score >= 17).length;
  const historyWithToday = today
    ? [
        ...history.filter((day) => day.day !== today.day),
        today,
      ].sort((a, b) => a.day.localeCompare(b.day))
    : history;
  let streak = 0;
  for (let i = historyWithToday.length - 1; i >= 0; i -= 1) {
    if (historyWithToday[i].score >= 35) {
      streak += 1;
      continue;
    }
    break;
  }
  const delta = recentAverage === null ? null : score - recentAverage;
  const strongestDimension = [
    { key: 'activity' as const, label: 'Activity', score: activityScore },
    { key: 'social' as const, label: 'Social', score: socialScore },
    { key: 'movement' as const, label: 'Movement', score: movementScore },
  ].sort((a, b) => b.score - a.score)[0];
  const weakestDimension = [
    { key: 'activity' as const, label: 'Activity', score: activityScore },
    { key: 'social' as const, label: 'Social', score: socialScore },
    { key: 'movement' as const, label: 'Movement', score: movementScore },
  ].sort((a, b) => a.score - b.score)[0];
  const presenceState = getPresenceState(score);

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
            A beta read on how much real-world motion Sovio can see today
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionEyebrow, { color: theme.accent }]}>Signal readout</Text>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{presenceState.label}</Text>
          <Text style={[styles.explainer, { color: theme.muted }]}>
            {presenceState.body}
          </Text>
          <View style={styles.calloutRow}>
            <View
              style={[
                styles.calloutCard,
                { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.calloutLabel, { color: theme.muted }]}>Compared to your week</Text>
              <Text
                style={[
                  styles.calloutValue,
                  { color: delta === null ? theme.text : delta >= 0 ? theme.success : theme.danger },
                ]}
              >
                {delta === null ? 'Not enough history yet' : `${delta >= 0 ? '+' : ''}${delta} vs avg`}
              </Text>
            </View>
            <View
              style={[
                styles.calloutCard,
                { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.calloutLabel, { color: theme.muted }]}>Strongest signal</Text>
              <Text style={[styles.calloutValue, { color: theme.text }]}>
                {strongestDimension.label}
              </Text>
            </View>
          </View>
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

        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Weekly wins
          </Text>
          <View style={styles.calloutRow}>
            <View
              style={[
                styles.calloutCard,
                { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.calloutLabel, { color: theme.muted }]}>Days in motion</Text>
              <Text style={[styles.calloutValue, { color: theme.text }]}>
                {daysInMotion}/7
              </Text>
            </View>
            <View
              style={[
                styles.calloutCard,
                { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.calloutLabel, { color: theme.muted }]}>Social wins</Text>
              <Text style={[styles.calloutValue, { color: theme.text }]}>
                {socialWins}
              </Text>
            </View>
          </View>
          <Text style={[styles.explainer, { color: theme.muted }]}>
            {streak > 1
              ? `You are on a ${streak}-day streak of real movement. Keep the chain warm with one small follow-through today.`
              : 'The best version of this score is not perfection. It is rhythm: small real actions, repeated.'}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Best move right now
          </Text>
          <Text style={[styles.explainer, { color: theme.muted }]}>
            {getNextMove(weakestDimension.key)}
          </Text>
        </View>

        {/* Explanation */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            How scoring works
          </Text>
          <Text style={[styles.explainer, { color: theme.muted }]}>
            Presence Score is a beta pulse, not a judgment. It blends Activity
            (checking live suggestions and replays), Social (messaging and joining
            plans), and Movement (creating plans, toggling availability, and
            completing experiments). It resets daily so you can recover quickly,
            and it will get smarter as Sovio connects to richer real-world signals.
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
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bars: {
    gap: 12,
  },
  calloutRow: {
    flexDirection: 'row',
    gap: 12,
  },
  calloutCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  calloutLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  calloutValue: {
    fontSize: 16,
    fontWeight: '800',
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
