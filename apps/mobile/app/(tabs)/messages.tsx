import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { TabScreen, MiniActionCard, EmptyState } from '@sovio/ui';
import { useThreads } from '@sovio/core';

export default function MessagesTab() {
  const { theme } = useTheme();
  const { data: threads, isLoading } = useThreads();

  const threadList = threads ?? [];

  return (
    <TabScreen title="Messages" subtitle="Reply faster without overthinking it">
      {threadList.length === 0 ? (
        <EmptyState
          icon="chatbubble-outline"
          title="No conversations yet"
          body="Start a plan and conversations will appear here automatically."
        />
      ) : (
        threadList.map((entry: any) => {
          const thread = entry.threads ?? entry;
          const latestMessage = entry.latest_message;
          const unread = entry.unread_count ?? 0;

          return (
            <View key={thread.id}>
              <MiniActionCard
                title={thread.title}
                body={latestMessage?.content ?? 'No messages yet'}
                label={unread > 0 ? `${unread} new` : 'Open thread'}
                onPress={() => router.push({ pathname: '/(modals)/thread-detail', params: { threadId: thread.id } })}
              />
              {unread > 0 ? (
                <View style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  backgroundColor: theme.accent,
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 6,
                }}>
                  <Text style={{ color: theme.background, fontSize: 11, fontWeight: '800' }}>
                    {unread}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </TabScreen>
  );
}
