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
  supportsPersistentQuota?: boolean;
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
  const hasDailyQuotaColumns =
    row.daily_ai_calls_used !== undefined &&
    row.daily_ai_calls_reset_at !== undefined &&
    row.id !== undefined;

  return {
    id: String(row.id ?? row.user_id ?? ''),
    user_id: String(row.user_id ?? ''),
    plan: (row.plan as Entitlement['plan']) ?? 'free',
    pro_until: (row.pro_until as string | null) ?? null,
    current_period_end: (row.current_period_end as string | null) ?? null,
    daily_ai_calls_used: (row.daily_ai_calls_used as number) ?? 0,
    daily_ai_calls_reset_at: (row.daily_ai_calls_reset_at as string) ?? getNextResetAt(),
    created_at: String(row.created_at ?? row.updated_at ?? new Date().toISOString()),
    supportsPersistentQuota: hasDailyQuotaColumns,
  };
}

async function resetQuotaIfNeeded(entitlement: Entitlement): Promise<Entitlement> {
  if (!entitlement.supportsPersistentQuota) {
    return entitlement;
  }

  const nowIso = new Date().toISOString();
  if (new Date(entitlement.daily_ai_calls_reset_at) > new Date(nowIso)) {
    return entitlement;
  }

  const nextReset = getNextResetAt();
  const { data, error } = await supabase
    .from('entitlements')
    .update({
      daily_ai_calls_used: 0,
      daily_ai_calls_reset_at: nextReset,
    })
    .eq('id', entitlement.id)
    .lte('daily_ai_calls_reset_at', nowIso)
    .select('*')
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return normalizeEntitlement(data);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from('entitlements')
    .select('*')
    .eq('id', entitlement.id)
    .single();

  if (refreshError) throw refreshError;
  return normalizeEntitlement(refreshed);
}

// ---------------------------------------------------------------------------
// Service functions
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

  // Prefer the richer schema, but fall back to the simpler staged-billing shape
  // when the remote table has not been upgraded yet.
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
    .maybeSingle();

  if (!createError && created) {
    return normalizeEntitlement(created);
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('entitlements')
    .insert({
      user_id: userId,
      plan: 'free',
      status: 'active',
      pro_until: null,
    })
    .select('*')
    .single();

  if (fallbackError) throw fallbackError;
  return normalizeEntitlement(fallback);
}

/**
 * Check whether the user has a pro plan.
 */
export async function isPro(userId: string): Promise<boolean> {
  const ent = await resetQuotaIfNeeded(await getEntitlement(userId));
  if (ent.plan !== 'pro') return false;
  if (!ent.pro_until) return false;
  return new Date(ent.pro_until) > new Date();
}

/**
 * Check the user's daily AI call quota.
 * Returns { allowed, used, limit }.
 * Also auto-resets if the reset time has passed.
 */
export async function checkQuota(
  userId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const ent = await resetQuotaIfNeeded(await getEntitlement(userId));
  const now = new Date();

  const userIsPro =
    ent.plan === 'pro' && ent.pro_until
      ? new Date(ent.pro_until) > now
      : false;
  const limit = userIsPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const used = ent.daily_ai_calls_used;

  return {
    allowed: used < limit,
    used,
    limit,
  };
}

/**
 * Increment the daily AI call counter.
 */
export async function incrementUsage(userId: string, amount = 1): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ent = await resetQuotaIfNeeded(await getEntitlement(userId));

    if (!ent.supportsPersistentQuota) {
      return;
    }

    const { data, error } = await supabase
      .from('entitlements')
      .update({ daily_ai_calls_used: ent.daily_ai_calls_used + amount })
      .eq('id', ent.id)
      .eq('daily_ai_calls_used', ent.daily_ai_calls_used)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (data) return;
  }

  throw new Error('Could not reserve AI quota. Please try again.');
}
