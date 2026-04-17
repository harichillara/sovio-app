// Deno tests for the rate-limit helper.
// Run with: deno test --allow-env --allow-net supabase/functions/_shared/rate-limit.test.ts

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  consumeRateLimit,
  rateLimitExceededResponse,
  rateLimitHeaders,
} from './rate-limit.ts';

// ---------------------------------------------------------------------------
// Mock Supabase client — only the .rpc() surface is exercised here.
// ---------------------------------------------------------------------------

type RpcReturn = { data: unknown; error: { message: string } | null };

function mockSupabase(
  rpcReturn: RpcReturn,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return {
    rpc: (_fn: string, _args: unknown) => Promise.resolve(rpcReturn),
  };
}

const CORS = { 'Access-Control-Allow-Origin': '*' };
const OPTS = { bucket: 'test', max: 10, windowSeconds: 60 };

// ---------------------------------------------------------------------------
// consumeRateLimit
// ---------------------------------------------------------------------------

Deno.test('consumeRateLimit: maps a successful RPC row to the result shape', async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const supabase = mockSupabase({
    data: [{ allowed: true, used: 3, remaining: 7, reset_at: future }],
    error: null,
  });

  const result = await consumeRateLimit(supabase, 'user-1', OPTS);

  assertEquals(result.allowed, true);
  assertEquals(result.used, 3);
  assertEquals(result.remaining, 7);
  assert(result.resetAt instanceof Date);
});

Deno.test('consumeRateLimit: surfaces a denied result (allowed=false)', async () => {
  const future = new Date(Date.now() + 30_000).toISOString();
  const supabase = mockSupabase({
    data: [{ allowed: false, used: 10, remaining: 0, reset_at: future }],
    error: null,
  });

  const result = await consumeRateLimit(supabase, 'user-1', OPTS);

  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
});

Deno.test('consumeRateLimit: fails open (allowed=true) when the RPC errors', async () => {
  const supabase = mockSupabase({
    data: null,
    error: { message: 'connection refused' },
  });

  const result = await consumeRateLimit(supabase, 'user-1', OPTS);

  // Fail-open is intentional — a failing rate-limit DB must not brick UX.
  // The caller logs the error via the passed Logger so ops can see it.
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, OPTS.max);
});

Deno.test('consumeRateLimit: fails open when the RPC returns an empty body', async () => {
  const supabase = mockSupabase({ data: [], error: null });

  const result = await consumeRateLimit(supabase, 'user-1', OPTS);
  assertEquals(result.allowed, true);
});

Deno.test('consumeRateLimit: accepts both array and object returns (Postgres compat)', async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  // Single-row return can come back as an object when callers tweak the
  // PostgREST config; helper should tolerate both.
  const supabase = mockSupabase({
    data: { allowed: true, used: 1, remaining: 9, reset_at: future },
    error: null,
  });

  const result = await consumeRateLimit(supabase, 'user-1', OPTS);
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 9);
});

// ---------------------------------------------------------------------------
// rateLimitHeaders
// ---------------------------------------------------------------------------

Deno.test('rateLimitHeaders: produces RFC-style X-RateLimit-* triple', () => {
  const reset = new Date(1700000000000); // fixed epoch for determinism
  const headers = rateLimitHeaders(
    { allowed: true, used: 3, remaining: 57, resetAt: reset },
    60,
  );

  assertEquals(headers['X-RateLimit-Limit'], '60');
  assertEquals(headers['X-RateLimit-Remaining'], '57');
  assertEquals(headers['X-RateLimit-Reset'], String(Math.floor(reset.getTime() / 1000)));
});

// ---------------------------------------------------------------------------
// rateLimitExceededResponse
// ---------------------------------------------------------------------------

Deno.test('rateLimitExceededResponse: returns 429 with Retry-After + CORS', async () => {
  const reset = new Date(Date.now() + 45_000); // 45s in the future
  const res = rateLimitExceededResponse(
    { allowed: false, used: 60, remaining: 0, resetAt: reset },
    60,
    { 'Access-Control-Allow-Origin': 'https://sovio.app' },
  );

  assertEquals(res.status, 429);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), 'https://sovio.app');
  assertEquals(res.headers.get('Content-Type'), 'application/json');

  const retry = Number(res.headers.get('Retry-After'));
  assert(retry >= 1 && retry <= 60, `expected Retry-After 1..60, got ${retry}`);
  assertEquals(res.headers.get('X-RateLimit-Limit'), '60');
  assertEquals(res.headers.get('X-RateLimit-Remaining'), '0');

  const body = await res.json();
  assertEquals(body.error, 'rate_limited');
  assertEquals(body.used, 60);
  assertEquals(body.limit, 60);
});

Deno.test('rateLimitExceededResponse: clamps Retry-After to >= 1 second when reset is past', () => {
  const pastReset = new Date(Date.now() - 5000);
  const res = rateLimitExceededResponse(
    { allowed: false, used: 10, remaining: 0, resetAt: pastReset },
    10,
    CORS,
  );
  assertEquals(res.headers.get('Retry-After'), '1');
});
