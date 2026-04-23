const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sovio/tokens', '@sovio/core'],

  // @sovio/core is a cross-platform package shared with the Expo mobile app.
  // It imports react-native + expo-* at module level for platform-gated
  // logic. Next 15's webpack can't parse react-native's Flow source, so we
  // redirect these imports to minimal web stubs. Runtime code paths that
  // touch these APIs are gated on Platform.OS === 'web' and never execute.
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Phase 6 Task 6.1 (2026-04-23): attempted removal under RN 0.83.6 + Next 15.5 —
      // still fails with `Expected 'from', got 'typeOf'` at react-native/index.js:27
      // (`import typeof * as ReactNativePublicAPI from './index.js.flow'`). RN 0.83.6
      // continues to ship Flow at its public API entry point, which Next's SWC loader
      // cannot parse. Alias kept until RN ships TS or Babel-parsed entry.
      'react-native$': path.resolve(__dirname, 'stubs/react-native-stub.js'),
      'expo-secure-store': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo-auth-session': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo-linking': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo-notifications': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo-device': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo-location': path.resolve(__dirname, 'stubs/expo-stub.js'),
      // expo-modules-core@2.5.0 ships raw TS at its entry; alias so webpack
      // never attempts to parse it. Also stub `expo` itself because its
      // `src/Expo.ts` entry re-exports from expo-modules-core and uses
      // type-only re-export syntax that Next's SWC loader rejects.
      'expo-modules-core$': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo$': path.resolve(__dirname, 'stubs/expo-stub.js'),
    };
    return config;
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

// Bundle analyzer — run with `pnpm --filter @sovio/web analyze`. Produces an
// interactive treemap (client + server bundles) so we can spot surprise
// dependencies before they ship. Gated on ANALYZE=true so normal `next build`
// stays fast.
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Sentry wraps the Next config. Source-map upload is gated on SENTRY_AUTH_TOKEN
// so local / preview builds work without Sentry creds.
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG || 'placeholder',
  project: process.env.SENTRY_PROJECT || 'placeholder',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Skip source-map upload entirely when creds aren't provided.
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
});
