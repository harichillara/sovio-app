import React from 'react';
import { View, Text, Switch } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import type { ToggleRowProps } from './types';

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: ToggleRowProps) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: disabled ? theme.muted : theme.text,
            fontSize: 15,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 13 }}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.accent }}
        thumbColor="#FFF"
        disabled={disabled}
      />
    </View>
  );
}
