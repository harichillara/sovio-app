// Sentry — browser-side config. Loaded by withSentryConfig in next.config.js.
// Gated on NEXT_PUBLIC_SENTRY_DSN so local dev / CI stays a no-op when unset.
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: DSN,
  enabled: !!DSN,
  tracesSampleRate: 0.1,
});
