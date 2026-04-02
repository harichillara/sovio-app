import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
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
  supabase,
} from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

export default function ThreadDetailModal() {
  const { theme } = useTheme();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');
  const [input, setInput] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [showingToast, setShowingToast] = useState(false);
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
  const lastMessage = allMessages.length > 0 ? allMessages[0] : null;

  const handleSend = () => {
    if (!input.trim() || !threadId) return;
    sendMutation.mutate(
      { threadId, content: input.trim() },
      { onSuccess: () => setInput('') },
    );
  };

  const handleAIDraft = useCallback(async () => {
    if (!threadId || !lastMessage) return;
    setIsGenerating(true);
    setShowingToast(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: {
          op: 'reply_draft',
          threadId,
          messageId: lastMessage.id,
        },
      });

      if (error) {
        Alert.alert('AI Draft Error', 'Could not generate a draft. Please try again.');
        return;
      }

      const draft = data?.draft ?? data?.content ?? '';
      if (draft) {
        setInput(draft);
        inputRef.current?.focus();
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong generating the draft.');
    } finally {
      setIsGenerating(false);
      setTimeout(() => setShowingToast(false), 300);
    }
  }, [threadId, lastMessage]);

  const handleLongPressMessage = useCallback(
    (messageId: string, senderId: string) => {
      Alert.alert('Message Options', undefined, [
        {
          text: 'Report',
          style: 'destructive',
          onPress: () =>
            router.push({
              pathname: '/(modals)/report',
              params: { contentType: 'message', contentId: messageId, reportedUserId: senderId },
            }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [],
  );

  const toggleAutoReply = useCallback(async () => {
    if (tier !== 'pro') {
      Alert.alert('Pro Feature', 'Auto-reply is available on the Pro plan.');
      return;
    }
    const newVal = !autoReplyEnabled;
    setAutoReplyEnabled(newVal);

    if (userId) {
      await supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, key: 'ai_auto_reply', value: String(newVal) },
          { onConflict: 'user_id,key' },
        );
    }
  }, [autoReplyEnabled, tier, userId]);

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
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Close</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Chat</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {tier === 'pro' && (
              <Pressable onPress={toggleAutoReply}>
                <Ionicons
                  name={autoReplyEnabled ? 'flash' : 'flash-outline'}
                  size={20}
                  color={autoReplyEnabled ? theme.accent : theme.muted}
                />
              </Pressable>
            )}
            <View style={{ width: 20 }} />
          </View>
        </View>

        {/* Auto-reply indicator */}
        {tier === 'pro' && autoReplyEnabled && (
          <View
            style={{
              backgroundColor: theme.surfaceAlt,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 6,
              marginBottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="flash" size={14} color={theme.accent} />
            <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
              Auto-reply enabled
            </Text>
          </View>
        )}

        {/* Queue toast */}
        {showingToast && (
          <View
            style={{
              backgroundColor: theme.surfaceAlt,
              borderRadius: 12,
              padding: 10,
              marginBottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
              Generating AI draft...
            </Text>
          </View>
        )}

        {messagesQuery.isLoading ? <LoadingOverlay /> : null}

        {/* Messages list (inverted) */}
        <FlatList
          data={allMessages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => handleLongPressMessage(item.id, item.sender_id)}
              delayLongPress={500}
            >
              <MessageBubble
                content={item.content}
                isMine={item.sender_id === userId}
                isAIDraft={item.is_ai_draft}
                timestamp={item.created_at}
              />
            </Pressable>
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <Pressable
            onPress={handleAIDraft}
            disabled={isGenerating}
            style={{
              backgroundColor: theme.surfaceAlt,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              opacity: isGenerating ? 0.5 : 1,
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
            <Text
              style={{
                color: input.trim() ? theme.background : theme.muted,
                fontWeight: '800',
                fontSize: 14,
              }}
            >
              Send
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
