/**
 * Sentry PII + secret scrubber for Deno edge functions.
 *
 * This is a Deno-compatible port of
 * `packages/core/src/observability/sentryScrubber.ts`. The logic is pure
 * TypeScript with no platform APIs, so the two files are intentionally
 * kept in sync by hand — we don't import across the client/edge boundary
 * because the runtimes resolve modules differently (npm via pnpm vs.
 * https: via Deno).
 *
 * Wire this as `beforeSend` on every Sentry.init in the supabase/functions
 * tree. Catches things that otherwise leak straight into the Sentry issue
 * stream from edge-fn error paths:
 *   - `Authorization: Bearer <user JWT>` copied from a failing fetch
 *   - Stripe keys surfaced in webhook error messages
 *   - GEMINI_API_KEY echoed by a shell-out error
 *   - User emails and raw message bodies in stack-trace context
 *
 * See also: docs/runbooks/security-incident-response.md for the catalog
 * of redacted patterns.
 */

const MAX_STRING_LEN = 500;

const SECRET_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-supabase-auth',
  'x-stripe-signature',
  'apikey',
  'x-goog-api-key',
  'x-api-key',
]);

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'stripe_secret', re: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: 'stripe_restricted', re: /\brk_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: 'stripe_webhook_secret', re: /\bwhsec_[A-Za-z0-9]{16,}\b/g },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { name: 'bearer', re: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi },
  { name: 'hex_secret', re: /\b[a-f0-9]{40,}\b/g },
];

const EMAIL_RE = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;

function isSecretHeader(name: string): boolean {
  return SECRET_HEADER_NAMES.has(name.toLowerCase());
}

export function scrubString(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  let out = input;
  for (const { name, re } of SECRET_PATTERNS) {
    out = out.replace(re, `[REDACTED:${name}]`);
  }
  out = out.replace(EMAIL_RE, '***@$2');
  if (out.length > MAX_STRING_LEN) {
    out = out.slice(0, MAX_STRING_LEN) + `…[truncated ${out.length - MAX_STRING_LEN}]`;
  }
  return out;
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[REDACTED:depth]';
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof k === 'string' && isSecretHeader(k)) {
      out[k] = '[REDACTED:header]';
      continue;
    }
    out[k] = scrubValue(v, depth + 1);
  }
  return out;
}

export function scrubSentryEvent<T>(event: T): T {
  if (!event || typeof event !== 'object') return event;
  const e = event as unknown as Record<string, unknown>;

  if (e.request && typeof e.request === 'object') {
    e.request = scrubValue(e.request);
  }
  if (e.response && typeof e.response === 'object') {
    e.response = scrubValue(e.response);
  }
  if (e.user && typeof e.user === 'object') {
    const u = e.user as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    if (typeof u.id === 'string') clean.id = u.id;
    if (typeof u.email === 'string') clean.email = scrubString(u.email);
    // Drop username — too often reused as real name in this codebase.
    e.user = clean;
  }
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = (e.breadcrumbs as unknown[]).map((b) => scrubValue(b));
  }
  if (e.exception && typeof e.exception === 'object') {
    e.exception = scrubValue(e.exception);
  }
  if (typeof e.message === 'string') {
    e.message = scrubString(e.message) as string;
  }
  if (e.extra && typeof e.extra === 'object') {
    e.extra = scrubValue(e.extra);
  }
  if (e.contexts && typeof e.contexts === 'object') {
    e.contexts = scrubValue(e.contexts);
  }
  if (e.tags && typeof e.tags === 'object') {
    e.tags = scrubValue(e.tags);
  }

  return event;
}
