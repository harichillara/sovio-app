import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@sovio/core';
import { LoadingOverlay } from '@sovio/ui';

export default function EntryScreen() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);

  useEffect(() => {
    if (isLoading) return;

    if (!session) {
      router.replace('/(auth)/login');
    } else if (!isOnboarded) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)/home');
    }
  }, [isLoading, session, isOnboarded]);

  return <LoadingOverlay />;
}
