// Deno tests for Stripe webhook signature verification.
// Run with:
//   deno test --allow-env --allow-net --allow-read supabase/functions/_shared/stripe-verify.test.ts
//
// These assert the three failure modes Stripe's spec calls out:
//   1. Missing v1 or t component in the header            → 'missing_components'
//   2. Timestamp older than WEBHOOK_TOLERANCE_SECONDS     → 'timestamp_too_old'
//   3. HMAC doesn't match                                 → 'signature_mismatch'
//
// Plus a happy-path case using a known secret and a freshly-computed signature.

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  StripeSignatureError,
  WEBHOOK_TOLERANCE_SECONDS,
  verifyStripeSignature,
} from './stripe-verify.ts';

const SECRET = 'whsec_test_secret';

/** Compute a valid Stripe-Signature header for a given body + timestamp. */
async function signFixture(body: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `t=${timestamp},v1=${hex}`;
}

Deno.test('verifyStripeSignature: valid signature + fresh timestamp → resolves', async () => {
  const body = '{"id":"evt_test","type":"ping"}';
  const now = 1_700_000_000;
  const header = await signFixture(body, now);

  // Pin `nowSeconds` to the fixture timestamp so the test is deterministic.
  await verifyStripeSignature(body, header, SECRET, now);
});

Deno.test('verifyStripeSignature: missing v1 component → missing_components', async () => {
  await assertRejects(
    () => verifyStripeSignature('body', 't=1700000000', SECRET, 1_700_000_000),
    StripeSignatureError,
    'missing_components',
  );
});

Deno.test('verifyStripeSignature: missing t component → missing_components', async () => {
  await assertRejects(
    () => verifyStripeSignature('body', 'v1=deadbeef', SECRET, 1_700_000_000),
    StripeSignatureError,
    'missing_components',
  );
});

Deno.test('verifyStripeSignature: timestamp just past tolerance → timestamp_too_old', async () => {
  const body = 'body';
  const ts = 1_700_000_000;
  const header = await signFixture(body, ts);

  await assertRejects(
    () => verifyStripeSignature(body, header, SECRET, ts + WEBHOOK_TOLERANCE_SECONDS + 1),
    StripeSignatureError,
    'timestamp_too_old',
  );
});

Deno.test('verifyStripeSignature: wrong secret → signature_mismatch', async () => {
  const body = 'body';
  const now = 1_700_000_000;
  const header = await signFixture(body, now);

  await assertRejects(
    () => verifyStripeSignature(body, header, 'whsec_wrong_secret', now),
    StripeSignatureError,
    'signature_mismatch',
  );
});

Deno.test('verifyStripeSignature: tampered body → signature_mismatch', async () => {
  const original = 'body';
  const tampered = 'body_tampered';
  const now = 1_700_000_000;
  const header = await signFixture(original, now);

  await assertRejects(
    () => verifyStripeSignature(tampered, header, SECRET, now),
    StripeSignatureError,
    'signature_mismatch',
  );
});

Deno.test('StripeSignatureError: reason is exposed as a property', () => {
  const err = new StripeSignatureError('timestamp_too_old');
  assertEquals(err.reason, 'timestamp_too_old');
  assertEquals(err.name, 'StripeSignatureError');
});
