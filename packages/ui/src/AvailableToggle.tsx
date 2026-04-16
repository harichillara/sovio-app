import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { AvailableToggleProps } from './types';

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const mins = Math.ceil(diff / 60_000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m left`;
  }
  return `${mins}m left`;
}

export function AvailableToggle({
  isAvailable,
  onToggle,
  category,
  expiresAt,
}: AvailableToggleProps) {
  const { theme } = useTheme();
  const [countdown, setCountdown] = useState('');
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  useEffect(() => {
    if (!expiresAt || !isAvailable) {
      setCountdown('');
      return;
    }
    setCountdown(formatCountdown(expiresAt));
    const interval = setInterval(() => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown('Expired');
        onToggleRef.current(false);
        clearInterval(interval);
      } else {
        setCountdown(formatCountdown(expiresAt));
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [expiresAt, isAvailable]);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.left}>
        <Text style={[styles.label, { color: theme.text }]}>
          {isAvailable ? 'Available now' : 'Go available'}
        </Text>
        {isAvailable && countdown ? (
          <Text style={[styles.sub, { color: theme.muted }]}>
            {category ? `${category} \u00B7 ` : ''}
            {countdown}
          </Text>
        ) : (
          <Text style={[styles.sub, { color: theme.muted }]}>
            Let friends know you're free
          </Text>
        )}
      </View>
      <Switch
        value={isAvailable}
        onValueChange={onToggle}
        trackColor={{ false: theme.border, true: theme.accent }}
        thumbColor={isAvailable ? theme.background : theme.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    padding: 18,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
  },
});
