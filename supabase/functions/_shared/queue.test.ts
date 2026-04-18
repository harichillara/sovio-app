// Deno tests for the queue helper.
// Run with: deno test --allow-env --allow-net supabase/functions/_shared/queue.test.ts

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  enqueueAiJob,
  claimAiJobs,
  completeAiJob,
  failAiJob,
  nextBackoffSeconds,
  runJobs,
  type ClaimedJob,
} from './queue.ts';

// ---------------------------------------------------------------------------
// Scripted Supabase stub — records RPC calls and returns scripted replies.
// ---------------------------------------------------------------------------

type RpcCall = { fn: string; args: unknown };
type RpcReply = { data: unknown; error: { message: string } | null };

function mockSupabase(queue: RpcReply[]) {
  const calls: RpcCall[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    rpc(fn: string, args: unknown) {
      calls.push({ fn, args });
      const next = queue.shift() ?? { data: null, error: null };
      return Promise.resolve(next);
    },
  };
  return { client, calls };
}

// ---------------------------------------------------------------------------
// enqueueAiJob
// ---------------------------------------------------------------------------

Deno.test('enqueueAiJob: maps a successful enqueue', async () => {
  const { client, calls } = mockSupabase([
    { data: [{ id: '00000000-0000-0000-0000-000000000001', enqueued: true }], error: null },
  ]);

  const out = await enqueueAiJob(client, {
    userId: 'u1',
    jobType: 'suggestions',
    payload: { hi: 1 },
    jobKey: 'suggestions:u1:2026041600',
  });

  assertEquals(out.enqueued, true);
  assertEquals(out.id, '00000000-0000-0000-0000-000000000001');
  assertEquals(calls[0].fn, 'enqueue_ai_job');
  // Payload forwarded, jobKey forwarded.
  const args = calls[0].args as Record<string, unknown>;
  assertEquals(args.p_user_id, 'u1');
  assertEquals(args.p_job_type, 'suggestions');
  assertEquals(args.p_job_key, 'suggestions:u1:2026041600');
});

Deno.test('enqueueAiJob: dedup hit returns enqueued=false', async () => {
  const { client } = mockSupabase([
    { data: [{ id: null, enqueued: false }], error: null },
  ]);

  const out = await enqueueAiJob(client, { userId: 'u1', jobType: 'suggestions' });
  assertEquals(out.enqueued, false);
  assertEquals(out.id, null);
});

Deno.test('enqueueAiJob: RPC error → enqueued=false (fan-out-safe)', async () => {
  const { client } = mockSupabase([
    { data: null, error: { message: 'boom' } },
  ]);

  const out = await enqueueAiJob(client, { userId: 'u1', jobType: 'suggestions' });
  // Fail-closed on enqueue: don't throw, but signal skipped.
  assertEquals(out.enqueued, false);
});

// ---------------------------------------------------------------------------
// claimAiJobs
// ---------------------------------------------------------------------------

Deno.test('claimAiJobs: maps rows to typed ClaimedJob', async () => {
  const { client } = mockSupabase([
    {
      data: [
        {
          id: 'j1',
          user_id: 'u1',
          job_type: 'suggestions',
          payload: { foo: 'bar' },
          attempt: 1,
          max_attempts: 3,
          claim_token: 't1',
        },
      ],
      error: null,
    },
  ]);

  const jobs = await claimAiJobs(client, 4, 60);
  assertEquals(jobs.length, 1);
  assertEquals(jobs[0].id, 'j1');
  assertEquals(jobs[0].userId, 'u1');
  assertEquals(jobs[0].jobType, 'suggestions');
  assertEquals(jobs[0].payload, { foo: 'bar' });
  assertEquals(jobs[0].attempt, 1);
  assertEquals(jobs[0].claimToken, 't1');
});

Deno.test('claimAiJobs: empty queue returns []', async () => {
  const { client } = mockSupabase([{ data: [], error: null }]);
  const jobs = await claimAiJobs(client);
  assertEquals(jobs, []);
});

Deno.test('claimAiJobs: RPC error returns [] (worker backs off, doesn\'t crash)', async () => {
  const { client } = mockSupabase([{ data: null, error: { message: 'db down' } }]);
  const jobs = await claimAiJobs(client);
  assertEquals(jobs, []);
});

// ---------------------------------------------------------------------------
// completeAiJob
// ---------------------------------------------------------------------------

Deno.test('completeAiJob: row_count=1 → true', async () => {
  const { client, calls } = mockSupabase([{ data: 1, error: null }]);
  const ok = await completeAiJob(client, 'j1', 't1', { n: 42 });
  assertEquals(ok, true);
  assertEquals(calls[0].fn, 'complete_ai_job');
  const args = calls[0].args as Record<string, unknown>;
  assertEquals(args.p_id, 'j1');
  assertEquals(args.p_claim_token, 't1');
});

Deno.test('completeAiJob: row_count=0 → false (stale ack)', async () => {
  const { client } = mockSupabase([{ data: 0, error: null }]);
  const ok = await completeAiJob(client, 'j1', 'old-token');
  assertEquals(ok, false);
});

