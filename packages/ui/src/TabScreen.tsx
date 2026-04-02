import React from 'react';
import { ScrollView } from 'react-native';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { createStyles } from './styles';
import { AppScreen } from './AppScreen';
import { AppHeader } from './AppHeader';
import type { TabScreenProps } from './types';

export function TabScreen({ title, subtitle, headerRight, children }: TabScreenProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  return (
    <AppScreen>
      <AppHeader title={title} subtitle={subtitle} rightSlot={headerRight} />
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </AppScreen>
  );
}
