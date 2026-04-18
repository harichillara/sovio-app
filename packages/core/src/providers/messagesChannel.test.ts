import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  subscribeToThreadMessages,
  __resetMessagesChannelForTests,
  __getMessagesChannelStateForTests,
  type MessageRow,
} from './messagesChannel';

// ---------------------------------------------------------------------------
// Test harness: a fake Supabase client that records every channel/on/subscribe
// call and lets tests push simulated postgres_changes payloads.
// ---------------------------------------------------------------------------

type PgHandler = (payload: { new?: MessageRow | null }) => void;
type StatusCallback = (status: string, err?: Error) => void;

function makeFakeClient() {
  // Each channel created by .channel() gets its own handler/status cb so
  // tests that open a second channel after a CHANNEL_ERROR can still
  // route emits to the current one.
  const channels: Array<{
    handler: PgHandler | null;
    statusCb: StatusCallback | null;
    api: {
      on: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
    };
  }> = [];

  function makeChannel() {
    const rec: (typeof channels)[number] = {
      handler: null,
      statusCb: null,
      // cast-through — vi.fn typing is noisy
      api: null as never,
    };
    const api = {
      on: vi.fn((_event: string, _opts: unknown, cb: PgHandler) => {
        rec.handler = cb;
        return api;
      }),
      subscribe: vi.fn((cb?: StatusCallback) => {
        rec.statusCb = cb ?? null;
        return api;
      }),
    };
    rec.api = api;
    channels.push(rec);
    return api;
  }

  const client = {
    channel: vi.fn(() => makeChannel()),
    removeChannel: vi.fn(),
  };

  return {
    client,
    channels,
    emit(row: MessageRow | null) {
      const current = channels[channels.length - 1];
      if (!current?.handler) throw new Error('No handler registered');
      current.handler({ new: row });
    },
    fireStatus(status: string, err?: Error, index = channels.length - 1) {
      const rec = channels[index];
      if (!rec?.statusCb) throw new Error('No status cb registered');
      rec.statusCb(status, err);
    },
  };
}

beforeEach(() => {
  __resetMessagesChannelForTests();
});

