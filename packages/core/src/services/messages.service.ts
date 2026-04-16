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

async function getThreadsFallback(userId: string): Promise<ThreadWithMeta[]> {
  // Get threads where user is a participant
  const { data: participantRows, error: pError } = await supabase
    .from('thread_participants')
    .select('thread_id, last_read_at')
    .eq('user_id', userId);

  if (pError) throw pError;
  if (!participantRows?.length) return [];

  const threadIds = participantRows.map((p) => p.thread_id);
  const lastReadMap = new Map(
    participantRows.map((p) => [p.thread_id, p.last_read_at]),
  );

  // Fetch threads with their latest message
  const { data: threads, error: tError } = await supabase
    .from('threads')
    .select('*')
    .in('id', threadIds)
    .order('created_at', { ascending: false });

  if (tError) throw tError;

  // Cap the fetch to avoid pulling the entire message history.
  // We only need the latest message per thread and unread counts.
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false })
    .limit(threadIds.length * 50);

  if (messagesError) throw messagesError;

  const latestMessages = new Map<string, Message>();
  const unreadCounts = new Map<string, number>();

  for (const message of messages ?? []) {
    if (!latestMessages.has(message.thread_id)) {
      latestMessages.set(message.thread_id, message);
    }

    const lastReadAt = lastReadMap.get(message.thread_id);
    const isUnread =
      message.sender_id !== userId &&
      (!lastReadAt || new Date(message.created_at) > new Date(lastReadAt));

    if (isUnread) {
      unreadCounts.set(message.thread_id, (unreadCounts.get(message.thread_id) ?? 0) + 1);
    }
  }

  return (threads ?? [])
    .map((thread) => ({
      ...thread,
      latest_message: latestMessages.get(thread.id) ?? null,
      unread_count: unreadCounts.get(thread.id) ?? 0,
    }))
    .sort((a, b) => {
      const aTimestamp = a.latest_message?.created_at ?? a.created_at;
      const bTimestamp = b.latest_message?.created_at ?? b.created_at;
      return new Date(bTimestamp).getTime() - new Date(aTimestamp).getTime();
    });
}

export async function getThreads(userId: string): Promise<ThreadWithMeta[]> {
  const { data, error } = await supabase.rpc('get_thread_summaries');

  if (!error && data) {
    return (data as ThreadSummaryRow[]).map(mapThreadSummary);
  }

  if (error) {
    // Only fall back for missing-function errors (42883); propagate auth/network/permission errors
    const isRpcMissing = error.code === '42883';
    if (!isRpcMissing) {
      throw error;
    }
    console.warn('RPC get_thread_summaries not found, falling back to client query');
  }

  return getThreadsFallback(userId);
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
): Promise<Thread> {
  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({ title, plan_id: planId ?? null })
    .select()
    .single();
  if (threadError) throw threadError;

  // Insert all participants
  const participantInserts = participantIds.map((userId) => ({
    thread_id: thread.id,
    user_id: userId,
  }));

  const { error: partError } = await supabase
    .from('thread_participants')
    .insert(participantInserts);

  if (partError) throw partError;

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
