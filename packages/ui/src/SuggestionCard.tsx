import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { Button } from './Button';
import type { SuggestionCardProps } from './types';

const TYPE_LABELS: Record<string, string> = {
  plan: 'PLAN',
  place: 'PLACE',
  group: 'GROUP',
};

export function SuggestionCard({
  title,
  summary,
  type,
  onAccept,
  onDismiss,
}: SuggestionCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface }]}
      accessibilityRole="summary"
      accessibilityLabel={`${TYPE_LABELS[type] ?? type} suggestion: ${title}`}
    >
      <Text style={[styles.eyebrow, { color: theme.accent }]}>
        {TYPE_LABELS[type] ?? type.toUpperCase()}
      </Text>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.summary, { color: theme.muted }]}>{summary}</Text>
      <View style={styles.buttons}>
        <View style={styles.btnWrap}>
          <Button label="Do it" onPress={onAccept} variant="primary" />
        </View>
        <View style={styles.btnWrap}>
          <Button label="Not now" onPress={onDismiss} variant="secondary" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btnWrap: {
    flex: 1,
  },
});
