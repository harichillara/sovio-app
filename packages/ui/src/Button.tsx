import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { ButtonProps } from './types';

export function Button({ label, onPress, variant = 'primary' }: ButtonProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const isPrimary = variant === 'primary';
  return (
    <Pressable onPress={onPress} style={isPrimary ? s.btnPrimary : s.btnSecondary}>
      <Text style={isPrimary ? s.btnTextOnAccent : s.btnTextOnSurface}>{label}</Text>
    </Pressable>
  );
}
