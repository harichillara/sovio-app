import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import * as messagesService from '../services/messages.service';
import { THREADS_PAGE_SIZE } from '../services/messages.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';
import { useMessagesStore } from '../stores/messages.store';
import { supabase } from '../supabase/client';
import { subscribeToThreadMessages } from '../providers/messagesChannel';

export function useThreads() {
  const userId = useAuthStore((s) => s.user?.id);
  const setThreads = useMessagesStore((s) => s.setThreads);

  return useInfiniteQuery({
    queryKey: queryKeys.threads(userId ?? ''),
    queryFn: async ({ pageParam }) => {
      if (!userId) return [];
      const threads = await messagesService.getThreads(userId, pageParam);
      return threads;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < THREADS_PAGE_SIZE) return undefined;
      const lastThread = lastPage[lastPage.length - 1];
      return lastThread?.latest_message?.created_at ?? lastThread?.created_at;
    },
    enabled: !!userId,
    select: (data) => {
      // Keep the store in sync so unread counts remain available
      const allThreads = data.pages.flat();
      setThreads(allThreads);
      return data;
    },
  });
}

export function useMessages(threadId: string) {
  const userId = useAuthStore((s) => s.user?.id);

  return useInfiniteQuery({
    queryKey: queryKeys.messages(threadId),
    queryFn: ({ pageParam }) =>
      messagesService.getMessages(threadId, userId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 50) return undefined;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    enabled: !!threadId && !!userId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({
      threadId,
      content,
    }: {
      threadId: string;
      content: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      return messagesService.sendMessage(threadId, userId, content);
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages(message.thread_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.threads(userId ?? ''),
      });
    },
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({
      title,
      participantIds,
      planId,
    }: {
      title: string;
      participantIds: string[];
      planId?: string;
    }) => messagesService.createThread(title, participantIds, planId, userId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.threads(userId ?? ''),
      });
    },
  });
}

export function useMarkThreadRead() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({ threadId }: { threadId: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return messagesService.markThreadRead(threadId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.threads(userId ?? ''),
      });
    },
  });
}

/**
 * Subscribes to realtime message inserts for a specific thread.
 *
 * Internally registers with a shared multiplexed channel (see
 * `providers/messagesChannel.ts`), so opening N threads costs exactly 1
 * WebSocket subscription instead of N. The shared channel relies on RLS
 * on `public.messages` to scope events to threads the user participates
 * in, so per-thread server-side filters aren't needed.
 *
 * The hook invalidates the thread's messages query and the user's
 * threads list on every INSERT. We intentionally don't optimistically
 * apply the row — React Query's refetch preserves pagination cursors
 * and avoids duplicating logic that already lives in the fetcher.
 */
export function useRealtimeMessages(threadId: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!threadId) return;

    const unsubscribe = subscribeToThreadMessages(supabase, threadId, {
      onInsert: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.messages(threadId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.threads(userId ?? ''),
        });
      },
    });

    return unsubscribe;
  }, [threadId, queryClient, userId]);
}
