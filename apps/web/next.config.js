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
      'react-native$': path.resolve(__dirname, 'stubs/react-native-stub.js'),
      'expo-secure-store': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo-auth-session': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo-linking': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo-notifications': path.resolve(__dirname, 'stubs/expo-stub.js'),
      'expo-device': path.resolve(__dirname, 'stubs/expo-stub.js'),
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
