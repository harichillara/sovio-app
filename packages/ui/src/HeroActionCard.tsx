import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import { Button } from './Button';
import type { HeroActionCardProps } from './types';

export function HeroActionCard({ title, body, primaryLabel, secondaryLabel, eyebrow, onPrimary, onSecondary }: HeroActionCardProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  return (
    <View style={s.heroCard}>
      {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      <View style={s.rowBtns}>
        <Button label={primaryLabel} onPress={onPrimary || (() => {})} />
        {secondaryLabel ? <Button label={secondaryLabel} onPress={onSecondary || (() => {})} variant="secondary" /> : null}
      </View>
    </View>
  );
}
