import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../supabase/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isOnboarded: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),
  setProfile: (profile) =>
    set({
      profile,
      isOnboarded: profile?.onboarded ?? false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set(initialState),
}));
