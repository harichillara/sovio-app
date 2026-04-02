import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { QuotaMeterProps } from './types';

export function QuotaMeter({ used, limit, label }: QuotaMeterProps) {
  const { theme } = useTheme();

  const clamped = Math.min(used, limit);
  const pct = limit > 0 ? clamped / limit : 0;
  const isNearLimit = pct >= 0.8;

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      ) : null}
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: isNearLimit ? theme.danger : theme.accent,
              width: `${Math.round(pct * 100)}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.count, { color: theme.muted }]}>
        {used}/{limit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    minWidth: 80,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  count: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },
});
