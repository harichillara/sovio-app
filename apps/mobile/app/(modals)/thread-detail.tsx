import React, { useState, useRef } from 'react';
import { View, Text, FlatList, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, MessageBubble, LoadingOverlay } from '@sovio/ui';
import { TextInput as RNTextInput } from 'react-native';
import {
  useMessages,
  useSendMessage,
  useRealtimeMessages,
  useMarkThreadRead,
  useAuthStore,
  useAIStore,
} from '@sovio/core';

export default function ThreadDetailModal() {
  const { theme } = useTheme();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const [input, setInput] = useState('');
  const inputRef = useRef<RNTextInput>(null);
  const isGenerating = useAIStore((s) => s.isGenerating);
  const setIsGenerating = useAIStore((s) => s.setIsGenerating);

  const messagesQuery = useMessages(threadId ?? '');
  const sendMutation = useSendMessage();
  const markReadMutation = useMarkThreadRead();

  // Subscribe to realtime updates
  useRealtimeMessages(threadId ?? null);

  // Mark thread as read on mount
  React.useEffect(() => {
    if (threadId && userId) {
      markReadMutation.mutate({ threadId });
    }
  }, [threadId]);

  const allMessages = messagesQuery.data?.pages?.flat() ?? [];

  const handleSend = () => {
    if (!input.trim() || !threadId) return;
    sendMutation.mutate(
      { threadId, content: input.trim() },
      { onSuccess: () => setInput('') }
    );
  };

  const handleAIDraft = async () => {
    if (!threadId) return;
    setIsGenerating(true);
    try {
      // Placeholder: In production, call edge function for AI draft
      await new Promise((r) => setTimeout(r, 1000));
      setInput('Sounds great! I am in for tonight.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!threadId) {
    return (
      <AppScreen>
        <Text style={{ color: theme.muted }}>No thread selected</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Close</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Chat</Text>
          <View style={{ width: 40 }} />
        </View>

        {messagesQuery.isLoading ? <LoadingOverlay /> : null}

        {/* Messages list (inverted) */}
        <FlatList
          data={allMessages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              content={item.content}
              isMine={item.sender_id === userId}
              isAIDraft={item.is_ai_draft}
              timestamp={item.created_at}
            />
          )}
          contentContainerStyle={{ gap: 4, paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (messagesQuery.hasNextPage) {
              messagesQuery.fetchNextPage();
            }
          }}
        />

        {/* Input bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}>
          <Pressable
            onPress={handleAIDraft}
            style={{
              backgroundColor: theme.surfaceAlt,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '800' }}>
              {isGenerating ? '...' : 'AI'}
            </Text>
          </Pressable>

          <RNTextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={theme.muted}
            multiline
            style={{
              flex: 1,
              backgroundColor: theme.surface,
              borderRadius: 18,
              paddingHorizontal: 14,
              paddingVertical: 10,
              color: theme.text,
              fontSize: 15,
              maxHeight: 100,
            }}
          />

          <Pressable
            onPress={handleSend}
            style={{
              backgroundColor: input.trim() ? theme.accent : theme.surfaceAlt,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: input.trim() ? theme.background : theme.muted, fontWeight: '800', fontSize: 14 }}>
              Send
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
