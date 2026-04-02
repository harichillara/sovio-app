import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { Button } from './Button';
import type { EmptyStateProps } from './types';

export function EmptyState({ icon, title, body, actionLabel, onAction }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon as any} size={56} color={theme.muted} />
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>{body}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  action: {
    marginTop: 8,
  },
});
