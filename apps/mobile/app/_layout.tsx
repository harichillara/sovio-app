import React from 'react';
import { Stack } from 'expo-router';
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

  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        {!session ? (
          <Stack.Screen name="(auth)" />
        ) : !isOnboarded ? (
          <Stack.Screen name="onboarding" />
        ) : (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="(modals)"
              options={{ presentation: 'modal' }}
            />
          </>
        )}
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
