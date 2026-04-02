import { supabase } from '../supabase/client';
import type { Message, Thread } from '../supabase/types';

export interface ThreadWithMeta extends Thread {
  latest_message?: Message | null;
  unread_count?: number;
}

export async function getThreads(userId: string): Promise<ThreadWithMeta[]> {
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

  // For each thread, get the latest message and unread count
  const enriched: ThreadWithMeta[] = await Promise.all(
    (threads ?? []).map(async (thread) => {
      const lastRead = lastReadMap.get(thread.id);

      // Latest message
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Unread count
      let unreadQuery = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('thread_id', thread.id);

      if (lastRead) {
        unreadQuery = unreadQuery.gt('created_at', lastRead);
      }

      const { count } = await unreadQuery;

      return {
        ...thread,
        latest_message: msgs?.[0] ?? null,
        unread_count: count ?? 0,
      };
    }),
  );

  return enriched;
}

export async function getMessages(threadId: string, cursor?: string) {
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
