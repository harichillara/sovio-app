// Deno tests for the structured JSON logger.
// Run with: deno test --allow-env supabase/functions/_shared/logger.test.ts

import {
  assertEquals,
  assert,
  assertMatch,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { Logger, createRequestLogger } from './logger.ts';

// Capture console output without clobbering global state for other tests.
function captureConsole(fn: () => void): { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (line: string) => { out.push(line); };
  console.error = (line: string) => { err.push(line); };
  try {
    fn();
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return { out, err };
}

Deno.test('Logger.info emits a single JSON line to stdout', () => {
  const logger = new Logger({ request_id: 'req-1', fn: 'test-fn' });
  const { out, err } = captureConsole(() => logger.info('hello', { k: 'v' }));
  assertEquals(err.length, 0);
  assertEquals(out.length, 1);
  const parsed = JSON.parse(out[0]);
  assertEquals(parsed.level, 'info');
  assertEquals(parsed.msg, 'hello');
  assertEquals(parsed.request_id, 'req-1');
  assertEquals(parsed.fn, 'test-fn');
  assertEquals(parsed.k, 'v');
  assertMatch(parsed.ts, /^\d{4}-\d{2}-\d{2}T/);
});

Deno.test('Logger.error and .warn route to stderr', () => {
  const logger = new Logger({ request_id: 'r', fn: 'f' });
  const { out, err } = captureConsole(() => {
    logger.error('boom');
    logger.warn('heads up');
  });
  assertEquals(out.length, 0);
  assertEquals(err.length, 2);
  assertEquals(JSON.parse(err[0]).level, 'error');
  assertEquals(JSON.parse(err[1]).level, 'warn');
});

Deno.test('Logger.child merges context without mutating parent', () => {
  const root = new Logger({ request_id: 'r', fn: 'f' });
  const scoped = root.child({ user_id: 'u-1', op: 'weekly_insight' });

  const { out } = captureConsole(() => {
    scoped.info('scoped');
    root.info('root');
  });
  assertEquals(out.length, 2);
  const scopedLine = JSON.parse(out[0]);
  const rootLine = JSON.parse(out[1]);

  assertEquals(scopedLine.user_id, 'u-1');
  assertEquals(scopedLine.op, 'weekly_insight');
  assertEquals(rootLine.user_id, undefined);
  assertEquals(rootLine.op, undefined);
});

Deno.test('Logger serializes Error objects into { name, message, stack? }', () => {
  const logger = new Logger({ request_id: 'r', fn: 'f' });
  const err = new Error('kaboom');
  const { err: errLines } = captureConsole(() => logger.error('failed', { err }));
  const parsed = JSON.parse(errLines[0]);
  assertEquals(parsed.err.name, 'Error');
  assertEquals(parsed.err.message, 'kaboom');
  // In non-prod DENO_ENV, stack should be populated
  assert(parsed.err.stack === undefined || typeof parsed.err.stack === 'string');
});

Deno.test('Logger suppresses stack in production', () => {
  const logger = new Logger({ request_id: 'r', fn: 'f' });
  const original = Deno.env.get('DENO_ENV');
  Deno.env.set('DENO_ENV', 'production');
  try {
    const err = new Error('kaboom');
    const { err: errLines } = captureConsole(() => logger.error('failed', { err }));
    const parsed = JSON.parse(errLines[0]);
    assertEquals(parsed.err.stack, undefined);
    assertEquals(parsed.err.message, 'kaboom');
  } finally {
    if (original === undefined) {
      Deno.env.delete('DENO_ENV');
    } else {
      Deno.env.set('DENO_ENV', original);
    }
  }
});

Deno.test('createRequestLogger generates a fresh UUID per request', () => {
  const a = createRequestLogger('fn-a');
  const b = createRequestLogger('fn-a');
  const { out } = captureConsole(() => {
    a.info('x');
    b.info('x');
  });
  const aid = JSON.parse(out[0]).request_id;
  const bid = JSON.parse(out[1]).request_id;
  assert(aid !== bid, 'request_ids must differ between requests');
  assertMatch(aid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});
