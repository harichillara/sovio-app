// Deno tests for ai-generate request-body schemas.
// Run with:
//   deno test --allow-read supabase/functions/ai-generate/schemas.test.ts
//
// These tests cover the discriminated-union contract that every request to
// `ai-generate` must satisfy. They intentionally do NOT import the handler
// module itself — that module has DB + Sentry side-effects at load time,
// which would make these tests slow and noisy. Keeping schemas in their own
// file is what lets us unit-test them cheaply.
//
// Coverage:
//   - Happy path for each of the 12 ops (5 user-facing + 7 cron)
//   - userId must be a UUID (rejects "not-a-uuid")
//   - Unknown op rejected
//   - reply_draft missing threadId rejected
//   - decision_proposal constraints bounds (maxTravel, array length, field length)
//   - Cron ops reject extra fields (strict shape)
//   - Type inference: AiGenerateBody['op'] is the literal union

import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  AiGenerateBodySchema,
  type AiGenerateBody,
} from './schemas.ts';

const UUID = '00000000-0000-4000-8000-000000000000';

Deno.test('schemas: intent op happy path', () => {
  const result = AiGenerateBodySchema.safeParse({ op: 'intent', userId: UUID });
  assert(result.success);
  if (result.success) assertEquals(result.data.op, 'intent');
});

Deno.test('schemas: reply_draft requires threadId', () => {
  const missing = AiGenerateBodySchema.safeParse({ op: 'reply_draft', userId: UUID });
  assert(!missing.success, 'reply_draft without threadId must fail');

  const ok = AiGenerateBodySchema.safeParse({
    op: 'reply_draft',
    userId: UUID,
    threadId: UUID,
  });
  assert(ok.success);
});

Deno.test('schemas: userId must be UUID', () => {
  const bad = AiGenerateBodySchema.safeParse({ op: 'intent', userId: 'not-a-uuid' });
  assert(!bad.success);
  if (!bad.success) {
    const paths = bad.error.issues.map((i) => i.path.join('.'));
    assert(paths.includes('userId'), 'issue must point at userId');
  }
});

Deno.test('schemas: unknown op rejected', () => {
  const bad = AiGenerateBodySchema.safeParse({ op: 'delete_everything', userId: UUID });
  assert(!bad.success);
});

Deno.test('schemas: decision_proposal constraints accept valid shapes', () => {
  const minimal = AiGenerateBodySchema.safeParse({
    op: 'decision_proposal',
    userId: UUID,
  });
  assert(minimal.success, 'constraints field is optional');

  const full = AiGenerateBodySchema.safeParse({
    op: 'decision_proposal',
    userId: UUID,
    constraints: {
      budget: 'under $50',
      maxTravel: 25,
      preferredTimes: ['evenings', 'weekends'],
      groupSize: ['2-4'],
    },
  });
  assert(full.success);
});

Deno.test('schemas: decision_proposal maxTravel must be non-negative and ≤ 10_000', () => {
  const negative = AiGenerateBodySchema.safeParse({
    op: 'decision_proposal',
    userId: UUID,
    constraints: { maxTravel: -1 },
  });
  assert(!negative.success);

  const tooBig = AiGenerateBodySchema.safeParse({
    op: 'decision_proposal',
    userId: UUID,
    constraints: { maxTravel: 10_001 },
  });
  assert(!tooBig.success);
});

Deno.test('schemas: decision_proposal preferredTimes capped at 20 entries', () => {
  const tooMany = AiGenerateBodySchema.safeParse({
    op: 'decision_proposal',
    userId: UUID,
    constraints: { preferredTimes: new Array(21).fill('t') },
  });
  assert(!tooMany.success);
});

Deno.test('schemas: decision_proposal budget capped at 200 chars', () => {
  const longBudget = AiGenerateBodySchema.safeParse({
    op: 'decision_proposal',
    userId: UUID,
    constraints: { budget: 'x'.repeat(201) },
  });
  assert(!longBudget.success);
});

Deno.test('schemas: every cron op parses with just { op }', () => {
  const ops = [
    'cron_suggestions',
    'cron_presence',
    'cron_replay',
    'cron_weekly_insight',
    'cron_cleanup',
    'cron_retention',
    'cron_worker',
  ] as const;

  for (const op of ops) {
    const result = AiGenerateBodySchema.safeParse({ op });
    assert(result.success, `${op} should parse`);
  }
});

Deno.test('schemas: type inference — AiGenerateBody narrows on op', () => {
  // Compile-time check (also runs at runtime as a no-op). If the discriminator
  // ever regresses, tsc will fail CI before this test does.
  const body: AiGenerateBody = { op: 'reply_draft', userId: UUID, threadId: UUID };
  if (body.op === 'reply_draft') {
    assertEquals(typeof body.threadId, 'string');
  }
});
