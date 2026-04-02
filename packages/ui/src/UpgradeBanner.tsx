import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import type { UpgradeBannerProps } from './types';

export function UpgradeBanner({ title, body, cta = 'Upgrade', onPress }: UpgradeBannerProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const content = (
    <View style={s.invertedCard}>
      <Text style={{ color: theme.background, fontWeight: '800', fontSize: 18 }}>{title}</Text>
      <Text style={{ color: theme.surfaceAlt, fontSize: 14, lineHeight: 20 }}>{body}</Text>
      <Text style={{ color: theme.background, fontWeight: '800', fontSize: 14 }}>{cta} →</Text>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}
