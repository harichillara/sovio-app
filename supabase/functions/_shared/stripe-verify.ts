/**
 * Stripe webhook signature verification.
 *
 * Stripe signs each webhook body with HMAC-SHA256 over `${timestamp}.${body}`,
 * using your endpoint's webhook secret. The signature header looks like:
 *
 *   Stripe-Signature: t=1614365838,v1=abc123...,v0=...
 *
 * We only accept v1 (current scheme) and enforce a tolerance on the timestamp
 * to prevent replay attacks.
 *
 * References:
 *   https://stripe.com/docs/webhooks/signatures
 *   https://stripe.com/docs/webhooks/best-practices
 *
 * This lives in `_shared` so it can be unit-tested without spinning up the
 * billing-webhook module (which has DB + Sentry side effects at module load).
 */

// Maximum allowed clock drift for webhook timestamp (5 minutes) — matches
// Stripe's own default tolerance. Shorter = stricter replay window, but less
// forgiving of clock skew between Stripe and our Edge runtime.
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export class StripeSignatureError extends Error {
  constructor(public readonly reason:
    | 'missing_components'
    | 'timestamp_too_old'
    | 'signature_mismatch') {
    super(`Stripe signature verification failed: ${reason}`);
    this.name = 'StripeSignatureError';
  }
}

/**
 * Verify the Stripe webhook signature using Web Crypto API.
 * Throws `StripeSignatureError` with a reason code on failure.
 *
 * @param body       The raw request body, exactly as received (do NOT re-stringify).
 * @param header     The `Stripe-Signature` header value.
 * @param secret     The endpoint secret (`whsec_...`) you set in the Stripe dashboard.
 * @param nowSeconds Optional override for the current time in seconds — used by
 *                   tests to produce stable assertions across runs.
 */
export async function verifyStripeSignature(
  body: string,
  header: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<void> {
  const parts = header.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const signature = parts['v1'];

  if (!timestamp || !signature) {
    throw new StripeSignatureError('missing_components');
  }

  const age = nowSeconds - parseInt(timestamp, 10);
  if (isNaN(age) || age > WEBHOOK_TOLERANCE_SECONDS) {
    throw new StripeSignatureError('timestamp_too_old');
  }

  // HMAC-SHA256(secret, "timestamp.body") — Stripe's canonical form.
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison: XOR each char-code, OR the differences. An
  // attacker can't use timing to recover the signature byte-by-byte.
  if (expected.length !== signature.length) {
    throw new StripeSignatureError('signature_mismatch');
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (mismatch !== 0) {
    throw new StripeSignatureError('signature_mismatch');
  }
}
