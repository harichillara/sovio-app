import React, { useCallback } from 'react';
import { View, Text, Pressable, Alert, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, AppHeader, EmptyState } from '@sovio/ui';
import { useThreads, useAuthStore } from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

export default function MessagesTab() {
  const { theme } = useTheme();
  const { data: threads, isLoading, refetch } = useThreads();
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');

  const threadList = threads ?? [];

  const handleLongPress = useCallback(
    (threadId: string, threadTitle: string) => {
      Alert.alert(threadTitle, undefined, [
        {
          text: 'Report / Block',
          style: 'destructive',
          onPress: () =>
            router.push({
              pathname: '/(modals)/report',
              params: { contentType: 'thread', contentId: threadId },
            }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [],
  );

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderThread = ({ item: entry }: { item: any }) => {
    const thread = entry.threads ?? entry;
    const latestMessage = entry.latest_message;
    const unread = entry.unread_count ?? 0;
    const hasAIDraft = latestMessage?.is_ai_draft === true;

    return (
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(modals)/thread-detail',
            params: { threadId: thread.id },
          })
        }
        onLongPress={() => handleLongPress(thread.id, thread.title)}
        delayLongPress={500}
        style={{
          backgroundColor: theme.surface,
          borderRadius: 16,
          padding: 14,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Avatar placeholder */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chatbubble" size={20} color={theme.accent} />
        </View>

        {/* Content */}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text
              style={{
                color: theme.text,
                fontSize: 15,
                fontWeight: unread > 0 ? '800' : '600',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {thread.title}
            </Text>
            {latestMessage && (
              <Text style={{ color: theme.muted, fontSize: 12 }}>
                {formatTimestamp(latestMessage.created_at)}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {hasAIDraft && (
              <Ionicons name="sparkles" size={12} color={theme.accent} />
            )}
            <Text
              style={{
                color: theme.muted,
                fontSize: 13,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {latestMessage?.content ?? 'No messages yet'}
            </Text>
          </View>

          {/* Auto-reply indicator */}
          {tier === 'pro' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="flash-outline" size={10} color={theme.muted} />
              <Text style={{ color: theme.muted, fontSize: 10 }}>Auto-reply</Text>
            </View>
          )}
        </View>

        {/* Unread badge */}
        {unread > 0 && (
          <View
            style={{
              backgroundColor: theme.accent,
              borderRadius: 12,
              minWidth: 24,
              height: 24,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ color: theme.background, fontSize: 12, fontWeight: '800' }}>
              {unread}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <AppScreen>
      <AppHeader title="Messages" subtitle="Reply faster without overthinking it" />

      {isLoading && (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color={theme.accent} />
        </View>
      )}

      {!isLoading && threadList.length === 0 ? (
        <EmptyState
          icon="chatbubble-outline"
          title="No conversations yet"
          body="Start a plan and conversations will appear here automatically."
        />
      ) : (
        <FlatList
          data={threadList}
          keyExtractor={(item: any) => (item.threads ?? item).id}
          renderItem={renderThread}
          contentContainerStyle={{ paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {/* FAB to create new thread */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(modals)/create-plan',
            params: { mode: 'thread' },
          })
        }
        style={{
          position: 'absolute',
          right: 20,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
      >
        <Ionicons name="add" size={28} color={theme.background} />
      </Pressable>
    </AppScreen>
  );
}
