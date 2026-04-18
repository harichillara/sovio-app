// Usage:
//   deno run --allow-env --allow-net scripts/load-test-realtime.ts [clients] [threads-per-client]
//
// Defaults: clients=50, threads-per-client=20.
//
// Env required:
//   SUPABASE_URL           — project URL
//   SUPABASE_ANON_KEY      — anon key (test project, NEVER prod)
//
// Env optional:
//   WINDOW_SECONDS         — measurement window, default 60
//   TEST_USER_EMAIL / TEST_USER_PASSWORD — if set, sign in each client as this user
//                            so RLS lets them see messages. Without creds, the script
//                            still opens channels (useful for measuring raw socket
//                            scaling) but won't receive row events.
//
// What it does
// ------------
// Spins up N anonymous Supabase clients. Each one subscribes to a shared
// `messages` INSERT channel with no server-side filter (mirroring the
// multiplex in packages/core/src/providers/messagesChannel.ts). It also picks
// K random thread-ids from a synthetic pool and registers local listeners so
// we can measure per-thread dispatch latency.
//
// After the WINDOW_SECONDS window closes, the script prints a single JSON
// document to stdout with:
//   - clientsConnected              how many clients finished .subscribe()
//   - channelsOpened                total channels across all clients (should equal clientsConnected)
//   - totalEventsReceived           count of INSERT payloads delivered
//   - eventsExpected                count of INSERT rows we *wrote* during the window
//   - droppedPct                    1 - (received / expected), per-client average
//   - timeToFirstMessageMs.{p50,p95,p99}
//
// What the numbers mean
// ---------------------
//   droppedPct > 1%     : realtime fan-out is lossy at this load — investigate before shipping.
//   timeToFirstMessageMs.p99 > 2000  : channel subscribe is slow; check dashboard for CHANNEL_ERROR rate.
//   channelsOpened < clientsConnected : some .subscribe() never resolved; socket pressure.
//
// Safe usage
// ----------
// Point this at a DEDICATED test project. Writing N*K messages per window
// will bloat the test DB; truncate `public.messages` after each run.

if (Deno.env.get('CI')) {
  console.error('refusing to run load test in CI');
  Deno.exit(1);
}

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  Deno.exit(1);
}

const CLIENTS = Number(Deno.args[0] ?? 50);
const THREADS_PER_CLIENT = Number(Deno.args[1] ?? 20);
const WINDOW_SECONDS = Number(Deno.env.get('WINDOW_SECONDS') ?? 60);
const TEST_EMAIL = Deno.env.get('TEST_USER_EMAIL');
const TEST_PASSWORD = Deno.env.get('TEST_USER_PASSWORD');

if (CLIENTS < 1 || THREADS_PER_CLIENT < 1) {
  console.error('clients and threads-per-client must be >= 1');
  Deno.exit(1);
}

console.error(
  `[load-test-realtime] clients=${CLIENTS} threads/client=${THREADS_PER_CLIENT} window=${WINDOW_SECONDS}s`,
);

// -----------------------------------------------------------------------------
// Synthetic thread-id pool. Not real DB rows — we just need stable UUIDs for
// fan-out routing in the listener callbacks. If you want real dispatch, seed
// rows and pass real thread ids instead.
// -----------------------------------------------------------------------------
function makeThreadId(i: number): string {
  const hex = i.toString(16).padStart(12, '0');
  return `00000000-0000-0000-0000-${hex}`;
}

const THREAD_POOL_SIZE = Math.max(THREADS_PER_CLIENT * 4, 100);
const threadPool = Array.from({ length: THREAD_POOL_SIZE }, (_, i) => makeThreadId(i));
function pickThreads(): string[] {
  const picked = new Set<string>();
  while (picked.size < THREADS_PER_CLIENT) {
    picked.add(threadPool[Math.floor(Math.random() * threadPool.length)]);
  }
  return [...picked];
}

// -----------------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------------
interface ClientMetrics {
  id: number;
  subscribed: boolean;
  subscribeStart: number;
  firstEventAt: number | null;
  eventsReceived: number;
}

const metrics: ClientMetrics[] = [];
let totalEventsReceived = 0;
let eventsExpected = 0;
const clients: any[] = [];
const channels: any[] = [];