// ---------------------------------------------------------------------------
// failAiJob
// ---------------------------------------------------------------------------

Deno.test('failAiJob: code=1 → retry, code=2 → dlq, code=0 → stale', async () => {
  const cases: Array<[number, 'retry' | 'dlq' | 'stale']> = [
    [1, 'retry'],
    [2, 'dlq'],
    [0, 'stale'],
  ];
  for (const [code, expected] of cases) {
    const { client } = mockSupabase([{ data: code, error: null }]);
    const out = await failAiJob(client, 'j1', 't1', 'err', 60);
    assertEquals(out, expected, `code=${code}`);
  }
});

Deno.test('failAiJob: caps error string to 2000 chars before persisting', async () => {
  const { client, calls } = mockSupabase([{ data: 1, error: null }]);
  const longErr = 'x'.repeat(5000);
  await failAiJob(client, 'j1', 't1', longErr, 60);
  const args = calls[0].args as Record<string, unknown>;
  assertEquals((args.p_error as string).length, 2000);
});

Deno.test('failAiJob: clamps retry_in_seconds to >= 1', async () => {
  const { client, calls } = mockSupabase([{ data: 1, error: null }]);
  await failAiJob(client, 'j1', 't1', 'err', 0);
  const args = calls[0].args as Record<string, unknown>;
  assertEquals(args.p_retry_in_seconds, 1);
});

// ---------------------------------------------------------------------------
// nextBackoffSeconds
// ---------------------------------------------------------------------------

Deno.test('nextBackoffSeconds: grows with attempt, respects the 15-min cap', () => {
  // With jitter the value is random within [1, exp], so we can't assert
  // equality — just that it's bounded correctly and non-negative.
  for (let attempt = 1; attempt <= 10; attempt++) {
    const v = nextBackoffSeconds(attempt);
    assert(v >= 1, `attempt=${attempt} value=${v} >= 1`);
    assert(v <= 15 * 60, `attempt=${attempt} value=${v} <= 900`);
  }
});

// ---------------------------------------------------------------------------
// runJobs — the full claim/execute/ack loop
// ---------------------------------------------------------------------------

Deno.test('runJobs: success path calls completeAiJob with result', async () => {
  const { client, calls } = mockSupabase([
    { data: 1, error: null }, // complete for j1
    { data: 1, error: null }, // complete for j2
  ]);

  const jobs: ClaimedJob[] = [
    { id: 'j1', userId: 'u1', jobType: 't', payload: {}, attempt: 1, maxAttempts: 3, claimToken: 'tk1' },
    { id: 'j2', userId: 'u2', jobType: 't', payload: {}, attempt: 1, maxAttempts: 3, claimToken: 'tk2' },
  ];

  const counts = await runJobs(client, jobs, async (job) => ({ handled: job.id }), 2);

  assertEquals(counts.succeeded, 2);
  assertEquals(counts.retried, 0);
  assertEquals(counts.dlq, 0);
  // Each completion forwards the handler's return value as the result jsonb.
  const args0 = calls[0].args as Record<string, unknown>;
  assert(args0.p_result !== null);
});

Deno.test('runJobs: handler throws → failAiJob called with the message', async () => {
  const { client, calls } = mockSupabase([
    { data: 1, error: null }, // fail → retry
  ]);

  const jobs: ClaimedJob[] = [
    { id: 'j1', userId: 'u1', jobType: 't', payload: {}, attempt: 1, maxAttempts: 3, claimToken: 'tk1' },
  ];

  const counts = await runJobs(client, jobs, () => {
    throw new Error('Gemini 503');
  });

  assertEquals(counts.retried, 1);
  const args = calls[0].args as Record<string, unknown>;
  assertEquals(args.p_error, 'Gemini 503');
});

Deno.test('runJobs: bounded concurrency — never more than N handlers in flight', async () => {
  // Three RPC replies — one per job completion.
  const { client } = mockSupabase([
    { data: 1, error: null },
    { data: 1, error: null },
    { data: 1, error: null },
    { data: 1, error: null },
  ]);

  const jobs: ClaimedJob[] = Array.from({ length: 4 }, (_, i) => ({
    id: `j${i}`,
    userId: `u${i}`,
    jobType: 't',
    payload: {},
    attempt: 1,
    maxAttempts: 3,
    claimToken: `tk${i}`,
  }));

  let inflight = 0;
  let maxInflight = 0;

  await runJobs(
    client,
    jobs,
    async () => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      // Yield to the event loop so other workers can pick up jobs.
      await new Promise((r) => setTimeout(r, 5));
      inflight--;
    },
    2, // concurrency
  );

  assert(maxInflight <= 2, `maxInflight=${maxInflight} exceeded concurrency=2`);
  // But we did actually go parallel — otherwise the test is meaningless.
  assert(maxInflight >= 2, `maxInflight=${maxInflight} never reached concurrency`);
});
