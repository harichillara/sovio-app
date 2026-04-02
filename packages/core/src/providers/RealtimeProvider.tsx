import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/client';
import { useAuthStore } from '../stores/auth.store';
import { queryKeys } from '../hooks/queryKeys';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Message } from '../supabase/types';

interface RealtimeProviderProps {
  children: React.ReactNode;
}

/**
 * Manages global Supabase realtime subscriptions.
 * When authenticated, subscribes to the messages table
 * and updates React Query cache on new inserts.
 */
export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) {
      // Unsubscribe if we log out
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel('global-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as Message;

          // Invalidate the specific thread messages query
          queryClient.invalidateQueries({
            queryKey: queryKeys.messages(newMessage.thread_id),
          });

          // Invalidate threads list so unread counts refresh
          queryClient.invalidateQueries({
            queryKey: queryKeys.threads(userId),
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [userId, queryClient]);

  return <>{children}</>;
}
