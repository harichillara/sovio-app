import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/client';
import { useAuthStore } from '../stores/auth.store';
import { queryKeys } from '../hooks/queryKeys';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
      // Clean up if we log out
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Only subscribe to user-scoped notifications.
    // Per-thread message realtime is handled by useRealtimeMessages in thread-detail.
    const channel = supabase
      .channel('global-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications(userId),
          });
          // Also refresh threads list so unread badges update
          queryClient.invalidateQueries({
            queryKey: queryKeys.threads(userId),
          });
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error:', err?.message ?? 'unknown');
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Subscription timed out, will retry on reconnect');
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, queryClient]);

  return <>{children}</>;
}
