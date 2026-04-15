import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase/client';
import { useAuthStore } from '../stores/auth.store';
import * as authService from '../services/auth.service';
import * as profileService from '../services/profile.service';

/**
 * Capture the initial page URL at module-load time so it is available before
 * Expo Router (or any other code) can strip the OAuth query params via
 * history.replaceState.  On web this contains `?code=…` after a PKCE redirect.
 */
interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    async function completeOAuthCallback(url?: string | null) {
      if (!authService.isOAuthCallbackUrl(url)) {
        return false;
      }

      try {
        await authService.completeOAuthFromUrl(url!);
        return true;
      } catch (err) {
        // Errors here are expected if the code was already exchanged by
        // Supabase's _initialize() or if the code has expired.  In either
        // case we fall through to getSession() which will return whatever
        // session _initialize() established.
        if (__DEV__) {
          console.warn('OAuth callback exchange failed (may already be handled):', err);
        }
        return false;
      }
    }

    // Restore session on mount
    async function restoreSession() {
      try {
        // CRITICAL: Wait for the Supabase client's _initialize() to complete
        // before attempting any manual auth operations. In Supabase JS v2,
        // _initialize() acquires a navigator.locks lock. If we call
        // exchangeCodeForSession() while that lock is held, the lock is
        // "stolen" and throws: "Lock broken by another request".
        // getSession() internally calls _waitForInitialization(), which
        // ensures _initialize() has finished and released the lock.
        await supabase.auth.getSession();

        // Now handle OAuth callbacks — the lock is free.
        //
        // On native, the callback arrives via deep link (expo-linking).
        //
        // On web we now use a dedicated /callback route to own the PKCE
        // exchange flow and render explicit success/error states.
        if (Platform.OS !== 'web') {
          const initialUrl = await Linking.getInitialURL();
          await completeOAuthCallback(initialUrl);
        }

        // Re-read the session after the code exchange may have set it
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // Clean the OAuth artifacts from the URL bar
        if (Platform.OS === 'web') {
          const g = globalThis as typeof globalThis & {
            location?: { search: string; pathname: string };
            history?: { replaceState: (data: unknown, unused: string, url: string) => void };
          };
          const loc = g.location;
          const hist = g.history;
          if (loc?.search && hist?.replaceState) {
            hist.replaceState({}, '', loc.pathname);
          }
        }

        if (session?.user) {
          const profile = await profileService.ensureProfile(session.user);
          setProfile(profile);
        } else {
          setProfile(null);
        }
        setSession(session);
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
        if (session?.user) {
          try {
            const profile = await profileService.ensureProfile(session.user);
            setProfile(profile);
          } catch (err) {
            // Profile may not exist yet (e.g., right after sign-up).
            // Log so persistent failures are visible in diagnostics.
            console.warn('[AuthProvider] ensureProfile failed on auth state change — profile set to null.', err instanceof Error ? err.message : err);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }

        setSession(session);
      },
    );

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      void completeOAuthCallback(url);
    });

    return () => {
      subscription.subscription.unsubscribe();
      urlSubscription.remove();
    };
  }, [setSession, setProfile, setLoading]);

  return <>{children}</>;
}
