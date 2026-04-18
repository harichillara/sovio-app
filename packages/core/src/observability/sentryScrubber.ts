/**
 * Sentry PII + secret scrubber — framework-agnostic.
 *
 * Why this exists
 * ---------------
 * Sentry captures request/response objects, error messages, and breadcrumbs
 * verbatim. Without scrubbing, any of the following can end up in the
 * Sentry issue stream:
 *   - `Authorization: Bearer <user JWT>` headers copied from a fetch
 *     Response that error'd out
 *   - Stripe keys (sk_live_…, sk_test_…) accidentally logged in error
 *     messages
 *   - Supabase service-role keys (long base64 JWTs starting with eyJ…)
 *     leaked from an edge-fn error
 *   - User email addresses in breadcrumb "user typed" events
 *   - Raw message bodies (chat content, bios, AI prompts) in stack-trace
 *     context
 *
 * Sentry itself scrubs a few fields by default (password, secret), but
 * not aggressively enough for our surface. This function is called from
 * `beforeSend` on every Sentry.init in the app.
 *
 * Design
 * ------
 * - Pure. No IO, no platform APIs. Safe for web, RN, and Deno.
 * - Walks the event object defensively — Sentry event shape is not fully
 *   typed, and breaks in minor-version upgrades have happened.
 * - Redacts, doesn't drop. A redacted event is still useful for stack
 *   analysis; a dropped event loses information.
 * - Preserves email domain (`alice@example.com` -> `***@example.com`)
 *   so ops can spot "is this all one tenant?" without storing PII.
 */

// Strings longer than this that look high-entropy get truncated to
// avoid leaking raw user content or secrets from stack traces.
const MAX_STRING_LEN = 500;

// Headers whose value should ALWAYS be removed.
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

// Patterns that identify a secret-like value.
const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // Stripe
  { name: 'stripe_secret', re: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: 'stripe_restricted', re: /\brk_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: 'stripe_webhook_secret', re: /\bwhsec_[A-Za-z0-9]{16,}\b/g },
  // JWT (Supabase access/refresh, Stripe signed payloads, generic)
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  // Bearer header values that slipped into a string
  { name: 'bearer', re: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi },
  // Long hex keys (AWS-style, service role hex, etc.)
  { name: 'hex_secret', re: /\b[a-f0-9]{40,}\b/g },
];

// Email: preserve domain for aggregation ("who'd we affect?"), scrub local.
const EMAIL_RE = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;

/** Lowercase-safe map lookup for headers. */
function isSecretHeader(name: string): boolean {
  return SECRET_HEADER_NAMES.has(name.toLowerCase());
}

/**
 * Redact secret patterns inside a string. Returns the possibly-modified
 * string. Also truncates anything absurdly long to avoid leaking raw
 * user content from stack-trace context.
 */
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

/**
 * Scrub a plain object/array structure in-place-ish (returns a new tree
 * for safety). Bounded depth to avoid pathological recursion on cyclic
 * structures — Sentry's SDK should have already detected those, but
 * defense in depth.
 */
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

/**
 * Scrub a Sentry event before it's sent. Designed for use as the
 * `beforeSend` option on Sentry.init.
 *
 * We intentionally don't import Sentry types here — the shape is
 * loose across @sentry/nextjs, @sentry/react-native, and Deno's
 * third_party Sentry SDK, and we want this file to compile everywhere.
 */
export function scrubSentryEvent<T>(event: T): T {
  if (!event || typeof event !== 'object') return event;
  // Cast through unknown so we can mutate defensively.
  const e = event as unknown as Record<string, unknown>;

  // Request: headers, cookies, data, query_string all suspect.
  if (e.request && typeof e.request === 'object') {
    e.request = scrubValue(e.request);
  }

  // Response: same treatment.
  if (e.response && typeof e.response === 'object') {
    e.response = scrubValue(e.response);
  }

  // `user` — strip email/username free-text; keep id for correlation.
  if (e.user && typeof e.user === 'object') {
    const u = e.user as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    if (typeof u.id === 'string') clean.id = u.id;
    // Preserve email domain if present.
    if (typeof u.email === 'string') clean.email = scrubString(u.email);
    // Drop username — too often reused as real name.
    e.user = clean;
  }

  // Breadcrumbs: scrub each entry's data + message.
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = (e.breadcrumbs as unknown[]).map((b) => scrubValue(b));
  }

  // Exception messages + stack frame vars.
  if (e.exception && typeof e.exception === 'object') {
    e.exception = scrubValue(e.exception);
  }

  // Message and extra context.
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
