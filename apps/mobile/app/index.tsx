import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@sovio/core';
import { LoadingOverlay } from '@sovio/ui';

export default function EntryScreen() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isOnboarded) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
