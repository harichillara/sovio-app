import React from 'react';
import { View, Text } from 'react-native';
import type { DimensionValue } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { TokenMeterProps } from './types';

export function TokenMeter({ used, total }: TokenMeterProps) {
  const { theme } = useTheme();
  const pct = total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0;
  return (
    <View style={{ alignItems: 'flex-end', gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted }}>AI</Text>
      <View style={{ width: 72, height: 8, borderRadius: 999, backgroundColor: theme.border, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%` as DimensionValue, height: '100%', backgroundColor: theme.accent, borderRadius: 999 }} />
      </View>
    </View>
  );
}
