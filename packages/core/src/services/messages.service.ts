import { supabase } from '../supabase/client';
import type { Message, Thread } from '../supabase/types';

export interface ThreadWithMeta extends Thread {
  latest_message?: Message | null;
  unread_count?: number;
}

interface ThreadSummaryRow {
  thread_id: string;
  plan_id: string | null;
  title: string;
  thread_created_at: string;
  latest_message_id: string | null;
  latest_message_sender_id: string | null;
  latest_message_content: string | null;
  latest_message_is_ai_draft: boolean | null;
  latest_message_created_at: string | null;
  unread_count: number;
}

function mapThreadSummary(row: ThreadSummaryRow): ThreadWithMeta {
  return {
    id: row.thread_id,
    plan_id: row.plan_id,
    title: row.title,
    created_at: row.thread_created_at,
    latest_message: row.latest_message_id
      ? {
          id: row.latest_message_id,
          thread_id: row.thread_id,
          sender_id: row.latest_message_sender_id ?? '',
          content: row.latest_message_content ?? '',
          is_ai_draft: row.latest_message_is_ai_draft ?? false,
          created_at: row.latest_message_created_at ?? row.thread_created_at,
        }
      : null,
    unread_count: Number(row.unread_count ?? 0),
  };
}

export const THREADS_PAGE_SIZE = 30;

/**
 * Fetch the thread list for a user. Backed by the `get_thread_summaries`
 * Postgres RPC — the RPC is required and must exist in the database.
 * No client-side fallback: a missing RPC is a migration bug, not a runtime
 * condition the client should try to paper over.
 *
 * NOTE: The RPC does not yet support cursor-based pagination; `cursor` is
 * reserved for future use. Callers should stop paginating once fewer than
 * `THREADS_PAGE_SIZE` rows are returned.
 */
export async function getThreads(userId: string, cursor?: string): Promise<ThreadWithMeta[]> {
  // `userId` is currently unused because the RPC resolves the caller from the
  // JWT claim on the database side. Kept in the signature for future cursor
  // support and so existing callers don't need to change.
  void userId;

  // Cursor-paginated pages are not yet supported by the RPC. Return empty to
  // signal end-of-list so `useInfiniteQuery` stops calling us.
  if (cursor) return [];

  const { data, error } = await supabase.rpc('get_thread_summaries');
  if (error) throw error;

  return (data as ThreadSummaryRow[] | null | undefined)
    ?.map(mapThreadSummary)
    .slice(0, THREADS_PAGE_SIZE) ?? [];
}

async function assertThreadParticipant(threadId: string, userId: string) {
  const { data } = await supabase
    .from('thread_participants')
    .select('id')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) throw new Error('Not a participant of this thread');
}

export async function getMessages(threadId: string, userId: string, cursor?: string) {
  await assertThreadParticipant(threadId, userId);

  let query = supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(
  threadId: string,
  senderId: string,
  content: string,
  isAiDraft = false,
): Promise<Message> {
  await assertThreadParticipant(threadId, senderId);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_id: senderId,
      content,
      is_ai_draft: isAiDraft,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createThread(
  title: string,
  participantIds: string[],
  planId?: string,
  creatorId?: string,
): Promise<Thread> {
  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({ title, plan_id: planId ?? null })
    .select()
    .single();
  if (threadError) throw threadError;

  // RLS policy thread_participants_insert_member_or_bootstrap requires the
  // caller to be an existing participant OR bootstrapping an empty thread
  // with their own row. Because with_check is evaluated row-by-row against
  // the pre-statement snapshot, a single-batch insert of
  // [creator, ...others] fails: the "others" rows can't see the creator's
  // row mid-statement. So we split into two inserts — creator first
  // (bootstrap branch), then the rest (member branch).
  if (creatorId) {
    const { error: bootstrapError } = await supabase
      .from('thread_participants')
      .insert({ thread_id: thread.id, user_id: creatorId });
    if (bootstrapError) throw bootstrapError;
  }

  const otherIds = creatorId
    ? participantIds.filter((id) => id !== creatorId)
    : participantIds;

  if (otherIds.length > 0) {
    const otherInserts = otherIds.map((userId) => ({
      thread_id: thread.id,
      user_id: userId,
    }));
    const { error: otherError } = await supabase
      .from('thread_participants')
      .insert(otherInserts);
    if (otherError) throw otherError;
  }

  return thread;
}

export async function markThreadRead(threadId: string, userId: string) {
  const { error } = await supabase
    .from('thread_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('user_id', userId);
  if (error) throw error;
}
