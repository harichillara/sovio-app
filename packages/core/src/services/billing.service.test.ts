import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('../supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

vi.mock('./entitlements.service', () => ({
  getEntitlement: vi.fn(),
}));

vi.mock('./events.service', () => ({
  EventTypes: {
    BILLING_INTEREST_REQUESTED: 'billing_interest_requested',
    BILLING_CANCELLATION_REQUESTED: 'billing_cancellation_requested',
  },
  trackEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Since mapEntitlementRow and hasActiveProAccess are not exported,
// we test them indirectly via the exported getSubscription function.
// We also test the Subscription type shape returned by the service.
// ---------------------------------------------------------------------------

import { getSubscription, createCheckout } from './billing.service';
import { getEntitlement } from './entitlements.service';

const mockGetEntitlement = vi.mocked(getEntitlement);

describe('billing.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSubscription', () => {
    it('returns is_pro_active=true for pro user with future pro_until', async () => {
      mockGetEntitlement.mockResolvedValue({
        id: 'ent-1',
        user_id: 'user-1',
        plan: 'pro',
        pro_until: new Date(Date.now() + 86_400_000).toISOString(),
        current_period_end: null,
        daily_ai_calls_used: 0,
        daily_ai_calls_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),      });

      const sub = await getSubscription('user-1');

      expect(sub.is_pro_active).toBe(true);
      expect(sub.plan).toBe('pro');
      expect(sub.provider).toBe('staged'); // STRIPE_READY = false
    });

    it('returns is_pro_active=false for free user', async () => {
      mockGetEntitlement.mockResolvedValue({
        id: 'ent-1',
        user_id: 'user-1',
        plan: 'free',
        pro_until: null,
        current_period_end: null,
        daily_ai_calls_used: 0,
        daily_ai_calls_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),      });

      const sub = await getSubscription('user-1');

      expect(sub.is_pro_active).toBe(false);
      expect(sub.plan).toBe('free');
    });

    it('returns is_pro_active=false for pro user with expired pro_until', async () => {
      const createdAt = new Date().toISOString();
      const expiredProUntil = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago

      mockGetEntitlement.mockResolvedValue({
        id: 'ent-1',
        user_id: 'user-1',
        plan: 'pro',
        pro_until: expiredProUntil,
        current_period_end: null,
        daily_ai_calls_used: 0,
        daily_ai_calls_reset_at: createdAt,
        created_at: createdAt,      });

      // normalizeExpiredSubscription will try to update entitlements to free.
      // Mock the update chain to return the downgraded row.
      const { supabase } = await import('../supabase/client');
      const mockFrom = vi.mocked(supabase.from);
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'ent-1',
            user_id: 'user-1',
            plan: 'free',
            status: 'canceled',
            pro_until: null,
            current_period_end: null,
            daily_ai_calls_used: 0,
            daily_ai_calls_reset_at: createdAt,
            created_at: createdAt,
          },
          error: null,
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock chain type mismatch
      mockFrom.mockReturnValue(updateChain as any);

      const sub = await getSubscription('user-1');

      expect(sub.is_pro_active).toBe(false);
      expect(sub.plan).toBe('free');
    });

    it('recognizes pro_until within clock-skew grace window', async () => {
      mockGetEntitlement.mockResolvedValue({
        id: 'ent-1',
        user_id: 'user-1',
        plan: 'pro',
        pro_until: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
        current_period_end: null,
        daily_ai_calls_used: 0,
        daily_ai_calls_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),      });

      const sub = await getSubscription('user-1');

      // Within 5-min grace → still active
      expect(sub.is_pro_active).toBe(true);
    });

    it('uses current_period_end as fallback when pro_until is null', async () => {
      mockGetEntitlement.mockResolvedValue({
        id: 'ent-1',
        user_id: 'user-1',
        plan: 'pro',
        pro_until: null,
        current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
        daily_ai_calls_used: 0,
        daily_ai_calls_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),      });

      const sub = await getSubscription('user-1');

      expect(sub.is_pro_active).toBe(true);
    });

    it('sets cancel_at_period_end when status=canceled but still active', async () => {
      // The DB row has a status field that mapEntitlementRow reads,
      // but the Entitlement interface omits it. Cast to simulate the real row shape.
      mockGetEntitlement.mockResolvedValue({
        id: 'ent-1',
        user_id: 'user-1',
        plan: 'pro',
        status: 'canceled',
        pro_until: new Date(Date.now() + 86_400_000).toISOString(),
        current_period_end: null,
        daily_ai_calls_used: 0,
        daily_ai_calls_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock data shape
      } as any); // status exists on the DB row but not the Entitlement interface

      const sub = await getSubscription('user-1');

      expect(sub.cancel_at_period_end).toBe(true);
      expect(sub.is_pro_active).toBe(true);
    });
  });

  describe('createCheckout', () => {
    it('returns already-active when user has active pro', async () => {
      mockGetEntitlement.mockResolvedValue({
        id: 'ent-1',
        user_id: 'user-1',
        plan: 'pro',
        pro_until: new Date(Date.now() + 86_400_000).toISOString(),
        current_period_end: null,
        daily_ai_calls_used: 0,
        daily_ai_calls_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),      });

      const result = await createCheckout('user-1', 'pro');

      expect(result.mode).toBe('already-active');
      expect(result.url).toBe('');
    });

    it('returns staged mode when Stripe is not ready', async () => {
      mockGetEntitlement.mockResolvedValue({
        id: 'ent-1',
        user_id: 'user-1',
        plan: 'free',
        pro_until: null,
        current_period_end: null,
        daily_ai_calls_used: 0,
        daily_ai_calls_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),      });

      const result = await createCheckout('user-1', 'pro');

      expect(result.mode).toBe('staged');
      expect(result.message).toContain('staged rollout');
    });
  });
});
