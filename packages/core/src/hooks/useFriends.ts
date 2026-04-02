import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as friendshipsService from '../services/friendships.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';

export function useFriends() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.friends(userId ?? ''),
    queryFn: () => {
      if (!userId) return [];
      return friendshipsService.getFriends(userId);
    },
    enabled: !!userId,
  });
}

export function useFriendRequests() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.friendRequests(userId ?? ''),
    queryFn: () => {
      if (!userId) return [];
      return friendshipsService.getFriendRequests(userId);
    },
    enabled: !!userId,
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({ friendId }: { friendId: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return friendshipsService.sendFriendRequest(userId, friendId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.friends(userId ?? ''),
      });
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({ friendId }: { friendId: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return friendshipsService.acceptFriendRequest(userId, friendId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.friends(userId ?? ''),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.friendRequests(userId ?? ''),
      });
    },
  });
}
