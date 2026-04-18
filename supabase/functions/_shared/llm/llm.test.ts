// Deno tests for the LLM adapter layer.
// Run with:
//   deno test --allow-env --allow-net --allow-read supabase/functions/_shared/llm/llm.test.ts
//
// Covers:
//   1. Factory returns a GeminiClient by default.
//   2. Factory throws LLMError on unknown provider.
//   3. Factory throws LLMError({ reason: 'config' }) when GEMINI_API_KEY missing.
//   4. generateText returns the model output text (fetch mocked).
//   5. generateJson throws LLMError({ reason: 'invalid_output' }) on bad JSON.
//   6. generateJson parses + validates via zod on good JSON.

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { GeminiClient, getLLMClient, LLMError } from './index.ts';
import { z } from '../validate.ts';

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
): () => Promise<void> {
  return async () => {
    const prev: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) {
      prev[key] = Deno.env.get(key);
      if (vars[key] === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, vars[key]!);
      }
    }
    try {
      await fn();
    } finally {
      for (const key of Object.keys(prev)) {
        if (prev[key] === undefined) {
          Deno.env.delete(key);
        } else {
          Deno.env.set(key, prev[key]!);
        }
      }
    }
  };
}

function mockFetchOnce(response: Response | (() => Response)): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (() => {
    return Promise.resolve(typeof response === 'function' ? response() : response);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function geminiResponse(text: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

Deno.test(
  'getLLMClient: returns GeminiClient by default',
  withEnv({ LLM_PROVIDER: undefined, GEMINI_API_KEY: 'test-key' }, () => {
    const client = getLLMClient();
    assert(client instanceof GeminiClient, 'expected GeminiClient');
  }),
);

Deno.test(
  'getLLMClient: honors LLM_PROVIDER=gemini explicitly',
  withEnv({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' }, () => {
    const client = getLLMClient();
    assert(client instanceof GeminiClient);
  }),
);

Deno.test(
  'getLLMClient: throws LLMError on unknown provider',
  withEnv({ LLM_PROVIDER: 'does-not-exist', GEMINI_API_KEY: 'test-key' }, () => {
    try {
      getLLMClient();
      throw new Error('expected throw');
    } catch (err) {
      assert(err instanceof LLMError, `expected LLMError, got ${err}`);
      assertEquals((err as LLMError).reason, 'config');
    }
  }),
);

Deno.test(
  'GeminiClient: throws LLMError({ reason: "config" }) when API key missing',
  withEnv({ GEMINI_API_KEY: undefined }, () => {
    try {
      // Explicitly pass undefined to defeat env fallback.
      new GeminiClient(undefined);
      throw new Error('expected throw');
    } catch (err) {
      assert(err instanceof LLMError);
      assertEquals((err as LLMError).reason, 'config');
    }
  }),
);

// ---------------------------------------------------------------------------
// generateText
// ---------------------------------------------------------------------------

Deno.test('GeminiClient.generateText: returns the model text', async () => {
  const restore = mockFetchOnce(geminiResponse('hello from gemini'));
  try {
    const client = new GeminiClient('fake-key');
    const out = await client.generateText({ prompt: 'say hi' });
    assertEquals(out, 'hello from gemini');
  } finally {
    restore();
  }
});

Deno.test('GeminiClient.generateText: maps 429 to LLMError(rate_limited)', async () => {
  const restore = mockFetchOnce(
    new Response('quota exceeded', { status: 429 }),
  );
  try {
    const client = new GeminiClient('fake-key');
    await assertRejects(
      () => client.generateText({ prompt: 'x' }),
      LLMError,
      'rate limit',
    );
  } finally {
    restore();
  }
});

Deno.test('GeminiClient.generateText: maps 500 to LLMError(upstream)', async () => {
  const restore = mockFetchOnce(
    new Response('boom', { status: 500 }),
  );
  try {
    const client = new GeminiClient('fake-key');
    const err = await assertRejects(
      () => client.generateText({ prompt: 'x' }),
      LLMError,
    );
    assertEquals((err as LLMError).reason, 'upstream');
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// generateJson
// ---------------------------------------------------------------------------

Deno.test('GeminiClient.generateJson: parses and validates JSON via zod', async () => {
  const restore = mockFetchOnce(
    geminiResponse(JSON.stringify({ title: 'ok', count: 3 })),
  );
  try {
    const client = new GeminiClient('fake-key');
    const schema = z.object({ title: z.string(), count: z.number() });
    const out = await client.generateJson({ prompt: 'x', schema });
    assertEquals(out, { title: 'ok', count: 3 });
  } finally {
    restore();
  }
});

Deno.test('GeminiClient.generateJson: strips ```json fences before parsing', async () => {
  const fenced = '```json\n{"ok":true}\n```';
  const restore = mockFetchOnce(geminiResponse(fenced));
  try {
    const client = new GeminiClient('fake-key');
    const schema = z.object({ ok: z.boolean() });
    const out = await client.generateJson({ prompt: 'x', schema });
    assertEquals(out, { ok: true });
  } finally {
    restore();
  }
});

Deno.test(
  'GeminiClient.generateJson: throws LLMError(invalid_output) on non-JSON body',
  async () => {
    const restore = mockFetchOnce(geminiResponse('this is not json at all'));
    try {
      const client = new GeminiClient('fake-key');
      const schema = z.object({ x: z.string() });
      const err = await assertRejects(
        () => client.generateJson({ prompt: 'x', schema }),
        LLMError,
      );
      assertEquals((err as LLMError).reason, 'invalid_output');
    } finally {
      restore();
    }
  },
);

Deno.test(
  'GeminiClient.generateJson: throws LLMError(invalid_output) on schema mismatch',
  async () => {
    const restore = mockFetchOnce(
      geminiResponse(JSON.stringify({ title: 123 })), // number, schema wants string
    );
    try {
      const client = new GeminiClient('fake-key');
      const schema = z.object({ title: z.string() });
      const err = await assertRejects(
        () => client.generateJson({ prompt: 'x', schema }),
        LLMError,
      );
      assertEquals((err as LLMError).reason, 'invalid_output');
    } finally {
      restore();
    }
  },
);
