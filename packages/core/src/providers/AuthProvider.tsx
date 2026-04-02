import React, { useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useAuthStore } from '../stores/auth.store';
import * as profileService from '../services/profile.service';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    // Restore session on mount
    async function restoreSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);

        if (session?.user) {
          const profile = await profileService.getProfile(session.user.id);
          setProfile(profile);
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);

        if (session?.user) {
          try {
            const profile = await profileService.getProfile(session.user.id);
            setProfile(profile);
          } catch {
            // Profile may not exist yet (e.g., right after sign-up)
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      },
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [setSession, setProfile, setLoading]);

  return <>{children}</>;
}
