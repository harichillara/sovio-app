// Sentry — browser-side config. Loaded by withSentryConfig in next.config.js.
// Gated on NEXT_PUBLIC_SENTRY_DSN so local dev / CI stays a no-op when unset.
import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@sovio/core';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: DSN,
  enabled: !!DSN,
  tracesSampleRate: 0.1,
  // Strip PII and secrets before the event leaves the client.
  // See packages/core/src/observability/sentryScrubber.ts for the
  // redaction catalog (Stripe keys, JWTs, Bearer headers, emails).
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});
