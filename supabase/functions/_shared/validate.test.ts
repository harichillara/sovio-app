// Deno tests for the Zod-backed request validator.
// Run with: deno test --allow-env supabase/functions/_shared/validate.test.ts

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { parseJson, z } from './validate.ts';

const CORS = { 'Access-Control-Allow-Origin': '*' };

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

Deno.test('parseJson: returns ok:true with typed data on valid body', async () => {
  const schema = z.object({ userId: z.string().uuid(), limit: z.number().int().positive() });
  const req = jsonReq({ userId: '00000000-0000-0000-0000-000000000001', limit: 10 });

  const result = await parseJson(req, schema, CORS);

  assert(result.ok);
  if (result.ok) {
    assertEquals(result.data.userId, '00000000-0000-0000-0000-000000000001');
    assertEquals(result.data.limit, 10);
  }
});

// ---------------------------------------------------------------------------
// Invalid JSON
// ---------------------------------------------------------------------------

Deno.test('parseJson: returns 400 with invalid_json error on bad JSON', async () => {
  const schema = z.object({ foo: z.string() });
  const req = jsonReq('{not valid json');

  const result = await parseJson(req, schema, CORS);

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.response.status, 400);
    const body = await result.response.json();
    assertEquals(body.error, 'invalid_json');
    assertEquals(result.issues[0].path, '(root)');
  }
});

// ---------------------------------------------------------------------------
// Schema mismatch
// ---------------------------------------------------------------------------

Deno.test('parseJson: returns 400 with validation_failed on schema mismatch', async () => {
  const schema = z.object({ userId: z.string().uuid(), limit: z.number().int().positive() });
  const req = jsonReq({ userId: 'not-a-uuid', limit: -5 });

  const result = await parseJson(req, schema, CORS);

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.response.status, 400);
    const body = await result.response.json();
    assertEquals(body.error, 'validation_failed');
    assert(Array.isArray(body.issues));
    // Both fields are invalid → 2 issues
    assertEquals(body.issues.length, 2);
    const paths = body.issues.map((i: { path: string }) => i.path).sort();
    assertEquals(paths, ['limit', 'userId']);
  }
});

// ---------------------------------------------------------------------------
// CORS headers are forwarded on error responses
// ---------------------------------------------------------------------------

Deno.test('parseJson: propagates CORS headers on 400 responses', async () => {
  const schema = z.object({ foo: z.string() });
  const req = jsonReq({ foo: 123 });
  const corsHeaders = { 'Access-Control-Allow-Origin': 'https://sovio.app' };

  const result = await parseJson(req, schema, corsHeaders);

  assert(!result.ok);
  if (!result.ok) {
    assertEquals(
      result.response.headers.get('Access-Control-Allow-Origin'),
      'https://sovio.app',
    );
    assertEquals(result.response.headers.get('Content-Type'), 'application/json');
  }
});

// ---------------------------------------------------------------------------
// Discriminated union (the ai-generate body pattern)
// ---------------------------------------------------------------------------

Deno.test('parseJson: discriminatedUnion routes on `op` tag', async () => {
  const schema = z.discriminatedUnion('op', [
    z.object({ op: z.literal('suggest'), userId: z.string() }),
    z.object({ op: z.literal('reply'), threadId: z.string(), content: z.string() }),
  ]);

  const reply = await parseJson(
    jsonReq({ op: 'reply', threadId: 't1', content: 'hi' }),
    schema,
    CORS,
  );
  assert(reply.ok);
  if (reply.ok) assertEquals(reply.data.op, 'reply');

  const bad = await parseJson(jsonReq({ op: 'unknown' }), schema, CORS);
  assert(!bad.ok);
});
