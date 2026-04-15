import React from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuthStore } from '@sovio/core';
import { LoadingOverlay } from '@sovio/ui';

export default function AuthLayout() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const pathname = usePathname();
  const isCallbackRoute = pathname === '/callback';

  if (isCallbackRoute) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (session) {
    return <Redirect href={isOnboarded ? '/(tabs)/home' : '/onboarding'} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
