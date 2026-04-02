import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { AppScreenProps } from './types';

export function AppScreen({ children }: AppScreenProps) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 20, paddingTop: 56 }}>
      {children}
    </View>
  );
}