// -----------------------------------------------------------------------------
// Clean up on Ctrl-C
// -----------------------------------------------------------------------------
let tornDown = false;
async function teardown() {
  if (tornDown) return;
  tornDown = true;
  console.error('[load-test-realtime] tearing down…');
  for (const ch of channels) {
    try { await ch.unsubscribe(); } catch { /* ignore */ }
  }
  for (const c of clients) {
    try { await c.removeAllChannels(); } catch { /* ignore */ }
    try { c.realtime?.disconnect?.(); } catch { /* ignore */ }
  }
}
Deno.addSignalListener('SIGINT', async () => { await teardown(); Deno.exit(130); });

// -----------------------------------------------------------------------------
// Spin up clients
// -----------------------------------------------------------------------------
async function start() {
  for (let i = 0; i < CLIENTS; i++) {
    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      realtime: { params: { eventsPerSecond: '100' } },
    });
    clients.push(client);

    if (TEST_EMAIL && TEST_PASSWORD) {
      const { error } = await client.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      if (error) console.error('[client %d] signin failed: %s', i, error.message);
    }

    const m: ClientMetrics = {
      id: i,
      subscribed: false,
      subscribeStart: performance.now(),
      firstEventAt: null,
      eventsReceived: 0,
    };
    metrics.push(m);

    const myThreads = new Set(pickThreads());

    const ch = client
      .channel(`messages-multiplex-${i}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const row = payload?.new;
          if (!row?.thread_id) return;
          if (!myThreads.has(row.thread_id)) return;
          m.eventsReceived++;
          totalEventsReceived++;
          if (m.firstEventAt === null) m.firstEventAt = performance.now();
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') m.subscribed = true;
      });

    channels.push(ch);
  }

  // Wait up to 30s for all clients to subscribe.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && metrics.some((m) => !m.subscribed)) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const connected = metrics.filter((m) => m.subscribed).length;
  console.error(`[load-test-realtime] ${connected}/${CLIENTS} subscribed; starting window`);

  // -----------------------------------------------------------------------
  // Drive write load. If we have a signed-in user, actually insert rows. If
  // not, skip writes — the operator can drive writes separately (e.g. from
  // the Supabase SQL editor) while this script measures receive side.
  // -----------------------------------------------------------------------
  const writerClient = TEST_EMAIL && TEST_PASSWORD ? clients[0] : null;
  const writeIntervalMs = 200;
  const windowEnd = Date.now() + WINDOW_SECONDS * 1000;
  if (writerClient) {
    const writeLoop = async () => {
      while (Date.now() < windowEnd) {
        const threadId = threadPool[Math.floor(Math.random() * threadPool.length)];
        const { error } = await writerClient
          .from('messages')
          .insert({ thread_id: threadId, content: 'load-test', sender_id: null });
        if (!error) eventsExpected++;
        await new Promise((r) => setTimeout(r, writeIntervalMs));
      }
    };
    writeLoop().catch((e) => console.error('[writer]', e));
  } else {
    console.error(
      '[load-test-realtime] no TEST_USER_EMAIL — not inserting rows. ' +
      'Drive writes externally to measure receive side.',
    );
  }

  await new Promise((r) => setTimeout(r, WINDOW_SECONDS * 1000 + 500));

  // -----------------------------------------------------------------------
  // Report
  // -----------------------------------------------------------------------
  const ttfm = metrics
    .filter((m) => m.firstEventAt !== null)
    .map((m) => (m.firstEventAt! - m.subscribeStart))
    .sort((a, b) => a - b);
  const pct = (p: number) =>
    ttfm.length === 0 ? null : ttfm[Math.min(ttfm.length - 1, Math.floor(ttfm.length * p))];

  const avgReceivedPerClient =
    metrics.reduce((s, m) => s + m.eventsReceived, 0) / Math.max(1, metrics.length);
  const droppedPct =
    eventsExpected === 0 ? null : Math.max(0, 1 - avgReceivedPerClient / eventsExpected);

  const report = {
    config: {
      clients: CLIENTS,
      threadsPerClient: THREADS_PER_CLIENT,
      windowSeconds: WINDOW_SECONDS,
    },
    clientsConnected: connected,
    channelsOpened: channels.length,
    eventsExpected,
    totalEventsReceived,
    droppedPct,
    timeToFirstMessageMs: {
      p50: pct(0.5),
      p95: pct(0.95),
      p99: pct(0.99),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await teardown();
}

start().catch(async (err) => {
  console.error('[load-test-realtime] failed:', err);
  await teardown();
  Deno.exit(1);
});
