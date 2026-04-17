// Sentry — Node server-side config. Uses SENTRY_DSN (server-only) if set,
// otherwise falls back to NEXT_PUBLIC_SENTRY_DSN for single-DSN setups.
// Gated so unset env keeps Sentry a no-op in local dev / CI.
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: DSN,
  enabled: !!DSN,
  tracesSampleRate: 0.1,
});