describe('subscribeToThreadMessages', () => {
  it('opens one channel for the first subscriber and reuses it for the second', () => {
    const h = makeFakeClient();

    const unsub1 = subscribeToThreadMessages(h.client as never, 't1', {
      onInsert: vi.fn(),
    });
    expect(h.client.channel).toHaveBeenCalledTimes(1);

    const unsub2 = subscribeToThreadMessages(h.client as never, 't2', {
      onInsert: vi.fn(),
    });
    // Same channel — no second .channel() call.
    expect(h.client.channel).toHaveBeenCalledTimes(1);

    const snap = __getMessagesChannelStateForTests();
    expect(snap.hasChannel).toBe(true);
    expect(snap.refCount).toBe(2);
    expect(snap.threadCount).toBe(2);

    unsub1();
    unsub2();
  });

  it('tears down the channel only when the last subscriber unregisters', () => {
    const h = makeFakeClient();

    const unsub1 = subscribeToThreadMessages(h.client as never, 't1', {
      onInsert: vi.fn(),
    });
    const unsub2 = subscribeToThreadMessages(h.client as never, 't2', {
      onInsert: vi.fn(),
    });

    unsub1();
    expect(h.client.removeChannel).not.toHaveBeenCalled();
    expect(__getMessagesChannelStateForTests().hasChannel).toBe(true);

    unsub2();
    expect(h.client.removeChannel).toHaveBeenCalledTimes(1);
    expect(__getMessagesChannelStateForTests().hasChannel).toBe(false);
  });

  it('routes INSERT events to the correct thread listener only', () => {
    const h = makeFakeClient();
    const onT1 = vi.fn();
    const onT2 = vi.fn();

    subscribeToThreadMessages(h.client as never, 't1', { onInsert: onT1 });
    subscribeToThreadMessages(h.client as never, 't2', { onInsert: onT2 });

    h.emit({ id: 'm1', thread_id: 't1', sender_id: 'u1', content: 'hi', created_at: '' });
    expect(onT1).toHaveBeenCalledTimes(1);
    expect(onT2).not.toHaveBeenCalled();

    h.emit({ id: 'm2', thread_id: 't2', sender_id: 'u1', content: 'yo', created_at: '' });
    expect(onT2).toHaveBeenCalledTimes(1);
  });

  it('silently drops events for threads with no listener', () => {
    const h = makeFakeClient();
    const onT1 = vi.fn();
    subscribeToThreadMessages(h.client as never, 't1', { onInsert: onT1 });

    expect(() =>
      h.emit({ id: 'mX', thread_id: 'other-thread', sender_id: 'u', content: 'x', created_at: '' }),
    ).not.toThrow();
    expect(onT1).not.toHaveBeenCalled();
  });

  it('supports multiple listeners for the same thread (fan-out)', () => {
    const h = makeFakeClient();
    const a = vi.fn();
    const b = vi.fn();
    subscribeToThreadMessages(h.client as never, 't1', { onInsert: a });
    subscribeToThreadMessages(h.client as never, 't1', { onInsert: b });

    h.emit({ id: 'm1', thread_id: 't1', sender_id: 'u1', content: '', created_at: '' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('isolates listener exceptions so fan-out continues', () => {
    const h = makeFakeClient();
    const a = vi.fn(() => {
      throw new Error('bad listener');
    });
    const b = vi.fn();
    // Silence the expected console.error from the thrown exception
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    subscribeToThreadMessages(h.client as never, 't1', { onInsert: a });
    subscribeToThreadMessages(h.client as never, 't1', { onInsert: b });

    h.emit({ id: 'm1', thread_id: 't1', sender_id: 'u1', content: '', created_at: '' });
    expect(b).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('ignores payloads with no thread_id', () => {
    const h = makeFakeClient();
    const a = vi.fn();
    subscribeToThreadMessages(h.client as never, 't1', { onInsert: a });

    // Payload with null .new (delete events, malformed WAL, etc.)
    expect(() => h.emit(null)).not.toThrow();
    expect(a).not.toHaveBeenCalled();
  });

  it('double-teardown is a no-op', () => {
    const h = makeFakeClient();
    const unsub = subscribeToThreadMessages(h.client as never, 't1', { onInsert: vi.fn() });
    unsub();
    unsub();
    expect(h.client.removeChannel).toHaveBeenCalledTimes(1);
  });

  // ---------- F1: status-callback recovery paths ----------

  it('on CHANNEL_ERROR tears down the dead channel and next subscribe opens a fresh one', () => {
    const h = makeFakeClient();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const onT1 = vi.fn();
    subscribeToThreadMessages(h.client as never, 't1', { onInsert: onT1 });
    expect(h.client.channel).toHaveBeenCalledTimes(1);

    // Simulate Supabase reporting a subscription failure.
    h.fireStatus('CHANNEL_ERROR', new Error('RLS rejected'));

    expect(h.client.removeChannel).toHaveBeenCalledTimes(1);
    expect(__getMessagesChannelStateForTests().hasChannel).toBe(false);
    // But the listener registration is intact — refCount still 1 — so
    // the app doesn't lose its subscription intent.
    expect(__getMessagesChannelStateForTests().refCount).toBe(1);

    // A fresh subscribe call should bootstrap a NEW channel (the
    // previous one being null triggers the lazy-create branch).
    subscribeToThreadMessages(h.client as never, 't2', { onInsert: vi.fn() });
    expect(h.client.channel).toHaveBeenCalledTimes(2);
    expect(__getMessagesChannelStateForTests().hasChannel).toBe(true);

    err.mockRestore();
  });

  it.each(['TIMED_OUT', 'CLOSED'])(
    'treats %s the same as CHANNEL_ERROR (terminal)',
    (status) => {
      const h = makeFakeClient();
      const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      subscribeToThreadMessages(h.client as never, 't1', { onInsert: vi.fn() });
      h.fireStatus(status);

      expect(h.client.removeChannel).toHaveBeenCalledTimes(1);
      expect(__getMessagesChannelStateForTests().hasChannel).toBe(false);

      err.mockRestore();
    },
  );

  it('SUBSCRIBED status is a no-op — channel stays live', () => {
    const h = makeFakeClient();
    subscribeToThreadMessages(h.client as never, 't1', { onInsert: vi.fn() });

    h.fireStatus('SUBSCRIBED');

    expect(h.client.removeChannel).not.toHaveBeenCalled();
    expect(__getMessagesChannelStateForTests().hasChannel).toBe(true);
  });

  it('a stale status callback from a replaced channel is ignored', () => {
    const h = makeFakeClient();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    subscribeToThreadMessages(h.client as never, 't1', { onInsert: vi.fn() });
    // Force a new channel: error on the first one, then subscribe again.
    h.fireStatus('CHANNEL_ERROR');
    subscribeToThreadMessages(h.client as never, 't2', { onInsert: vi.fn() });
    expect(h.client.channel).toHaveBeenCalledTimes(2);

    // Now fire a late CHANNEL_ERROR from the FIRST channel — the
    // handler must recognize it's no longer `state.channel` and not
    // tear down the current one.
    h.fireStatus('CHANNEL_ERROR', undefined, 0);

    // Still exactly one removeChannel from the original teardown —
    // the stale callback must NOT have triggered another.
    expect(h.client.removeChannel).toHaveBeenCalledTimes(1);
    expect(__getMessagesChannelStateForTests().hasChannel).toBe(true);

    err.mockRestore();
  });

  it('tolerates removeChannel throwing inside the status recovery path', () => {
    const h = makeFakeClient();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.client.removeChannel.mockImplementationOnce(() => {
      throw new Error('already torn down');
    });

    subscribeToThreadMessages(h.client as never, 't1', { onInsert: vi.fn() });

    expect(() => h.fireStatus('CHANNEL_ERROR')).not.toThrow();
    expect(__getMessagesChannelStateForTests().hasChannel).toBe(false);

    err.mockRestore();
  });
});
