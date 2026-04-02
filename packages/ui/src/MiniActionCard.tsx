import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { MiniActionCardProps } from './types';

export function MiniActionCard({ title, body, label, onPress }: MiniActionCardProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const content = (
    <View style={s.miniCard}>
      <Text style={s.subtitle}>{title}</Text>
      <Text style={s.bodySmall}>{body}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}
