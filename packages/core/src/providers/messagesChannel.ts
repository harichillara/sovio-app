/**
 * Shared Realtime channel manager for `messages` INSERTs.
 *
 * Why a module-level singleton instead of per-thread channels?
 * ------------------------------------------------------------
 * The original `useRealtimeMessages(threadId)` hook opened a fresh
 * `supabase.channel(...)` per thread with a server-side
 * `thread_id=eq.<id>` filter. Each channel costs a WebSocket
 * subscription slot, and Supabase's client-side ceiling is ~200
 * concurrent channels. Power users who skim 20+ threads in a session
 * could stack channels faster than they unmount (strict-mode double
 * mounts, web tab multiplexing, mobile modal stacking, etc.).
 *
 * Instead, all threads share ONE channel that listens to every row
 * INSERT on `public.messages`. Row-Level Security on the `messages`
 * table already restricts events to threads the user participates in
 * (policy: "Thread members view messages" — EXISTS join on
 * thread_participants). So the server-side filter was pure duplication
 * of RLS.
 *
 * Ref-counting:
 *   - Subscribers register per-threadId and receive a teardown fn.
 *   - On the first registration, the singleton channel is created.
 *   - On the last unregister, the channel is torn down (so we don't
 *     leak a WebSocket when the user logs out and re-logs).
 *
 * Dispatch:
 *   - Incoming INSERT payload carries `new.thread_id`. We look up
 *     registered listeners for that thread and fan out.
 *   - Messages for threads nobody is actively viewing still arrive
 *     (RLS allowed them) but get silently dropped here — the user's
 *     thread list will still pick them up on next refetch.
 *
 * This module is intentionally framework-agnostic; the React glue
 * lives in `useMessages.useRealtimeMessages`. That makes it trivial
 * to unit-test the ref-counting + dispatch logic with a fake supabase
 * client.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface MessagesChannelListener {
  /** Called when a new message in this threadId arrives. */
  onInsert: (row: MessageRow) => void;
}

export interface MessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_ai_draft?: boolean | null;
  [key: string]: unknown;
}

interface RegistryState {
  channel: RealtimeChannel | null;
  /**
   * Listeners per threadId. A Set allows multiple components to subscribe
   * to the same thread (rare, but possible if a list row and a detail
   * view both want live updates).
   */
  threadListeners: Map<string, Set<MessagesChannelListener>>;
  /**
   * Total number of active registrations. When this hits zero, we close
   * the channel. Tracked separately from `threadListeners.size` because
   * one thread can have multiple listeners.
   */
  refCount: number;
}

// Module-level singleton. A React runtime has exactly one. We never
// export mutable state directly; callers interact through the
// subscribe/unsubscribe API below.
const state: RegistryState = {
  channel: null,
  threadListeners: new Map(),
  refCount: 0,
};

/**
 * Dependency-inject the supabase client so tests can swap in a mock.
 * In production the single shared client from `../supabase/client` is
 * passed in by `useRealtimeMessages`.
 */
export function subscribeToThreadMessages(
  client: Pick<SupabaseClient, 'channel' | 'removeChannel'>,
  threadId: string,
  listener: MessagesChannelListener,
): () => void {
  // ---- 1. Register the listener ------------------------------------------
  let set = state.threadListeners.get(threadId);
  if (!set) {
    set = new Set();
    state.threadListeners.set(threadId, set);
  }
  set.add(listener);
  state.refCount += 1;

  // ---- 2. Lazily create the shared channel -------------------------------
  //
  // F1 fix: we pass a status callback to `.subscribe()` so terminal
  // errors (CHANNEL_ERROR, TIMED_OUT, CLOSED) don't leave us with a
  // non-null `state.channel` that new subscribers silently join and
  // never hear from. On a terminal status we:
  //   (a) remove the dead channel from the transport,
  //   (b) reset `state.channel` to null so the NEXT call to
  //       subscribeToThreadMessages() triggers a fresh channel,
  //   (c) log so Sentry/console sees the incident.
  //
  // We intentionally DON'T auto-reconnect here — Supabase's transport
  // layer already reconnects the websocket; the channel-level error
  // usually means the subscription itself is invalid (RLS change, bad
  // topic, server-side rate-limit). Blindly re-subscribing in a loop
  // would DOS ourselves. Letting the next organic subscribe attempt
  // bootstrap a new channel is the right backoff.
  if (!state.channel) {
    const newChannel = client
      .channel('messages-multiplex')
      .on(
        // Supabase types for postgres_changes are notoriously loose;
        // the any-cast is intentional to avoid pulling in the full
        // generated types for this file.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // No `filter` — RLS on `messages` enforces per-thread visibility.
        },
        (payload: { new?: MessageRow | null }) => {
          const row = payload?.new ?? null;
          if (!row?.thread_id) return;
          const fans = state.threadListeners.get(row.thread_id);
          if (!fans || fans.size === 0) return;
          for (const l of fans) {
            try {
              l.onInsert(row);
            } catch (err) {
              // One listener throwing must never break fan-out to others.
              // Logged rather than swallowed so Sentry/console still sees it.
              console.error('[messagesChannel] listener threw', err);
            }
          }
        },
      );

    state.channel = newChannel;

    newChannel.subscribe((status: string, err?: Error) => {
      // SUBSCRIBED is the only success state — all others are either
      // transient-and-handled-by-transport (no-op here) or terminal.
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Only react if this is still the live channel — if a later
        // subscribe already replaced it, leave that one alone.
        if (state.channel === newChannel) {
          console.error(
            '[messagesChannel] subscribe failed: status=%s err=%s',
            status,
            err?.message ?? '(none)',
          );
          try {
            client.removeChannel(newChannel);
          } catch {
            // removeChannel can throw if the channel is already torn down;
            // swallow since we're in recovery path.
          }
          state.channel = null;
          // Keep listener registrations + refCount intact — the next
          // subscribeToThreadMessages call will notice channel is null
          // and open a fresh one.
        }
      }
    });
  }

  // ---- 3. Return teardown ------------------------------------------------
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    const current = state.threadListeners.get(threadId);
    if (current) {
      current.delete(listener);
      if (current.size === 0) state.threadListeners.delete(threadId);
    }
    state.refCount -= 1;
    if (state.refCount <= 0) {
      state.refCount = 0;
      if (state.channel) {
        client.removeChannel(state.channel);
        state.channel = null;
      }
      state.threadListeners.clear();
    }
  };
}

/**
 * Test-only: reset the module singleton between runs so ref-count
 * assertions start from a clean slate. Not exported from the package
 * barrel — import directly by path in tests.
 */
export function __resetMessagesChannelForTests(): void {
  state.channel = null;
  state.threadListeners.clear();
  state.refCount = 0;
}

/**
 * Test / diagnostic read-only accessor. Not exported from the barrel.
 */
export function __getMessagesChannelStateForTests(): Readonly<{
  hasChannel: boolean;
  refCount: number;
  threadCount: number;
}> {
  return {
    hasChannel: state.channel !== null,
    refCount: state.refCount,
    threadCount: state.threadListeners.size,
  };
}
