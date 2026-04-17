import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen, Button, LoadingOverlay } from '@sovio/ui';
import { useTheme } from '@sovio/tokens/ThemeContext';
import { authService, profileService, useAuthStore, supabase } from '@sovio/core';

export default function AuthCallbackScreen() {
  const { theme } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function waitForSession(timeoutMs = 6000, intervalMs = 200) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          return session;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      return null;
    }

    async function complete() {
      setIsProcessing(true);
      try {
        // Wait for Supabase auth initialization before attempting PKCE
        // exchange, otherwise the callback can hang behind the internal
        // web auth lock and leave the user on an infinite spinner.
        await supabase.auth.getSession();

        const g = globalThis as typeof globalThis & { location?: { href: string } };
        const url =
          typeof globalThis !== 'undefined'
            ? g.location?.href
            : undefined;
        const hasCallbackParams = Boolean(url && authService.isOAuthCallbackUrl(url));
        let exchangedSession = null;
        let exchangeFailure: Error | null = null;

        if (hasCallbackParams && url) {
          try {
            const exchange = await authService.completeOAuthFromUrl(url);
            exchangedSession = exchange?.session ?? null;
          } catch (exchangeError) {
            exchangeFailure =
              exchangeError instanceof Error
                ? exchangeError
                : new Error('Google sign-in could not be completed.');
            // If another part of the auth stack already exchanged the one-time
            // code, fall through and use the resulting session instead of
            // trapping the user on the callback screen.
            console.warn('OAuth exchange retry fell back to session check:', exchangeError);
          }
        }

        const session = exchangedSession ?? (await waitForSession());

        if (!session?.user) {
          if (exchangeFailure) {
            throw exchangeFailure;
          }

          throw new Error(
            hasCallbackParams
              ? 'Sign-in completed but Sovio never received the session.'
              : 'Google sign-in expired before Sovio could finish the handoff. Please try again.',
          );
        }

        const profile = await profileService.ensureProfile(session.user);
        if (cancelled) return;

        setProfile(profile);
        setSession(session);
        router.replace(profile.onboarded ? '/(tabs)/home' : '/onboarding');
      } catch (err) {
        if (cancelled) return;
        console.error('OAuth callback failed:', err);
        setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      } finally {
        if (!cancelled) {
          setIsProcessing(false);
        }
      }
    }

    void complete();

    return () => {
      cancelled = true;
    };
  }, [setProfile, setSession]);

  if (isProcessing && !error) {
    return <LoadingOverlay />;
  }

  return (
    <AppScreen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>
          Google sign-in hit a wall
        </Text>
        <Text style={{ color: theme.muted, fontSize: 15, lineHeight: 24 }}>
          {error}
        </Text>
        <Button label="Back to login" onPress={() => router.replace('/(auth)/login')} />
      </View>
    </AppScreen>
  );
}
