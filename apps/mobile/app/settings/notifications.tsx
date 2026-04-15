import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, Button, LoadingOverlay, MiniActionCard } from '@sovio/ui';
import {
  useAuthStore,
  useDisablePushNotifications,
  useEnablePushNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationCenter,
  eventsService,
} from '@sovio/core';

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const { data, isLoading } = useNotificationCenter();
  const enablePush = useEnablePushNotifications();
  const disablePush = useDisablePushNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const pushEnabled = data?.pushEnabled ?? false;
  const notificationItems = data?.items ?? [];
  const hasUnread = (data?.unreadCount ?? 0) > 0;

  const handlePushToggle = () => {
    if (pushEnabled) {
      disablePush.mutate();
      return;
    }
    enablePush.mutate();
  };

  const handleNotificationTap = (item: (typeof notificationItems)[0]) => {
    // Mark the notification as read
    if (!item.read) {
      markRead.mutate(item.id);
    }

    // Track the tap event
    if (userId) {
      eventsService.trackEvent(userId, eventsService.EventTypes.NOTIFICATION_TAPPED, {
        notificationId: item.id,
        kind: item.kind,
      }).catch((e) => console.warn('analytics:', e));
    }

    router.push(item.route as any);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
    if (userId) {
      eventsService.trackEvent(userId, eventsService.EventTypes.NOTIFICATION_READ, {
        action: 'mark_all_read',
      }).catch((e) => console.warn('analytics:', e));
    }
  };

  return (
    <AppScreen>
      {(isLoading || enablePush.isPending || disablePush.isPending) ? (
        <LoadingOverlay />
      ) : null}

      <ScrollView
        contentContainerStyle={{ gap: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>
              Notifications
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>
              Keep up with real momentum, not noise.
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            padding: 18,
            gap: 12,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
            Push alerts
          </Text>
          <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
            Sovio nudges when there is something warm enough to act on: active
            conversations, real plan options, replay-worthy misses, and your weekly
            readout. We intentionally throttle repeat buzzes.
          </Text>
          <Button
            label={
              pushEnabled ? 'Turn off push notifications' : 'Enable push notifications'
            }
            onPress={handlePushToggle}
            variant={pushEnabled ? 'secondary' : 'primary'}
          />
        </View>

        <View
          style={{
            backgroundColor: theme.surfaceAlt,
            borderRadius: 18,
            padding: 16,
            gap: 6,
          }}
        >
          <Text
            style={{
              color: theme.accent,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Activity Inbox
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
              {notificationItems.length > 0
                ? `${data?.unreadCount ?? 0} active updates`
                : 'No active updates right now'}
            </Text>
            {hasUnread ? (
              <Pressable onPress={handleMarkAllRead}>
                <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
                  Mark all read
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={{ color: theme.muted, fontSize: 13 }}>
            Your bell mirrors the same moments that can trigger push, so the inbox
            stays calm and believable.
          </Text>
        </View>

        {notificationItems.length === 0 ? (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 18,
              padding: 18,
              gap: 8,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
              All caught up
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
              When there is something that actually matters, it will appear here.
            </Text>
          </View>
        ) : (
          notificationItems.map((item) => (
            <View key={item.id} style={{ gap: 6 }}>
              <MiniActionCard
                title={item.title}
                body={item.body}
                label={
                  item.kind === 'message'
                    ? `Open${item.count > 0 ? ` (${item.count})` : ''}`
                    : item.kind === 'suggestion'
                      ? 'View'
                      : item.kind === 'replay'
                        ? 'Replay'
                        : 'Read'
                }
                onPress={() => handleNotificationTap(item)}
              />
              <Text style={{ color: theme.muted, fontSize: 12, marginLeft: 4 }}>
                {item.count > 1 ? `${item.count} updates` : item.kind} ·{' '}
                {formatRelativeTime(item.createdAt)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </AppScreen>
  );
}
