import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, HeroActionCard, Button } from '@sovio/ui';

export default function EntryScreen() {
  const { theme } = useTheme();
  return (
    <AppScreen>
      <View style={{ gap: 18, flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: theme.text }}>Sovio</Text>
        <HeroActionCard
          eyebrow="WELCOME"
          title="Stop scrolling. Start doing."
          body="Sovio helps you make real plans faster with smart suggestions, lighter planning, and less effort."
          primaryLabel="Get started"
          secondaryLabel="Skip to app"
          onPrimary={() => router.push('/onboarding')}
          onSecondary={() => router.push('/(tabs)/home')}
        />
        <Button label="Open Sovio" onPress={() => router.push('/(tabs)/home')} />
      </View>
    </AppScreen>
  );
}
