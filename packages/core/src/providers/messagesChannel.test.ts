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

function makeFakeClient() {
  let handler: PgHandler | null = null;
  let subscribed = false;

  const channelApi = {
    on: vi.fn((_event: string, _opts: unknown, cb: PgHandler) => {
      handler = cb;
      return channelApi;
    }),
    subscribe: vi.fn(() => {
      subscribed = true;
      return channelApi;
    }),
  };

  const client = {
    channel: vi.fn(() => channelApi),
    removeChannel: vi.fn(),
  };

  return {
    client,
    channelApi,
    emit(row: MessageRow | null) {
      if (!handler) throw new Error('No handler registered');
      handler({ new: row });
    },
    isSubscribed: () => subscribed,
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
});
