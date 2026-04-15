import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, Avatar, MiniActionCard, Button } from '@sovio/ui';
import { useAuthStore, useSignOut } from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

const MENU_ITEMS = [
  {
    title: 'Account',
    body: 'Update your name, bio, and photo',
    label: 'Edit',
    route: '/(modals)/edit-profile',
  },
  {
    title: 'AI Settings',
    body: 'Manage drafts, auto-reply, and personalization',
    label: 'Open',
    route: '/(modals)/ai-settings',
  },
  {
    title: 'Privacy',
    body: 'Control what you share and who sees it',
    label: 'Manage',
    route: '/settings/privacy',
  },
  {
    title: 'Notifications',
    body: 'Push alerts, reminders, and your activity inbox',
    label: 'Open',
    route: '/settings/notifications',
  },
  {
    title: 'Subscription',
    body: 'View your plan and upgrade',
    label: 'View',
    route: '/(modals)/subscription',
  },
  {
    title: 'Presence Score',
    body: 'Your real-world momentum this month',
    label: 'View',
    route: '/(modals)/presence-score',
  },
  {
    title: 'Support & Contact',
    body: 'FAQs, app version, and contact us',
    label: 'Open',
    route: '/settings/support',
  },
];

export default function SettingsIndex() {
  const { theme } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const signOutMutation = useSignOut();

  const displayName = profile?.display_name ?? 'Sovio User';
  const email = profile?.email ?? '';

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSuccess: () => router.replace('/(auth)/login'),
    });
  };

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>Settings</Text>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={theme.muted} />
          </Pressable>
        </View>

        {/* Profile card */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 22,
            padding: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Avatar uri={profile?.avatar_url} name={displayName} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>
              {displayName}
            </Text>
            {email ? (
              <Text style={{ color: theme.muted, fontSize: 13 }}>{email}</Text>
            ) : null}
          </View>
        </View>

        {/* Menu items */}
        {MENU_ITEMS.map((item) => (
          <MiniActionCard
            key={item.title}
            title={item.title}
            body={item.body}
            label={item.label}
            onPress={() => router.push(item.route as any)}
          />
        ))}

        {/* Sign out */}
        <View style={{ marginTop: 12 }}>
          <Pressable
            onPress={handleSignOut}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.danger, fontSize: 16, fontWeight: '700' }}>
              {signOutMutation.isPending ? 'Signing out...' : 'Sign Out'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppScreen>
  );
}
