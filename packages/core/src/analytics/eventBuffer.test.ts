import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock supabase client — use vi.hoisted so the mock fn is visible inside
// vi.mock's factory (which runs before imports resolve).
// ---------------------------------------------------------------------------

const { mockInsert, mockFrom, addEventListenerSpy } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  const addEventListenerSpy = vi.fn();
  return { mockInsert, mockFrom, addEventListenerSpy };
});

vi.mock('../supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Stub react-native so the dynamic require() inside registerLifecycleHandlers
// doesn't blow up in node-env.
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocking
// ---------------------------------------------------------------------------

import { EventBuffer } from './eventBuffer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function flushMicrotasks() {
  // Allow the pending fire-and-forget flush() promise to settle. Under
  // vi.useFakeTimers() setImmediate / setTimeout are mocked, so we use
  // vi.runAllTicks / queueMicrotask-compatible drains plus a real-timer
  // yield on top.
  await vi.runAllTimersAsync();
  // A few microtask turns to let chained thenables resolve.
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInsert.mockReset();
    mockFrom.mockClear();
    addEventListenerSpy.mockReset();
    // Patch global addEventListener for the beforeunload test. Use
    // Object.defineProperty because globalThis is read-only in some envs.
    Object.defineProperty(globalThis, 'addEventListener', {
      value: addEventListenerSpy,
      configurable: true,
      writable: true,
    });
    mockInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes when the buffer reaches maxBatchSize', async () => {
    const buf = new EventBuffer({ maxBatchSize: 3, flushIntervalMs: 10_000 });

    buf.track({ user_id: 'u1', event_type: 'home_viewed' });
    buf.track({ user_id: 'u1', event_type: 'home_viewed' });
    expect(mockInsert).not.toHaveBeenCalled();

    buf.track({ user_id: 'u1', event_type: 'home_viewed' });
    await flushMicrotasks();

    expect(mockFrom).toHaveBeenCalledWith('app_events');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const batch = mockInsert.mock.calls[0][0] as unknown[];
    expect(batch).toHaveLength(3);
    expect(buf.getBufferSize()).toBe(0);
  });

  it('flushes after flushIntervalMs even if max not reached', async () => {
    const buf = new EventBuffer({ maxBatchSize: 100, flushIntervalMs: 2000 });

    buf.track({ user_id: 'u1', event_type: 'home_viewed' });
    buf.track({ user_id: 'u1', event_type: 'plan_created' });
    expect(mockInsert).not.toHaveBeenCalled();

    // Advance past the 2s window.
    vi.advanceTimersByTime(2001);
    await flushMicrotasks();

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const batch = mockInsert.mock.calls[0][0] as unknown[];
    expect(batch).toHaveLength(2);
  });

  it('flushes immediately on manual flush()', async () => {
    const buf = new EventBuffer({ maxBatchSize: 100, flushIntervalMs: 60_000 });

    buf.track({ user_id: 'u1', event_type: 'home_viewed' });
    await buf.flush();

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(buf.getBufferSize()).toBe(0);
  });

  it('flush() on empty buffer is a no-op', async () => {
    const buf = new EventBuffer();
    await buf.flush();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('drop-on-error does not crash and increments the drop counter', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { message: 'connection reset by peer' },
    });

    const buf = new EventBuffer({ maxBatchSize: 100, flushIntervalMs: 60_000 });
    // Silence expected console.warn during this test.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    buf.track({ user_id: 'u1', event_type: 'home_viewed' });
    buf.track({ user_id: 'u1', event_type: 'plan_created' });

    await buf.flush(); // must not throw

    expect(buf.getDroppedCount()).toBe(2);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('drop-on-thrown-exception also increments drop counter', async () => {
    mockInsert.mockRejectedValueOnce(new Error('network offline'));

    const buf = new EventBuffer({ maxBatchSize: 100, flushIntervalMs: 60_000 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    buf.track({ user_id: 'u1', event_type: 'home_viewed' });
    await buf.flush(); // must not throw

    expect(buf.getDroppedCount()).toBe(1);
    warnSpy.mockRestore();
  });

  it('does not retry a dropped batch on the next flush', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { message: 'transient' },
    });
    mockInsert.mockResolvedValueOnce({ error: null });

    const buf = new EventBuffer({ maxBatchSize: 100, flushIntervalMs: 60_000 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    buf.track({ user_id: 'u1', event_type: 'home_viewed' });
    await buf.flush();

    // Second event + flush should NOT contain the first event.
    buf.track({ user_id: 'u1', event_type: 'plan_created' });
    await buf.flush();

    expect(mockInsert).toHaveBeenCalledTimes(2);
    const secondBatch = mockInsert.mock.calls[1][0] as Array<{ event_type: string }>;
    expect(secondBatch).toHaveLength(1);
    expect(secondBatch[0].event_type).toBe('plan_created');
    warnSpy.mockRestore();
  });

  it('registers a beforeunload handler on first track()', () => {
    const buf = new EventBuffer();
    buf.track({ user_id: 'u1', event_type: 'home_viewed' });

    const calls = addEventListenerSpy.mock.calls;
    const beforeUnloadCall = calls.find((c) => c[0] === 'beforeunload');
    expect(beforeUnloadCall).toBeDefined();
    expect(typeof beforeUnloadCall![1]).toBe('function');
  });

  it('beforeunload handler invokes flush()', async () => {
    const buf = new EventBuffer({ maxBatchSize: 100, flushIntervalMs: 60_000 });
    buf.track({ user_id: 'u1', event_type: 'home_viewed' });

    const beforeUnloadCall = addEventListenerSpy.mock.calls.find(
      (c) => c[0] === 'beforeunload',
    );
    expect(beforeUnloadCall).toBeDefined();
    const handler = beforeUnloadCall![1] as () => void;

    handler();
    await flushMicrotasks();

    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('only arms one flush timer per batch (steady-trickle does not postpone)', async () => {
    const buf = new EventBuffer({ maxBatchSize: 100, flushIntervalMs: 2000 });

    buf.track({ user_id: 'u1', event_type: 'home_viewed' });
    vi.advanceTimersByTime(1500);
    buf.track({ user_id: 'u1', event_type: 'plan_created' });
    vi.advanceTimersByTime(600); // total 2100ms since first event

    await flushMicrotasks();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
