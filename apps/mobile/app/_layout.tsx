import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@sovio/tokens/ThemeContext';
import { QueryProvider, AuthProvider, RealtimeProvider, useAuthStore } from '@sovio/core';
import { LoadingOverlay } from '@sovio/ui';
import 'react-native-url-polyfill/auto';

function RouteGuard() {
  const { mode } = useTheme();
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const rootSegment = segments[0];
    const inAuth = rootSegment === '(auth)';
    const inOnboarding = rootSegment === 'onboarding';
    const atRoot = segments.length === 0;

    if (!session) {
      if (!inAuth) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (!isOnboarded) {
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
      return;
    }

    if (inAuth || inOnboarding || atRoot) {
      router.replace('/(tabs)/home');
    }
  }, [isLoading, isOnboarded, router, segments, session]);

  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="(modals)"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <RealtimeProvider>
            <RouteGuard />
          </RealtimeProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
