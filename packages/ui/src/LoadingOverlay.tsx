import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';

export function LoadingOverlay() {
  const { theme } = useTheme();

  return (
    <View style={[styles.overlay, { backgroundColor: theme.background + 'CC' }]}>
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
