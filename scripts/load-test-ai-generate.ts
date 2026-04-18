// Usage:
//   deno run --allow-env --allow-net scripts/load-test-ai-generate.ts
//
// Env required:
//   SUPABASE_URL       — project URL (e.g. https://xyzco.supabase.co)
//   USER_JWT           — a signed-in user's access token. Generate via:
//                          supabase auth sign-in --email test@sovio.app --password …
//                        or the Supabase dashboard "Impersonate user" flow in a
//                        non-prod project. NEVER use a prod user's token.
//
// Env optional:
//   CONCURRENCY        — parallel workers, default 10
//   DURATION_SECONDS   — total wall-clock test length, default 30
//   OP                 — edge-fn op to hit, default 'intent'
//
// Purpose
// -------
// Prove that the server-side rate limit on the `ai-generate` edge function
// (60/hr for free users, 600/hr for pro; enforced in supabase/functions)
// actually holds under concurrent load. This is a NEGATIVE test: we WANT to
// see 429s once the quota is consumed. The report tells you how many
// requests got through before the wall hit, and whether latency stayed sane
// during the 429 storm.
//
// What the numbers mean
// ---------------------
//   total                         total requests issued during DURATION_SECONDS
//   status.200                    how many were served (200 OK)
//   status.429                    how many were rate-limited
//   status.5xx                    server errors — should be near zero
//   errors                        network-level failures (timeout, DNS, etc.)
//   latencyMs.{p50,p95,p99}       response-time distribution across ALL requests
//
// Expected result for a fresh free-tier user, CONCURRENCY=10, DURATION_SECONDS=30:
//   status.200  ≈ 60   (the whole hour's quota)
//   status.429  = total - 60
//   status.5xx  = 0
//   latencyMs.p99 stays under ~2s even while 429s dominate
//
// If status.200 > 60 the rate limiter is broken. If status.5xx > 0 or
// latencyMs spikes, the edge function is falling over under the 429 burst —
// either way, a real bug.
//
// Safe usage
// ----------
// DO NOT run against prod. The USER_JWT must belong to a test account in a
// test project. Every request consumes (or attempts to consume) that user's
// hourly quota; a prod user would be locked out for the rest of the hour.

if (Deno.env.get('CI')) {
  console.error('refusing to run load test in CI');
  Deno.exit(1);
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const USER_JWT = Deno.env.get('USER_JWT');
if (!SUPABASE_URL || !USER_JWT) {
  console.error('SUPABASE_URL and USER_JWT are required');
  Deno.exit(1);
}

const CONCURRENCY = Number(Deno.env.get('CONCURRENCY') ?? 10);
const DURATION_SECONDS = Number(Deno.env.get('DURATION_SECONDS') ?? 30);
const OP = Deno.env.get('OP') ?? 'intent';

if (CONCURRENCY < 1 || DURATION_SECONDS < 1) {
  console.error('CONCURRENCY and DURATION_SECONDS must be >= 1');
  Deno.exit(1);
}

const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/ai-generate`;

console.error(
  `[load-test-ai-generate] endpoint=${endpoint} concurrency=${CONCURRENCY} duration=${DURATION_SECONDS}s op=${OP}`,
);

const statusCounts = new Map<number, number>();
let errors = 0;
const latencies: number[] = [];
let stop = false;

async function worker(): Promise<void> {
  while (!stop) {
    const started = performance.now();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USER_JWT}`,
        },
        body: JSON.stringify({ op: OP, input: { text: 'load-test ping' } }),
      });
      // Drain body so the socket can be reused.
      await res.text().catch(() => undefined);
      const lat = performance.now() - started;
      latencies.push(lat);
      statusCounts.set(res.status, (statusCounts.get(res.status) ?? 0) + 1);
    } catch (_err) {
      errors++;
      latencies.push(performance.now() - started);
    }
  }
}

Deno.addSignalListener('SIGINT', () => {
  stop = true;
});

const workers = Array.from({ length: CONCURRENCY }, () => worker());
setTimeout(() => { stop = true; }, DURATION_SECONDS * 1000);

await Promise.all(workers);

latencies.sort((a, b) => a - b);
const pct = (p: number) =>
  latencies.length === 0
    ? null
    : Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] * 10) / 10;

const status = Object.fromEntries(
  [...statusCounts.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [String(k), v]),
);

const fivexx = [...statusCounts.entries()]
  .filter(([k]) => k >= 500 && k < 600)
  .reduce((s, [, v]) => s + v, 0);

const total = [...statusCounts.values()].reduce((s, v) => s + v, 0) + errors;

const report = {
  config: {
    concurrency: CONCURRENCY,
    durationSeconds: DURATION_SECONDS,
    op: OP,
  },
  total,
  status,
  status5xxTotal: fivexx,
  errors,
  latencyMs: {
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
  },
};

console.log(JSON.stringify(report, null, 2));
