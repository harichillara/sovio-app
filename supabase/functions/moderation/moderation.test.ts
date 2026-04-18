// Deno tests for moderation handler's pure logic.
// Run with: deno test --allow-env --allow-net supabase/functions/moderation/moderation.test.ts
//
// We cover the two paths that don't require hitting real Gemini:
//   1. empty GEMINI_API_KEY → { safe: true, labels: [] } (no-op mode)
//   2. fetch throws → fail-closed { safe: false, labels: ['moderation_unavailable'] }

import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// ----------------------------------------------------------------------------
// Env + module isolation
// ----------------------------------------------------------------------------
//
// moderateContent reads GEMINI_API_KEY at module load. To test both branches
// we need to import the module twice with different env values. Deno's module
// cache makes that tricky, so we stash and restore env + import dynamically.
// Note: the handler also instantiates a supabase client at module load via
// createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY), so we set placeholders
// that satisfy the createClient() shape without requiring a real URL.

const ORIG_GEMINI = Deno.env.get('GEMINI_API_KEY');
const ORIG_URL    = Deno.env.get('SUPABASE_URL');
const ORIG_SRK    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.env.set('SUPABASE_URL', 'http://localhost:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// index.ts instantiates a supabase-js client at module load, which starts
// a realtime heartbeat interval. That interval outlives the test and trips
// Deno's resource/op sanitizer. Disabling the sanitizers on these tests is
// the documented escape hatch for modules with long-lived background tasks.
const testOpts = { sanitizeOps: false, sanitizeResources: false } as const;

Deno.test({
  name: 'moderateContent: empty API key returns safe no-op',
  ...testOpts,
  fn: async () => {
    Deno.env.delete('GEMINI_API_KEY');

    // Use a cache-busting query string so the second import re-reads env.
    const mod = await import(`./index.ts?emptyKey=${Date.now()}`);
    const result = await mod.moderateContent('any content');

    assertEquals(result.safe, true);
    assertEquals(result.labels, []);
    assertEquals(result.reasoning, 'No content to moderate');
  },
});

Deno.test({
  name: 'moderateContent: empty text returns safe no-op even with key set',
  ...testOpts,
  fn: async () => {
    Deno.env.set('GEMINI_API_KEY', 'test-key');

    const mod = await import(`./index.ts?emptyText=${Date.now()}`);
    const result = await mod.moderateContent('   ');

    assertEquals(result.safe, true);
    assertEquals(result.reasoning, 'No content to moderate');
  },
});

Deno.test({
  name: 'moderateContent: fetch failure fails closed (content blocked)',
  ...testOpts,
  fn: async () => {
    Deno.env.set('GEMINI_API_KEY', 'test-key');

    // Monkey-patch global fetch so the moderation call throws. We restore it
    // in a try/finally so a failing assertion doesn't leave fetch broken for
    // subsequent tests.
    const realFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('network down'));

    try {
      const mod = await import(`./index.ts?failClosed=${Date.now()}`);
      const result = await mod.moderateContent('user-authored content');

      assertEquals(result.safe, false, 'must fail closed when moderation unavailable');
      assert(result.labels.includes('moderation_unavailable'));
    } finally {
      globalThis.fetch = realFetch;
    }
  },
});

// ----------------------------------------------------------------------------
// Teardown — restore env so this file doesn't pollute subsequent tests.
// ----------------------------------------------------------------------------

Deno.test({
  name: 'teardown: restore env',
  fn: () => {
    if (ORIG_GEMINI !== undefined) Deno.env.set('GEMINI_API_KEY', ORIG_GEMINI);
    else Deno.env.delete('GEMINI_API_KEY');
    if (ORIG_URL !== undefined) Deno.env.set('SUPABASE_URL', ORIG_URL);
    else Deno.env.delete('SUPABASE_URL');
    if (ORIG_SRK !== undefined) Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', ORIG_SRK);
    else Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
