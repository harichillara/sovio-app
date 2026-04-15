import type {
  AuthChangeEvent,
  AuthSession,
  OAuthResponse,
  Session,
} from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../supabase/client';

// ---------------------------------------------------------------------------
// URL param extraction — replaces expo-auth-session's getQueryParams which
// does not reliably parse standard ?query strings from full URLs on Expo web.
// ---------------------------------------------------------------------------

function extractParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  try {
    // Try the standard URL API first (works on web and modern RN)
    const parsed = new URL(url);
    // Check query params (?code=...)
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    // Also check hash fragment (#access_token=...) for implicit flow
    if (parsed.hash) {
      const hashParams = new URLSearchParams(parsed.hash.slice(1));
      hashParams.forEach((value, key) => {
        if (!params[key]) params[key] = value;
      });
    }
  } catch {
    // Fallback: manual parsing for environments without URL API
    const [, queryAndHash] = url.split('?');
    if (queryAndHash) {
      const [query, hash] = queryAndHash.split('#');
      const all = `${query ?? ''}&${hash ?? ''}`;
      for (const pair of all.split('&')) {
        const [key, value] = pair.split('=');
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
      }
    }
  }

  return params;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle(idToken: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data;
}

export async function startGoogleOAuth(
  redirectTo: string,
): Promise<OAuthResponse['data']> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      ...(Platform.OS === 'web' ? {} : { skipBrowserRedirect: true }),
    },
  });

  if (error) throw error;
  return data;
}

export function getGoogleOAuthRedirectUrl() {
  if (Platform.OS === 'web') {
    const origin =
      typeof globalThis !== 'undefined'
        ? ((globalThis as any).location?.origin as string | undefined)
        : undefined;
    return origin ? `${origin}/callback` : makeRedirectUri({ scheme: 'sovio', path: 'callback' });
  }

  return makeRedirectUri({ scheme: 'sovio', path: 'callback' });
}

export function isOAuthCallbackUrl(url?: string | null) {
  if (!url) return false;
  const params = extractParams(url);

  return Boolean(
    params.code ||
      params.access_token ||
      params.error ||
      params.error_code,
  );
}

export async function completeOAuthFromUrl(url: string) {
  const params = extractParams(url);

  if (params.error_description || params.error || params.error_code) {
    throw new Error(params.error_description ?? params.error ?? params.error_code);
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      params.code,
    );
    if (error) throw error;
    clearOAuthUrlArtifacts();
    return data;
  }

  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    clearOAuthUrlArtifacts();
    return data;
  }

  return null;
}

export async function signInWithApple(identityToken: string, nonce: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
  return data;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}

function clearOAuthUrlArtifacts() {
  if (Platform.OS !== 'web') return;

  const webLocation = globalThis as typeof globalThis & {
    history?: { replaceState: (...args: unknown[]) => void };
    location?: {
      pathname: string;
      search: string;
    };
  };

  if (!webLocation.history?.replaceState || !webLocation.location) return;

  webLocation.history.replaceState(
    {},
    '',
    webLocation.location.pathname,
  );
}
