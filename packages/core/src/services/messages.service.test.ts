import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Flexible chainable Supabase mock that tracks .from() table name
// ---------------------------------------------------------------------------

const { mockFrom, mockRpc } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { mockFrom, mockRpc };
});

vi.mock('../supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import {
  getMessages,
  sendMessage,
  createThread,
  markThreadRead,
  getThreads,
} from './messages.service';

// ---------------------------------------------------------------------------
// Helper: create a fresh chainable query builder per from() call
// Each chain instance has its own set of vi.fn() methods so they don't collide.
// ---------------------------------------------------------------------------

function createChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    'select', 'insert', 'update', 'eq', 'in', 'lt',
    'order', 'limit', 'maybeSingle', 'single',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('messages.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: from() returns a fresh chain each time
    mockFrom.mockImplementation(() => createChain());
  });

  // -------------------------------------------------------------------------
  // getMessages
  // -------------------------------------------------------------------------

  describe('getMessages', () => {
    it('calls assertThreadParticipant before fetching', async () => {
      // assertThreadParticipant chain: from().select().eq().eq().maybeSingle()
      const tpChain = createChain();
      tpChain.maybeSingle.mockResolvedValue({ data: { id: 'tp-1' }, error: null });

      // messages chain: from().select().eq().order().limit()
      const msgChain = createChain();
      msgChain.limit.mockResolvedValue({
        data: [{ id: 'm1', thread_id: 't1', content: 'hi' }],
        error: null,
      });

      const tables: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        tables.push(table);
        return table === 'thread_participants' ? tpChain : msgChain;
      });

      await getMessages('thread-1', 'user-1');

      expect(tables[0]).toBe('thread_participants');
      expect(tables[1]).toBe('messages');
    });

    it('applies cursor filter when provided', async () => {
      const tpChain = createChain();
      tpChain.maybeSingle.mockResolvedValue({ data: { id: 'tp-1' }, error: null });

      const msgChain = createChain();
      // When cursor is provided, .lt() is called on the query.
      // The chain still ends at the query being awaited.
      // lt() returns the chain, which is then awaited.
      msgChain.lt.mockResolvedValue({ data: [], error: null });

      mockFrom.mockImplementation((table: string) =>
        table === 'thread_participants' ? tpChain : msgChain,
      );

      await getMessages('thread-1', 'user-1', '2024-01-01T00:00:00Z');

      expect(msgChain.lt).toHaveBeenCalledWith('created_at', '2024-01-01T00:00:00Z');
    });

    it('returns empty array on null data', async () => {
      const tpChain = createChain();
      tpChain.maybeSingle.mockResolvedValue({ data: { id: 'tp-1' }, error: null });

      const msgChain = createChain();
      msgChain.limit.mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) =>
        table === 'thread_participants' ? tpChain : msgChain,
      );

      const result = await getMessages('thread-1', 'user-1');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // sendMessage
  // -------------------------------------------------------------------------

  describe('sendMessage', () => {
    it('inserts message with correct fields', async () => {
      const tpChain = createChain();
      tpChain.maybeSingle.mockResolvedValue({ data: { id: 'tp-1' }, error: null });

      const newMessage = {
        id: 'msg-1',
        thread_id: 'thread-1',
        sender_id: 'user-1',
        content: 'Hello!',
        is_ai_draft: false,
        created_at: '2024-01-01T00:00:00Z',
      };

      const msgChain = createChain();
      msgChain.single.mockResolvedValue({ data: newMessage, error: null });

      mockFrom.mockImplementation((table: string) =>
        table === 'thread_participants' ? tpChain : msgChain,
      );

      const result = await sendMessage('thread-1', 'user-1', 'Hello!', false);

      expect(msgChain.insert).toHaveBeenCalledWith({
        thread_id: 'thread-1',
        sender_id: 'user-1',
        content: 'Hello!',
        is_ai_draft: false,
      });
      expect(result).toEqual(newMessage);
    });

    it('throws on non-participant', async () => {
      const tpChain = createChain();
      tpChain.maybeSingle.mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation(() => tpChain);

      await expect(
        sendMessage('thread-1', 'stranger', 'Hello!'),
      ).rejects.toThrow('Not a participant of this thread');
    });
  });

  // -------------------------------------------------------------------------
  // createThread
  // -------------------------------------------------------------------------

  describe('createThread', () => {
    it('creates thread and adds participants', async () => {
      const mockThread = {
        id: 'thread-new',
        title: 'Test Thread',
        plan_id: null,
        created_at: '2024-01-01T00:00:00Z',
      };

      // First from('threads'): insert().select().single()
      const threadChain = createChain();
      threadChain.single.mockResolvedValue({ data: mockThread, error: null });

      // Second from('thread_participants'): insert()
      const tpChain = createChain();
      tpChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) =>
        table === 'threads' ? threadChain : tpChain,
      );

      const result = await createThread('Test Thread', ['user-2', 'user-3']);

      expect(mockFrom).toHaveBeenCalledWith('threads');
      expect(mockFrom).toHaveBeenCalledWith('thread_participants');
      expect(result).toEqual(mockThread);
    });

    it('deduplicates creator from participant list', async () => {
      const mockThread = {
        id: 'thread-new',
        title: 'Dedup Thread',
        plan_id: null,
        created_at: '2024-01-01T00:00:00Z',
      };

      const threadChain = createChain();
      threadChain.single.mockResolvedValue({ data: mockThread, error: null });

      const tpChain = createChain();
      tpChain.insert.mockReturnValue({ error: null });

      mockFrom.mockImplementation((table: string) =>
        table === 'threads' ? threadChain : tpChain,
      );

      await createThread('Dedup Thread', ['user-1', 'user-2'], undefined, 'user-1');

      // After RLS hardening (20260416240000_rls_hardening), createThread must
      // insert the creator FIRST (bootstrap branch of the new INSERT policy),
      // then the remaining participants. The creator must appear exactly once
      // across both calls, even though they're present in both `participantIds`
      // and `creatorId`.
      //
      // Expected shape:
      //   call[0] = { thread_id, user_id: 'user-1' }   (single-row bootstrap)
      //   call[1] = [{ thread_id, user_id: 'user-2' }] (array of the rest)
      expect(tpChain.insert).toHaveBeenCalledTimes(2);

      const bootstrapArg = tpChain.insert.mock.calls[0][0] as { thread_id: string; user_id: string };
      expect(bootstrapArg).toEqual({ thread_id: 'thread-new', user_id: 'user-1' });

      const othersArg = tpChain.insert.mock.calls[1][0] as Array<{ thread_id: string; user_id: string }>;
      expect(othersArg).toEqual([{ thread_id: 'thread-new', user_id: 'user-2' }]);

      // Cross-call dedup invariant: creator appears exactly once total.
      const allUserIds = [bootstrapArg.user_id, ...othersArg.map((r) => r.user_id)];
      expect(allUserIds.filter((id) => id === 'user-1')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // markThreadRead
  // -------------------------------------------------------------------------

  describe('markThreadRead', () => {
    it('updates last_read_at for correct user/thread', async () => {
      const chain = createChain();
      // The final .eq() in the chain is awaited, so resolve it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock arg spread
      chain.eq.mockImplementation((..._args: any[]) => {
        // Return a thenable for the last eq() call and the chain for earlier ones
        return chain;
      });
      // Make the chain itself act as a resolved promise when awaited
      // markThreadRead does: const { error } = await supabase.from(...).update(...).eq(...).eq(...)
      // The last .eq() call's return value is destructured as { error }
      chain.eq.mockReturnValue({ error: null, ...chain });

      mockFrom.mockReturnValue(chain);

      await markThreadRead('thread-1', 'user-1');

      expect(mockFrom).toHaveBeenCalledWith('thread_participants');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          last_read_at: expect.any(String),
        }),
      );
      expect(chain.eq).toHaveBeenCalledWith('thread_id', 'thread-1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  // -------------------------------------------------------------------------
  // getThreads
  // -------------------------------------------------------------------------

  describe('getThreads', () => {
    it('returns mapped summaries from the RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            thread_id: 'th-1',
            plan_id: null,
            title: 'Thread 1',
            thread_created_at: '2024-01-01T00:00:00Z',
            latest_message_id: 'm-1',
            latest_message_sender_id: 'u-2',
            latest_message_content: 'hi',
            latest_message_is_ai_draft: false,
            latest_message_created_at: '2024-01-02T00:00:00Z',
            unread_count: 2,
          },
        ],
        error: null,
      });

      const result = await getThreads('user-1');

      expect(mockRpc).toHaveBeenCalledWith('get_thread_summaries');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'th-1',
        title: 'Thread 1',
        unread_count: 2,
        latest_message: { id: 'm-1', content: 'hi' },
      });
      // No client-side fallback — we never touch `from()` anymore
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('propagates RPC errors (no client-side fallback)', async () => {
      // Any RPC error — missing function, permission denied, network — is a
      // migration/infra bug. Surface it, don't paper over it with a fallback.
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function not found' },
      });

      await expect(getThreads('user-1')).rejects.toEqual({
        code: '42883',
        message: 'function not found',
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('returns [] immediately when a cursor is passed (RPC is page-1 only)', async () => {
      const result = await getThreads('user-1', '2024-01-01');
      expect(result).toEqual([]);
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
