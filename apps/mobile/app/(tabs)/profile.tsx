import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { TabScreen, MiniActionCard, ThemeToggle, Avatar, Button } from '@sovio/ui';
import { useAuthStore, useSignOut } from '@sovio/core';

export default function ProfileTab() {
  const { theme } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const signOutMutation = useSignOut();

  const displayName = profile?.display_name ?? 'Sovio User';
  const score = profile?.sovio_score ?? 0;

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSuccess: () => router.replace('/(auth)/login'),
    });
  };

  return (
    <TabScreen title="Profile" subtitle="Control, trust, and settings">
      {/* Profile header */}
      <View style={{
        backgroundColor: theme.surface,
        borderRadius: 22,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}>
        <Avatar
          uri={profile?.avatar_url}
          name={displayName}
          size={56}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{displayName}</Text>
          {profile?.bio ? (
            <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={2}>{profile.bio}</Text>
          ) : null}
        </View>
      </View>

      {/* Sovio Score */}
      <View style={{
        backgroundColor: theme.surfaceAlt,
        borderRadius: 22,
        padding: 18,
        gap: 6,
      }}>
        <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
          Sovio Score
        </Text>
        <Text style={{ color: theme.text, fontSize: 32, fontWeight: '800' }}>{score}</Text>
        <Text style={{ color: theme.muted, fontSize: 14 }}>
          Your real-world momentum this month
        </Text>
      </View>

      <ThemeToggle />

      <MiniActionCard
        title="Edit profile"
        body="Update your name, bio, and photo"
        label="Open"
        onPress={() => router.push('/(modals)/edit-profile')}
      />

      <MiniActionCard
        title="AI settings"
        body="Manage drafts, auto-reply, and personalization"
        label="Open settings"
        onPress={() => router.push('/(modals)/ai-settings')}
      />

      <MiniActionCard
        title="Subscription"
        body={profile?.subscription_tier === 'pro' ? 'Sovio Pro active' : 'Upgrade for more features'}
        label={profile?.subscription_tier === 'pro' ? 'Manage' : 'Upgrade'}
        onPress={() => router.push('/(modals)/subscription')}
      />

      <MiniActionCard
        title="Privacy and support"
        body="Permissions, exports, delete account, and help"
        label="Manage"
        onPress={() => {}}
      />

      <View style={{ marginTop: 8 }}>
        <Button
          label={signOutMutation.isPending ? 'Signing out...' : 'Sign Out'}
          onPress={handleSignOut}
          variant="secondary"
        />
      </View>
    </TabScreen>
  );
}
