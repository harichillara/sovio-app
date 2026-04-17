import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the service
// ---------------------------------------------------------------------------

const {
  mockSignInWithPassword,
  mockExchangeCodeForSession,
  mockSetSession,
  mockSignOut,
} = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockExchangeCodeForSession: vi.fn(),
  mockSetSession: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      exchangeCodeForSession: mockExchangeCodeForSession,
      setSession: mockSetSession,
      signOut: mockSignOut,
    },
  },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(() => 'sovio://callback'),
}));

// Provide __DEV__ global used by extractParams fallback path
(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;

import {
  isOAuthCallbackUrl,
  completeOAuthFromUrl,
  signInWithEmail,
  signOut,
} from './auth.service';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // isOAuthCallbackUrl
  // -------------------------------------------------------------------------

  describe('isOAuthCallbackUrl', () => {
    it('returns false for null', () => {
      expect(isOAuthCallbackUrl(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isOAuthCallbackUrl(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isOAuthCallbackUrl('')).toBe(false);
    });

    it('returns true for URL with ?code=abc', () => {
      expect(isOAuthCallbackUrl('https://example.com/callback?code=abc')).toBe(true);
    });

    it('returns true for URL with #access_token=xyz', () => {
      expect(isOAuthCallbackUrl('https://example.com/callback#access_token=xyz')).toBe(true);
    });

    it('returns true for URL with ?error=access_denied', () => {
      expect(isOAuthCallbackUrl('https://example.com/callback?error=access_denied')).toBe(true);
    });

    it('returns false for URL without auth params', () => {
      expect(isOAuthCallbackUrl('https://example.com/page')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // completeOAuthFromUrl
  // -------------------------------------------------------------------------

  describe('completeOAuthFromUrl', () => {
    it('throws when URL has error_description', async () => {
      const url = 'https://example.com/callback?error=access_denied&error_description=User+denied+access';

      await expect(completeOAuthFromUrl(url)).rejects.toThrow('User denied access');
    });

    it('calls exchangeCodeForSession when URL has code', async () => {
      const sessionData = { session: { access_token: 'tok' }, user: { id: 'u1' } };
      mockExchangeCodeForSession.mockResolvedValue({ data: sessionData, error: null });

      const result = await completeOAuthFromUrl('https://example.com/callback?code=auth-code-123');

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('auth-code-123');
      expect(result).toEqual(sessionData);
    });

    it('calls setSession when URL has access_token + refresh_token', async () => {
      const sessionData = { session: { access_token: 'at' }, user: { id: 'u1' } };
      mockSetSession.mockResolvedValue({ data: sessionData, error: null });

      const url = 'https://example.com/callback#access_token=at123&refresh_token=rt456';
      const result = await completeOAuthFromUrl(url);

      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: 'at123',
        refresh_token: 'rt456',
      });
      expect(result).toEqual(sessionData);
    });

    it('returns null when URL has no recognized params', async () => {
      const result = await completeOAuthFromUrl('https://example.com/page');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // signInWithEmail
  // -------------------------------------------------------------------------

  describe('signInWithEmail', () => {
    it('throws on auth error', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: new Error('Invalid credentials'),
      });

      await expect(signInWithEmail('a@b.com', 'bad')).rejects.toThrow('Invalid credentials');
    });

    it('returns data on success', async () => {
      const mockData = { user: { id: 'u1' }, session: { access_token: 'tok' } };
      mockSignInWithPassword.mockResolvedValue({ data: mockData, error: null });

      const result = await signInWithEmail('a@b.com', 'pass');

      expect(result).toEqual(mockData);
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'pass',
      });
    });
  });

  // -------------------------------------------------------------------------
  // signOut
  // -------------------------------------------------------------------------

  describe('signOut', () => {
    it('calls supabase.auth.signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      await signOut();

      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });
});
