import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as authService from '../services/auth.service';
import { useAuthStore } from '../stores/auth.store';

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
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.signInWithEmail(email, password),
    onSuccess: (data) => {
      setSession(data.session);
    },
  });
}

export function useSignUp() {
  const setSession = useAuthStore((s) => s.setSession);

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
    onSuccess: (data) => {
      setSession(data.session);
    },
  });
}

export function useSignInWithGoogle() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({ idToken }: { idToken: string }) =>
      authService.signInWithGoogle(idToken),
    onSuccess: (data) => {
      setSession(data.session);
    },
  });
}

export function useSignInWithApple() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({
      identityToken,
      nonce,
    }: {
      identityToken: string;
      nonce: string;
    }) => authService.signInWithApple(identityToken, nonce),
    onSuccess: (data) => {
      setSession(data.session);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const reset = useAuthStore((s) => s.reset);

  return useMutation({
    mutationFn: () => authService.signOut(),
    onSuccess: () => {
      reset();
      queryClient.clear();
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      authService.resetPassword(email),
  });
}
