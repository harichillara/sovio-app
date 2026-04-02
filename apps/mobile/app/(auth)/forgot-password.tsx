import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { AppScreen, TextInput, Button } from '@sovio/ui';
import { useResetPassword } from '@sovio/core';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const resetMutation = useResetPassword();
  const [sent, setSent] = useState(false);

  const handleReset = () => {
    if (!email) return;
    resetMutation.mutate(
      { email },
      { onSuccess: () => setSent(true) }
    );
  };

  return (
    <AppScreen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>
          Reset your password
        </Text>
        <Text style={{ fontSize: 16, color: theme.muted }}>
          Enter your email and we'll send you a reset link.
        </Text>

        {resetMutation.error ? (
          <Text style={{ color: theme.danger, fontSize: 14 }}>
            {resetMutation.error.message}
          </Text>
        ) : null}

        {sent ? (
          <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: 14, padding: 18, gap: 8 }}>
            <Text style={{ color: theme.success, fontSize: 15, fontWeight: '700' }}>
              Check your email
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14 }}>
              We sent a password reset link to {email}. Follow the instructions to reset your password.
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button
              label={resetMutation.isPending ? 'Sending...' : 'Send Reset Link'}
              onPress={handleReset}
            />
          </>
        )}

        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.accent, textAlign: 'center', fontSize: 14, fontWeight: '600', marginTop: 12 }}>
            Back to sign in
          </Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}
