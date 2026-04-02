import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as profileService from '../services/profile.service';
import { queryKeys } from './queryKeys';
import { useAuthStore } from '../stores/auth.store';
import type { ProfileUpdate } from '../supabase/types';

export function useProfile(userId?: string) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const setProfile = useAuthStore((s) => s.setProfile);
  const targetId = userId ?? currentUserId;

  return useQuery({
    queryKey: queryKeys.profile(targetId ?? ''),
    queryFn: async () => {
      if (!targetId) return null;
      const profile = await profileService.getProfile(targetId);
      if (targetId === currentUserId) {
        setProfile(profile);
      }
      return profile;
    },
    enabled: !!targetId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const setProfile = useAuthStore((s) => s.setProfile);

  return useMutation({
    mutationFn: (data: Partial<ProfileUpdate>) => {
      if (!userId) throw new Error('Not authenticated');
      return profileService.updateProfile(userId, data);
    },
    onSuccess: (updatedProfile) => {
      setProfile(updatedProfile);
      queryClient.invalidateQueries({
        queryKey: queryKeys.profile(userId ?? ''),
      });
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: (file: { uri: string; type: string; name: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return profileService.uploadAvatar(userId, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.profile(userId ?? ''),
      });
    },
  });
}
