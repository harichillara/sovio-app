import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { QueueToastProps } from './types';
import { withAlpha } from './styles';

export function QueueToast({ visible, message, isPro }: QueueToastProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, opacity]);

  const defaultMessage = isPro
    ? 'Priority generating...'
    : 'AI is generating...';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          pointerEvents: visible ? 'auto' : 'none',
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity,
          ...(Platform.OS === 'web'
            ? { boxShadow: `0px 12px 28px ${withAlpha(theme.text, 0.14)}` }
            : {
                shadowColor: theme.text,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 4,
              }),
        },
      ]}
    >
      <ActivityIndicator color={theme.accent} size="small" />
      <Text style={[styles.message, { color: theme.text }]}>
        {message ?? defaultMessage}
      </Text>
      {isPro && (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.badgeText, { color: theme.background }]}>
            PRO
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
