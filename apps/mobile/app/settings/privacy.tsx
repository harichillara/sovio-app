import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Switch, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, Button, LoadingOverlay } from '@sovio/ui';
import { useAuthStore, supabase } from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

type PrivacyLevel = 'private' | 'friends' | 'public';

export default function PrivacySettings() {
  const { theme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');

  const [loading, setLoading] = useState(true);
  const [sharePresence, setSharePresence] = useState(true);
  const [allowAILearn, setAllowAILearn] = useState(true);
  const [allowAutoReply, setAllowAutoReply] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('friends');

  // Load settings
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('key, value')
          .eq('user_id', userId)
          .in('key', [
            'privacy_share_presence',
            'privacy_ai_learn',
            'privacy_auto_reply',
            'privacy_level',
          ]);

        if (data) {
          for (const p of data) {
            if (p.key === 'privacy_share_presence') setSharePresence(p.value === 'true');
            if (p.key === 'privacy_ai_learn') setAllowAILearn(p.value === 'true');
            if (p.key === 'privacy_auto_reply') setAllowAutoReply(p.value === 'true');
            if (p.key === 'privacy_level')
              setPrivacyLevel(p.value as PrivacyLevel);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const savePref = useCallback(
    async (key: string, value: string) => {
      if (!userId) return;
      await supabase
        .from('user_preferences')
        .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });
    },
    [userId],
  );

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      "We'll email you a link to download your data within 48 hours.",
      [{ text: 'OK' }],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            // Track the event, actual deletion handled server-side
            await supabase.from('analytics_events').insert({
              user_id: userId,
              event: 'account_deletion_requested',
              metadata: {},
            });
            Alert.alert(
              'Account Deletion Requested',
              'Your account will be deleted within 30 days. You will receive a confirmation email.',
            );
          },
        },
      ],
    );
  };

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
            <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>Privacy</Text>
          </View>
        </View>

        {/* Toggles */}
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 18 }}>
          <ToggleRow
            label="Share presence with friends"
            description="Let your friends see when you're active"
            value={sharePresence}
            onValueChange={(v) => {
              setSharePresence(v);
              savePref('privacy_share_presence', String(v));
            }}
            theme={theme}
          />

          <ToggleRow
            label="Allow AI to learn from my messages"
            description="Improve AI suggestions based on your conversations"
            value={allowAILearn}
            onValueChange={(v) => {
              setAllowAILearn(v);
              savePref('privacy_ai_learn', String(v));
            }}
            theme={theme}
          />

          <ToggleRow
            label="Allow auto-reply"
            description={tier === 'pro' ? 'AI responds on your behalf in safe contexts' : 'Pro only -- upgrade to unlock'}
            value={allowAutoReply}
            onValueChange={(v) => {
              if (tier !== 'pro') return;
              setAllowAutoReply(v);
              savePref('privacy_auto_reply', String(v));
            }}
            theme={theme}
            disabled={tier !== 'pro'}
          />
        </View>

        {/* Privacy level */}
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 12 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Privacy Level</Text>
          {(['private', 'friends', 'public'] as PrivacyLevel[]).map((level) => (
            <Pressable
              key={level}
              onPress={() => {
                setPrivacyLevel(level);
                savePref('privacy_level', level);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 8,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: privacyLevel === level ? theme.accent : theme.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {privacyLevel === level && (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: theme.accent,
                    }}
                  />
                )}
              </View>
              <View>
                <Text
                  style={{
                    color: privacyLevel === level ? theme.text : theme.muted,
                    fontSize: 15,
                    fontWeight: '600',
                    textTransform: 'capitalize',
                  }}
                >
                  {level}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Data actions */}
        <View style={{ gap: 10 }}>
          <Button label="Export my data" onPress={handleExportData} variant="secondary" />

          <Pressable
            onPress={handleDeleteAccount}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.danger, fontSize: 16, fontWeight: '700' }}>
              Delete my account
            </Text>
          </Pressable>
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
        <Text
          style={{
            color: disabled ? theme.muted : theme.text,
            fontSize: 15,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
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
