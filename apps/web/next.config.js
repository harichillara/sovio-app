/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sovio/tokens'],

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
