import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, TokenMeter, LoadingOverlay } from '@sovio/ui';
import { useAuthStore, useAITokens, useAIStore, supabase } from '@sovio/core';

export default function AISettingsModal() {
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');
  const tokensUsed = useAIStore((s) => s.tokensUsed);
  const tokensLimit = useAIStore((s) => s.tokensLimit);

  const [planSuggestions, setPlanSuggestions] = useState(true);
  const [messageDrafts, setMessageDrafts] = useState(true);
  const [autoReply, setAutoReply] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch AI tokens data
  useAITokens();

  // Load preferences from DB
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('key, value')
          .eq('user_id', userId)
          .in('key', ['ai_plan_suggestions', 'ai_message_drafts', 'ai_auto_reply']);

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

  const savePref = useCallback(async (key: string, value: boolean) => {
    if (!userId) return;
    await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, key, value: String(value) },
        { onConflict: 'user_id,key' }
      );
  }, [userId]);

  if (loading) return <LoadingOverlay />;

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>AI Settings</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>

        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 6 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Token Usage</Text>
          <TokenMeter used={tokensUsed} total={tokensLimit === Infinity ? 1000 : tokensLimit} />
          <Text style={{ color: theme.muted, fontSize: 13 }}>
            {tokensUsed} / {tokensLimit === Infinity ? 'Unlimited' : tokensLimit} tokens used this month
          </Text>
        </View>

        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 16 }}>
          <ToggleRow
            label="AI plan suggestions"
            description="Let Sovio suggest plans based on your interests"
            value={planSuggestions}
            onValueChange={(v) => { setPlanSuggestions(v); savePref('ai_plan_suggestions', v); }}
            theme={theme}
          />
          <ToggleRow
            label="AI message drafts"
            description="Generate reply suggestions in conversations"
            value={messageDrafts}
            onValueChange={(v) => { setMessageDrafts(v); savePref('ai_message_drafts', v); }}
            theme={theme}
          />
          <ToggleRow
            label="Auto-reply"
            description={tier === 'pro' ? 'Automatically send AI replies in safe contexts' : 'Pro only - upgrade to unlock'}
            value={autoReply}
            onValueChange={(v) => {
              if (tier !== 'pro') return;
              setAutoReply(v);
              savePref('ai_auto_reply', v);
            }}
            theme={theme}
            disabled={tier !== 'pro'}
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  theme,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  theme: any;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: disabled ? theme.muted : theme.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: theme.muted, fontSize: 13 }}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.accent }}
        thumbColor="#FFF"
        disabled={disabled}
      />
    </View>
  );
}
