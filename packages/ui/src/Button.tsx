import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { ButtonProps } from './types';

export function Button({ label, onPress, variant = 'primary', disabled }: ButtonProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[isPrimary ? s.btnPrimary : s.btnSecondary, disabled && { opacity: 0.4 }]}
    >
      <Text style={isPrimary ? s.btnTextOnAccent : s.btnTextOnSurface}>{label}</Text>
    </Pressable>
  );
}
