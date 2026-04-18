import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase — use vi.hoisted so mock fns are available in vi.mock factory
// ---------------------------------------------------------------------------

const { mockMaybeSingle, mockRpc, createChain } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockSingle = vi.fn();
  const mockRpc = vi.fn();

  function createChain() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
    };
    for (const fn of Object.values(chain)) {
      if (fn !== mockMaybeSingle && fn !== mockSingle) {
        fn.mockReturnValue(chain);
      }
    }
    return chain;
  }

  return { mockMaybeSingle, mockRpc, createChain };
});

vi.mock('../supabase/client', () => ({
  supabase: {
    from: vi.fn(() => createChain()),
    rpc: mockRpc,
  },
}));

// ---------------------------------------------------------------------------
// Import after mocking
// ---------------------------------------------------------------------------

import {
  getMyAvailability,
  removeAvailability,
} from './momentum.service';

describe('momentum.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyAvailability', () => {
    it('returns null when no availability record exists', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await getMyAvailability('user-1');

      expect(result).toBeNull();
    });

    it('returns normalized availability for active record', async () => {
      const futureDate = new Date(Date.now() + 3_600_000).toISOString();
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'avail-1',
          user_id: 'user-1',
          bucket: 'downtown',
          category: 'food',
          available_until: futureDate,
          lat: 30.267,
          lng: -97.743,
          availability_mode: 'open_now',
          confidence_label: 'open_to_plans',
          source: 'manual',
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await getMyAvailability('user-1');

      expect(result).not.toBeNull();
      expect(result!.bucket).toBe('downtown');
      expect(result!.category).toBe('food');
      expect(result!.availability_mode).toBe('open_now');
    });

    it('returns null when availability is expired', async () => {
      const pastDate = new Date(Date.now() - 3_600_000).toISOString();
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'avail-1',
          user_id: 'user-1',
          bucket: 'downtown',
          category: null,
          available_until: pastDate,
          lat: null,
          lng: null,
          availability_mode: 'open_now',
          confidence_label: 'open_to_plans',
          source: 'manual',
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await getMyAvailability('user-1');

      expect(result).toBeNull();
    });

    it('throws on database error', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'connection refused', code: 'PGRST000' },
      });

      await expect(getMyAvailability('user-1')).rejects.toEqual(
        expect.objectContaining({ message: 'connection refused' }),
      );
    });

    it('normalizes rows with missing optional fields', async () => {
      const futureDate = new Date(Date.now() + 3_600_000).toISOString();
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'avail-1',
          user_id: 'user-1',
          bucket: 'local',
          available_until: futureDate,
          created_at: new Date().toISOString(),
          // Missing: category, lat, lng, availability_mode, confidence_label, source
        },
        error: null,
      });

      const result = await getMyAvailability('user-1');

      expect(result).not.toBeNull();
      expect(result!.category).toBeNull();
      expect(result!.lat).toBeNull();
      expect(result!.lng).toBeNull();
      expect(result!.availability_mode).toBe('open_now');
      expect(result!.confidence_label).toBe('open_to_plans');
      expect(result!.source).toBe('manual');
    });
  });

  describe('removeAvailability', () => {
    it('calls delete with correct user_id filter', async () => {
      const { supabase } = await import('../supabase/client');
      const mockFrom = vi.mocked(supabase.from);

      // Reset to get a fresh chain
      const chain = createChain();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock chain type
      mockFrom.mockReturnValue(chain as any);
      // The delete chain must resolve without error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock return type
      chain.eq.mockReturnValue({ data: null, error: null } as any);

      await removeAvailability('user-1');

      expect(mockFrom).toHaveBeenCalledWith('momentum_availability');
    });
  });
});
