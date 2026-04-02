import React from 'react';
import { Pressable } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@sovio/tokens/ThemeContext';

const TAB_ICONS: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  home: { active: 'home', inactive: 'home-outline' },
  momentum: { active: 'flash', inactive: 'flash-outline' },
  messages: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  replay: { active: 'refresh', inactive: 'refresh-outline' },
};

function SettingsHeaderButton() {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      style={{ paddingRight: 16 }}
      hitSlop={12}
    >
      <Ionicons name="settings-outline" size={22} color={theme.muted} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const { theme } = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelStyle: { fontWeight: '800', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name] || TAB_ICONS.home;
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={size}
              color={color}
            />
          );
        },
        headerRight: () => <SettingsHeaderButton />,
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="momentum" options={{ title: 'Momentum' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="replay" options={{ title: 'Replay' }} />
    </Tabs>
  );
}
