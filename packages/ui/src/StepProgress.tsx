import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { StepProgressProps } from './types';

export function StepProgress({ current, total }: StepProgressProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.progressSegment, { flex: 1, backgroundColor: i < current ? theme.accent : theme.border }]} />
      ))}
    </View>
  );
}
