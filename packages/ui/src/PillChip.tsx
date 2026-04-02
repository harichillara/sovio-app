import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { PillChipProps } from './types';

export function PillChip({ label, selected = false, onPress }: PillChipProps) {
  const { theme } = useTheme();
  const chip = (
    <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: selected ? theme.accent : theme.surfaceAlt }}>
      <Text style={{ color: selected ? theme.background : theme.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{chip}</Pressable>;
  return chip;
}
