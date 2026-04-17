import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase client before importing the service
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockLte = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    eq: mockEq,
    lte: mockLte,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
  };
  for (const fn of Object.values(chain)) {
    fn.mockReturnValue(chain);
  }
  return chain;
}

vi.mock('../supabase/client', () => ({
  supabase: {
    from: vi.fn(() => chainable()),
  },
}));

import {
  FREE_DAILY_LIMIT,
  PRO_DAILY_LIMIT,
} from './entitlements.service';

// ---------------------------------------------------------------------------
// Tests for exported constants
// ---------------------------------------------------------------------------

describe('entitlements constants', () => {
  it('FREE_DAILY_LIMIT is 50', () => {
    expect(FREE_DAILY_LIMIT).toBe(50);
  });

  it('PRO_DAILY_LIMIT is 500', () => {
    expect(PRO_DAILY_LIMIT).toBe(500);
  });

  it('PRO_DAILY_LIMIT is greater than FREE_DAILY_LIMIT', () => {
    expect(PRO_DAILY_LIMIT).toBeGreaterThan(FREE_DAILY_LIMIT);
  });
});

// ---------------------------------------------------------------------------
// Tests for checkQuota (with mocked Supabase)
// ---------------------------------------------------------------------------

describe('checkQuota', () => {
  let checkQuota: typeof import('./entitlements.service').checkQuota;

  beforeEach(async () => {
    vi.resetModules();
    // Re-mock for fresh module import
    vi.doMock('../supabase/client', () => ({
      supabase: {
        from: vi.fn(() => chainable()),
      },
    }));
    const mod = await import('./entitlements.service');
    checkQuota = mod.checkQuota;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns allowed=true when usage is under free limit', async () => {
    const entitlement = {
      id: 'ent-1',
      user_id: 'user-1',
      plan: 'free' as const,
      pro_until: null,
      daily_ai_calls_used: 10,
      daily_ai_calls_reset_at: new Date(Date.now() + 86_400_000).toISOString(),
      created_at: new Date().toISOString(),    };

    const result = await checkQuota('user-1', entitlement);

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(10);
    expect(result.limit).toBe(FREE_DAILY_LIMIT);
  });

  it('returns allowed=false when usage meets free limit', async () => {
    const entitlement = {
      id: 'ent-1',
      user_id: 'user-1',
      plan: 'free' as const,
      pro_until: null,
      daily_ai_calls_used: FREE_DAILY_LIMIT,
      daily_ai_calls_reset_at: new Date(Date.now() + 86_400_000).toISOString(),
      created_at: new Date().toISOString(),    };

    const result = await checkQuota('user-1', entitlement);

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(FREE_DAILY_LIMIT);
    expect(result.limit).toBe(FREE_DAILY_LIMIT);
  });

  it('uses PRO_DAILY_LIMIT for pro users with valid pro_until', async () => {
    const entitlement = {
      id: 'ent-1',
      user_id: 'user-1',
      plan: 'pro' as const,
      pro_until: new Date(Date.now() + 86_400_000).toISOString(), // tomorrow
      daily_ai_calls_used: 100,
      daily_ai_calls_reset_at: new Date(Date.now() + 86_400_000).toISOString(),
      created_at: new Date().toISOString(),    };

    const result = await checkQuota('user-1', entitlement);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(PRO_DAILY_LIMIT);
  });

  it('falls back to free limit when pro_until is expired (beyond grace)', async () => {
    const entitlement = {
      id: 'ent-1',
      user_id: 'user-1',
      plan: 'pro' as const,
      pro_until: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
      daily_ai_calls_used: 40,
      daily_ai_calls_reset_at: new Date(Date.now() + 86_400_000).toISOString(),
      created_at: new Date().toISOString(),    };

    const result = await checkQuota('user-1', entitlement);

    expect(result.limit).toBe(FREE_DAILY_LIMIT);
  });

  it('grants pro limit within clock-skew grace period (5 min)', async () => {
    // pro_until expired 3 minutes ago — within 5-min grace
    const entitlement = {
      id: 'ent-1',
      user_id: 'user-1',
      plan: 'pro' as const,
      pro_until: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      daily_ai_calls_used: 40,
      daily_ai_calls_reset_at: new Date(Date.now() + 86_400_000).toISOString(),
      created_at: new Date().toISOString(),    };

    const result = await checkQuota('user-1', entitlement);

    expect(result.limit).toBe(PRO_DAILY_LIMIT);
  });
});
