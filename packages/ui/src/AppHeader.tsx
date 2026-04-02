import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { AppHeaderProps } from './types';

export function AppHeader({ title, subtitle, rightSlot }: AppHeaderProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  return (
    <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={s.heading}>{title}</Text>
        {subtitle ? <Text style={[s.bodySmall, { marginTop: 6 }]}>{subtitle}</Text> : null}
      </View>
      {rightSlot}
    </View>
  );
}
