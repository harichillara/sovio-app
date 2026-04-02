import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, Button } from '@sovio/ui';
import { useAuthStore } from '@sovio/core';
import { Ionicons } from '@expo/vector-icons';

const features = [
  { label: 'AI plan suggestions', free: '5/month', pro: 'Unlimited' },
  { label: 'AI message drafts', free: '10/month', pro: 'Unlimited' },
  { label: 'Auto-reply', free: false, pro: true },
  { label: 'Replay history', free: '7 days', pro: 'All time' },
  { label: 'Priority plan generation', free: false, pro: true },
  { label: 'Sovio Score insights', free: 'Basic', pro: 'Detailed' },
];

export default function SubscriptionModal() {
  const { theme } = useTheme();
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>Subscription</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>

        <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: 18, padding: 18, gap: 8 }}>
          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
            Current Plan
          </Text>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>
            Sovio {tier === 'pro' ? 'Pro' : 'Free'}
          </Text>
          {tier === 'free' ? (
            <Text style={{ color: theme.muted, fontSize: 14 }}>
              Upgrade to Pro for unlimited AI, faster coordination, and deeper insights.
            </Text>
          ) : (
            <Text style={{ color: theme.success, fontSize: 14, fontWeight: '600' }}>
              You have full access to all features.
            </Text>
          )}
        </View>

        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 2 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', paddingVertical: 10 }}>
            <Text style={{ flex: 2, color: theme.muted, fontSize: 13, fontWeight: '700' }}>Feature</Text>
            <Text style={{ flex: 1, color: theme.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>Free</Text>
            <Text style={{ flex: 1, color: theme.accent, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>Pro</Text>
          </View>

          {features.map((f) => (
            <View key={f.label} style={{ flexDirection: 'row', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Text style={{ flex: 2, color: theme.text, fontSize: 14 }}>{f.label}</Text>
              <View style={{ flex: 1, alignItems: 'center' }}>
                {typeof f.free === 'boolean' ? (
                  <Ionicons name={f.free ? 'checkmark-circle' : 'close-circle-outline'} size={18} color={f.free ? theme.success : theme.muted} />
                ) : (
                  <Text style={{ color: theme.muted, fontSize: 13 }}>{f.free}</Text>
                )}
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                {typeof f.pro === 'boolean' ? (
                  <Ionicons name={f.pro ? 'checkmark-circle' : 'close-circle-outline'} size={18} color={f.pro ? theme.success : theme.muted} />
                ) : (
                  <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>{f.pro}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {tier === 'free' ? (
          <Button
            label="Upgrade to Pro"
            onPress={() => {
              // Placeholder: In production, trigger IAP or Stripe checkout
              console.log('Upgrade flow');
            }}
          />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
