// Sentry — Edge runtime config (middleware / edge routes).
// Same DSN resolution as the Node server config.
import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@sovio/core';

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: DSN,
  enabled: !!DSN,
  tracesSampleRate: 0.1,
  // Middleware / edge routes see raw request headers — scrub before send.
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});
