import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as authService from '../services/auth.service';
import * as profileService from '../services/profile.service';
import { useAuthStore } from '../stores/auth.store';
import { useMessagesStore } from '../stores/messages.store';
import { useAIStore } from '../stores/ai.store';
import { useLocationStore } from '../stores/location.store';
import { useSuggestionsStore } from '../stores/suggestions.store';
import { usePresenceStore } from '../stores/presence.store';
import { usePlansStore } from '../stores/plans.store';

export function useSessionRestore() {
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);

  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const session = await authService.getSession();
      setSession(session);
      setLoading(false);
      return session;
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function useSignIn() {
  const setProfile = useAuthStore((s) => s.setProfile);
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.signInWithEmail(email, password),
    onSuccess: async (data) => {
      if (data.session?.user) {
        try {
          const profile = await profileService.ensureProfile(data.session.user);
          setProfile(profile);
        } catch (err) {
          console.warn('[useSignIn] ensureProfile failed after sign-in — profile set to null.', err instanceof Error ? err.message : err);
          setProfile(null);
        }
      }
      setSession(data.session);
    },
  });
}

export function useSignUp() {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);

  return useMutation({
    mutationFn: ({
      email,
      password,
      fullName,
    }: {
      email: string;
      password: string;
      fullName: string;
    }) => authService.signUpWithEmail(email, password, fullName),
    onSuccess: async (data) => {
      if (data.session?.user) {
        try {
          const profile = await profileService.ensureProfile(data.session.user);
          setProfile(profile);
        } catch (err) {
          console.warn('[useSignUp] ensureProfile failed after sign-up — profile set to null.', err instanceof Error ? err.message : err);
          setProfile(null);
        }
      }
      setSession(data.session);
    },
  });
}

export function useSignInWithGoogle() {
  return useMutation({
    mutationFn: ({ redirectTo }: { redirectTo: string }) =>
      authService.startGoogleOAuth(redirectTo),
  });
}

export function useSignInWithApple() {
  const setProfile = useAuthStore((s) => s.setProfile);
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({
      identityToken,
      nonce,
    }: {
      identityToken: string;
      nonce: string;
    }) => authService.signInWithApple(identityToken, nonce),
    onSuccess: async (data) => {
      if (data.session?.user) {
        try {
          const profile = await profileService.ensureProfile(data.session.user);
          setProfile(profile);
        } catch (err) {
          console.warn('[useSignInWithApple] ensureProfile failed after Apple sign-in — profile set to null.', err instanceof Error ? err.message : err);
          setProfile(null);
        }
      }
      setSession(data.session);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const resetAuth = useAuthStore((s) => s.reset);

  return useMutation({
    mutationFn: () => authService.signOut(),
    onSuccess: () => {
      resetAuth();
      queryClient.clear();

      // Reset all zustand stores to prevent data leaking between accounts
      useMessagesStore.getState().reset();
      useAIStore.getState().reset();
      useLocationStore.getState().reset();
      useSuggestionsStore.getState().reset();
      usePresenceStore.getState().reset();
      usePlansStore.getState().reset();
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      authService.resetPassword(email),
  });
}
