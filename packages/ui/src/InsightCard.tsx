import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { InsightCardProps } from './types';

export function InsightCard({ insight, experiment, weekOf }: InsightCardProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <Ionicons name="bulb-outline" size={20} color={theme.accent} />
        <Text style={[styles.weekLabel, { color: theme.muted }]}>
          Week of {weekOf}
        </Text>
      </View>

      <Text style={[styles.insightText, { color: theme.text }]}>
        {insight}
      </Text>

      {experiment ? (
        <View
          style={[
            styles.experimentBox,
            { backgroundColor: theme.surfaceAlt },
          ]}
        >
          <Text style={[styles.experimentLabel, { color: theme.accent }]}>
            MICRO-EXPERIMENT
          </Text>
          <Text style={[styles.experimentText, { color: theme.text }]}>
            {experiment}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  insightText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  experimentBox: {
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  experimentLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  experimentText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
