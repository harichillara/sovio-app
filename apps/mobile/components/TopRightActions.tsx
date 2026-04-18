import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@sovio/ui';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { useAuthStore, useNotificationCenter } from '@sovio/core';

export function TopRightActions() {
  const { theme } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const { data } = useNotificationCenter();

  const unreadCount = data?.unreadCount ?? 0;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => router.push('/settings/notifications')}
        style={[styles.iconButton, { backgroundColor: theme.surfaceAlt }]}
        hitSlop={10}
      >
        <Ionicons name="notifications-outline" size={18} color={theme.text} />
        {unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.badgeText, { color: theme.background }]}>
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        onPress={() => router.push('/settings')}
        style={styles.avatarButton}
        hitSlop={10}
      >
        <Avatar
          uri={profile?.avatar_url}
          name={profile?.display_name ?? 'Sovio User'}
          size={36}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    borderRadius: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
