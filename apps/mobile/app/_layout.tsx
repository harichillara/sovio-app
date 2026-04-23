import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import { ThemeProvider, useTheme } from '@sovio/tokens/ThemeContext';
import { QueryProvider, AuthProvider, RealtimeProvider, useAuthStore, scrubSentryEvent } from '@sovio/core';
import { LoadingOverlay, ErrorBoundary } from '@sovio/ui';
import 'react-native-url-polyfill/auto';

// ---------------------------------------------------------------------------
// Sentry — gated on EXPO_PUBLIC_SENTRY_DSN. Unset in local dev / CI means
// `enabled: false` and Sentry becomes a no-op. Native crash reporting requires
// a dev build (EAS or `expo prebuild`); Expo Go only captures JS errors.
// ---------------------------------------------------------------------------
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Sentry RN v8 auto-registers `reactNativeTracingIntegration()` whenever
  // `tracesSampleRate` is numeric and `enableAutoPerformanceTracing` stays at
  // its default (true). The explicit entry below is redundant-but-safe: it
  // future-proofs against Sentry tightening the auto-register heuristic and
  // serves as documentation-in-code. `@sentry/core`'s `filterDuplicates`
  // dedupes integrations by `name`, so there is no double-init risk.
  //
  // Session replay is NOT registered by default in v8. To keep it OFF, simply
  // do NOT set `replaysSessionSampleRate` / `replaysOnErrorSampleRate` — any
  // numeric value (including 0) triggers `mobileReplayIntegration()` to be
  // pushed onto the default integrations list.
  integrations: [
    Sentry.reactNativeTracingIntegration(),
    // If/when we enable replay: Sentry.mobileReplayIntegration({ maskAllText: true }),
  ],
  // Strip PII and secrets before leaving device. Catches Stripe keys,
  // JWTs, Bearer headers, and email local-parts across all event fields.
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});

function RouteGuard() {
  const { mode } = useTheme();
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const router = useRouter();
  // expo-router 6 still types `useSegments` as a non-empty tuple of literal
  // route strings, but at runtime the root path `/` yields `[]`. Widen to a
  // plain string array so defensive length/equality checks below stay meaningful.
  const segments = useSegments() as readonly string[];

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

function RootLayout() {
  return (
    <ErrorBoundary
      onError={(err, info) =>
        Sentry.captureException(err, {
          contexts: { react: { componentStack: info.componentStack ?? '' } },
        })
      }
    >
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <RealtimeProvider>
              <RouteGuard />
            </RealtimeProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
