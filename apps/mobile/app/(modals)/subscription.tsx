import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, Button } from '@sovio/ui';
import { useAuthStore } from '@sovio/core';
import {
  useSubscription,
  useCreateCheckout,
  useCancelSubscription,
} from '@sovio/core/hooks/useBilling';
import { Ionicons } from '@expo/vector-icons';

const features = [
  { label: 'AI calls / day', free: '50', pro: '500' },
  { label: 'Plan suggestions', free: '3', pro: 'Unlimited' },
  { label: 'Replay history', free: '7 days', pro: 'Full' },
  { label: 'Matching priority', free: 'Basic', pro: 'Priority' },
  { label: 'Auto-reply', free: false, pro: true },
  { label: 'Weekly insights', free: false, pro: true },
];

export default function SubscriptionModal() {
  const { theme } = useTheme();
  const tier = useAuthStore((s) => s.profile?.subscription_tier ?? 'free');
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const checkoutMutation = useCreateCheckout();
  const cancelMutation = useCancelSubscription();

  const handleUpgrade = useCallback(async () => {
    try {
      const result = await checkoutMutation.mutateAsync({ plan: 'pro' });
      if (result.url) {
        Linking.openURL(result.url);
      } else {
        Alert.alert('Checkout', 'Checkout session created. Check your email for the payment link.');
      }
    } catch {
      Alert.alert('Error', 'Could not start checkout. Please try again.');
    }
  }, [checkoutMutation]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your Pro subscription? You will lose access to Pro features at the end of your billing period.',
      [
        { text: 'Keep Pro', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync();
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
            } catch {
              Alert.alert('Error', 'Could not cancel subscription.');
            }
          },
        },
      ],
    );
  }, [cancelMutation]);

  const handleRestore = useCallback(() => {
    Alert.alert(
      'Restore Purchases',
      'If you previously purchased Pro, your subscription will be restored from your account.',
      [{ text: 'OK' }],
    );
  }, []);

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
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>Subscription</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: theme.muted, fontSize: 15, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>

        {/* Current plan card */}
        <View
          style={{
            backgroundColor: theme.surfaceAlt,
            borderRadius: 18,
            padding: 18,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                color: theme.accent,
                fontSize: 12,
                fontWeight: '800',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Current Plan
            </Text>
            <View
              style={{
                backgroundColor: tier === 'pro' ? theme.accent : theme.border,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  color: tier === 'pro' ? theme.background : theme.text,
                  fontSize: 11,
                  fontWeight: '800',
                }}
              >
                {tier === 'pro' ? 'PRO' : 'FREE'}
              </Text>
            </View>
          </View>

          <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>
            Sovio {tier === 'pro' ? 'Pro' : 'Free'}
          </Text>

          {tier === 'pro' && subscription?.current_period_end && (
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              Renews{' '}
              {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          )}

          {tier === 'free' && (
            <Text style={{ color: theme.muted, fontSize: 14 }}>
              Upgrade to Pro for unlimited AI, faster coordination, and deeper insights.
            </Text>
          )}

          {tier === 'pro' && (
            <Text style={{ color: theme.success, fontSize: 14, fontWeight: '600' }}>
              You have full access to all features.
            </Text>
          )}
        </View>

        {/* Feature comparison */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 18,
            padding: 16,
            gap: 2,
          }}
        >
          {/* Header row */}
          <View style={{ flexDirection: 'row', paddingVertical: 10 }}>
            <Text style={{ flex: 2, color: theme.muted, fontSize: 13, fontWeight: '700' }}>
              Feature
            </Text>
            <Text
              style={{
                flex: 1,
                color: theme.muted,
                fontSize: 13,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              Free
            </Text>
            <Text
              style={{
                flex: 1,
                color: theme.accent,
                fontSize: 13,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              Pro
            </Text>
          </View>

          {features.map((f) => (
            <View
              key={f.label}
              style={{
                flexDirection: 'row',
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: theme.border,
              }}
            >
              <Text style={{ flex: 2, color: theme.text, fontSize: 14 }}>{f.label}</Text>
              <View style={{ flex: 1, alignItems: 'center' }}>
                {typeof f.free === 'boolean' ? (
                  <Ionicons
                    name={f.free ? 'checkmark-circle' : 'close-circle-outline'}
                    size={18}
                    color={f.free ? theme.success : theme.muted}
                  />
                ) : (
                  <Text style={{ color: theme.muted, fontSize: 13 }}>{f.free}</Text>
                )}
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                {typeof f.pro === 'boolean' ? (
                  <Ionicons
                    name={f.pro ? 'checkmark-circle' : 'close-circle-outline'}
                    size={18}
                    color={f.pro ? theme.success : theme.muted}
                  />
                ) : (
                  <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>
                    {f.pro}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Price highlight */}
        {tier === 'free' && (
          <View
            style={{
              backgroundColor: theme.surfaceAlt,
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>$6.99</Text>
            <Text style={{ color: theme.muted, fontSize: 14 }}>per month</Text>
          </View>
        )}

        {/* Actions */}
        {tier === 'free' ? (
          <View style={{ gap: 12 }}>
            {checkoutMutation.isPending ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <Button label="Upgrade to Pro" onPress={handleUpgrade} />
            )}
            <Pressable onPress={handleRestore} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: theme.muted, fontSize: 14, fontWeight: '600' }}>
                Restore purchases
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Pressable onPress={handleRestore} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: theme.muted, fontSize: 14, fontWeight: '600' }}>
                Restore purchases
              </Text>
            </Pressable>
            {cancelMutation.isPending ? (
              <ActivityIndicator color={theme.danger} />
            ) : (
              <Pressable
                onPress={handleCancel}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.danger, fontSize: 15, fontWeight: '700' }}>
                  Cancel subscription
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}
