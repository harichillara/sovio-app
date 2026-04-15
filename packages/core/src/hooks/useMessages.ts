import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import * as messagesService from '../services/messages.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';
import { useMessagesStore } from '../stores/messages.store';
import { supabase } from '../supabase/client';
import type { Message } from '../supabase/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useThreads() {
  const userId = useAuthStore((s) => s.user?.id);
  const setThreads = useMessagesStore((s) => s.setThreads);

  return useQuery({
    queryKey: queryKeys.threads(userId ?? ''),
    queryFn: async () => {
      if (!userId) return [];
      const threads = await messagesService.getThreads(userId);
      setThreads(threads);
      return threads;
    },
    enabled: !!userId,
  });
}

export function useMessages(threadId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(threadId),
    queryFn: ({ pageParam }) =>
      messagesService.getMessages(threadId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 50) return undefined;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    enabled: !!threadId,
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
    }) => messagesService.createThread(title, participantIds, planId),
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
 * Subscribes to realtime messages for a specific thread.
 * Automatically updates React Query cache when new messages arrive.
 */
export function useRealtimeMessages(threadId: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.messages(threadId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.threads(userId ?? ''),
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [threadId, queryClient, userId]);
}
