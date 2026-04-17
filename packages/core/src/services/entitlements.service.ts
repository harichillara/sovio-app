import { supabase } from '../supabase/client';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface Entitlement {
  id: string;
  user_id: string;
  plan: 'free' | 'pro';
  pro_until: string | null;
  current_period_end?: string | null;
  daily_ai_calls_used: number;
  daily_ai_calls_reset_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const FREE_DAILY_LIMIT = 50;
export const PRO_DAILY_LIMIT = 500;

function getNextResetAt(base = new Date()): string {
  const nextReset = new Date(base);
  nextReset.setHours(24, 0, 0, 0);
  return nextReset.toISOString();
}

function normalizeEntitlement(row: Record<string, unknown>): Entitlement {
  return {
    id: String(row.id ?? row.user_id ?? ''),
    user_id: String(row.user_id ?? ''),
    plan: (row.plan as Entitlement['plan']) ?? 'free',
    pro_until: (row.pro_until as string | null) ?? null,
    current_period_end: (row.current_period_end as string | null) ?? null,
    daily_ai_calls_used: (row.daily_ai_calls_used as number) ?? 0,
    daily_ai_calls_reset_at: (row.daily_ai_calls_reset_at as string) ?? getNextResetAt(),
    created_at: String(row.created_at ?? row.updated_at ?? new Date().toISOString()),
  };
}

// ---------------------------------------------------------------------------
// Service functions (READ-ONLY from the client's perspective).
//
// Authoritative quota enforcement now lives in the ai-generate edge function
// using the service_role key. The client cannot (and should not) mutate the
// entitlements row — RLS blocks it anyway. The helpers below are purely for
// rendering UI state (token meter, paywall hint, etc.).
// ---------------------------------------------------------------------------

/**
 * Get the entitlement record for a user. Creates one if it doesn't exist.
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const { data, error } = await supabase
    .from('entitlements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (data) return normalizeEntitlement(data);

  // Schema is pinned (migration 20260403205500_weekly_insights_compat). If the
  // insert fails, that's an infra/migration bug — surface it instead of trying
  // degraded fallback shapes.
  const { data: created, error: createError } = await supabase
    .from('entitlements')
    .insert({
      user_id: userId,
      plan: 'free',
      pro_until: null,
      daily_ai_calls_used: 0,
      daily_ai_calls_reset_at: getNextResetAt(),
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return normalizeEntitlement(created);
}

// Grace period to account for client/server clock skew (5 minutes).
// Must stay in sync with billing.service.ts CLOCK_SKEW_GRACE_MS.
const CLOCK_SKEW_GRACE_MS = 5 * 60 * 1000;

/**
 * Check whether the user has a pro plan.
 */
export async function isPro(userId: string): Promise<boolean> {
  const ent = await getEntitlement(userId);
  if (ent.plan !== 'pro') return false;
  if (!ent.pro_until) return false;
  return new Date(ent.pro_until).getTime() > (Date.now() - CLOCK_SKEW_GRACE_MS);
}

/**
 * Advisory quota check for the UI (token meter, paywall hints).
 *
 * NOTE: This is NOT the authoritative quota check. The ai-generate edge
 * function enforces quota server-side via the service_role key. Use this
 * helper only to render UI state derived from the user's entitlement row.
 * A stale or evaded client-side check cannot actually bypass quota.
 */
export async function checkQuota(
  userId: string,
  existingEntitlement?: Entitlement,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const ent = existingEntitlement ?? await getEntitlement(userId);
  const now = new Date();

  const userIsPro =
    ent.plan === 'pro' && ent.pro_until
      ? new Date(ent.pro_until).getTime() > (now.getTime() - CLOCK_SKEW_GRACE_MS)
      : false;
  const limit = userIsPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const used = ent.daily_ai_calls_used;

  return {
    allowed: used < limit,
    used,
    limit,
  };
}
