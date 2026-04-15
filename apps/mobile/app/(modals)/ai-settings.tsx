import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, TokenMeter, LoadingOverlay, Button, ToggleRow } from '@sovio/ui';
import { useAuthStore, useAITokens, useAIStore, useIsPro, supabase } from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

export default function AISettingsModal() {
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const isPro = useIsPro();
  const tier = isPro ? 'pro' : 'free';
  const tokensUsed = useAIStore((s) => s.tokensUsed);
  const tokensLimit = useAIStore((s) => s.tokensLimit);

  const [planSuggestions, setPlanSuggestions] = useState(true);
  const [messageDrafts, setMessageDrafts] = useState(true);
  const [autoReply, setAutoReply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearingMemory, setClearingMemory] = useState(false);

  // Fetch AI tokens data
  useAITokens();
  const dailyLimit = tokensLimit > 0 ? tokensLimit : tier === 'pro' ? 500 : 50;

  // Load preferences from DB
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: prefs, error: prefsError } = await supabase
          .from('user_preferences')
          .select('key, value')
          .eq('user_id', userId)
          .in('key', ['ai_plan_suggestions', 'ai_message_drafts', 'ai_auto_reply']);

        if (prefsError) {
          console.error('[AISettings] Failed to load AI preferences.', prefsError.message);
        }

        if (prefs) {
          for (const p of prefs) {
            if (p.key === 'ai_plan_suggestions') setPlanSuggestions(p.value === 'true');
            if (p.key === 'ai_message_drafts') setMessageDrafts(p.value === 'true');
            if (p.key === 'ai_auto_reply') setAutoReply(p.value === 'true');
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const savePref = useCallback(
    async (key: string, value: boolean) => {
      if (!userId) return;
      const { error: saveError } = await supabase
        .from('user_preferences')
        .upsert({ user_id: userId, key, value: String(value) }, { onConflict: 'user_id,key' });
      if (saveError) {
        console.error('[AISettings] Failed to save preference', key, saveError.message);
      }
    },
    [userId],
  );

  const handleClearMemory = useCallback(async () => {
    if (!userId) return;

    Alert.alert(
      'Clear AI Memory',
      'This will delete all AI memories and personalization data. AI suggestions will start fresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearingMemory(true);
            try {
              await supabase
                .from('ai_memories')
                .delete()
                .eq('user_id', userId);
              Alert.alert('Done', 'AI memory has been cleared.');
            } catch {
              Alert.alert('Error', 'Could not clear AI memory.');
            } finally {
              setClearingMemory(false);
            }
          },
        },
      ],
    );
  }, [userId]);

  if (loading) return <LoadingOverlay />;

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={{ gap: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>AI Settings</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>

        {/* Toggles */}
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 16 }}>
          <ToggleRow
            label="AI plan suggestions"
            description="Let Sovio suggest plans based on your interests"
            value={planSuggestions}
            onValueChange={(v) => {
              setPlanSuggestions(v);
              savePref('ai_plan_suggestions', v);
            }}
          />
          <ToggleRow
            label="AI message drafts"
            description="Generate reply suggestions in conversations"
            value={messageDrafts}
            onValueChange={(v) => {
              setMessageDrafts(v);
              savePref('ai_message_drafts', v);
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text
                  style={{
                    color: tier !== 'pro' ? theme.muted : theme.text,
                    fontSize: 15,
                    fontWeight: '600',
                  }}
                >
                  Auto-reply
                </Text>
                {tier !== 'pro' && (
                  <Ionicons name="lock-closed" size={14} color={theme.muted} />
                )}
              </View>
              <Text style={{ color: theme.muted, fontSize: 13 }}>
                {tier === 'pro'
                  ? 'Automatically send AI replies in safe contexts'
                  : 'Pro only -- upgrade to unlock'}
              </Text>
            </View>
            <Switch
              value={autoReply}
              onValueChange={(v) => {
                if (tier !== 'pro') {
                  router.push('/(modals)/subscription');
                  return;
                }
                setAutoReply(v);
                savePref('ai_auto_reply', v);
              }}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor="#FFF"
              disabled={tier !== 'pro'}
            />
          </View>
        </View>

        {/* AI Usage section */}
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 10 }}>
          <Text
            style={{
              color: theme.accent,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            AI Usage
          </Text>

          <TokenMeter
            used={tokensUsed}
            total={dailyLimit}
          />

          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
            Today's AI calls: {tokensUsed} / {dailyLimit}
          </Text>

            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {tier === 'pro'
                ? `Pro plan: ${dailyLimit} AI calls per day`
                : `Free plan: ${dailyLimit} AI calls per day. Pro access is rolling out in waves.`}
            </Text>

            {tier === 'free' && (
            <Pressable
              onPress={() => router.push('/(modals)/subscription')}
              style={{
                backgroundColor: theme.surfaceAlt,
                borderRadius: 12,
                paddingVertical: 8,
                paddingHorizontal: 12,
                alignSelf: 'flex-start',
                marginTop: 4,
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
                Upgrade to Pro
              </Text>
            </Pressable>
          )}
        </View>

        {/* Clear AI memory */}
        <View style={{ gap: 10 }}>
          {clearingMemory ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <Button label="Clear AI memory" onPress={handleClearMemory} variant="secondary" />
          )}
          <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center' }}>
            Removes all stored personalization data used by AI
          </Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

