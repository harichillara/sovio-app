import { supabase } from '../supabase/client';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface Entitlement {
  id: string;
  user_id: string;
  plan: 'free' | 'pro';
  pro_until: string | null;
  daily_ai_calls_used: number;
  daily_ai_calls_reset_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

const FREE_DAILY_LIMIT = 50;
const PRO_DAILY_LIMIT = 500;

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

  if (data) return data as Entitlement;

  // Auto-create free entitlement
  const now = new Date();
  const resetAt = new Date(now);
  resetAt.setHours(24, 0, 0, 0); // next midnight

  const { data: created, error: createError } = await supabase
    .from('entitlements')
    .insert({
      user_id: userId,
      plan: 'free',
      pro_until: null,
      daily_ai_calls_used: 0,
      daily_ai_calls_reset_at: resetAt.toISOString(),
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created as Entitlement;
}

/**
 * Check whether the user has a pro plan.
 */
export async function isPro(userId: string): Promise<boolean> {
  const ent = await getEntitlement(userId);
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
  const ent = await getEntitlement(userId);
  const now = new Date();

  // Auto-reset if needed
  if (new Date(ent.daily_ai_calls_reset_at) <= now) {
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);

    await supabase
      .from('entitlements')
      .update({
        daily_ai_calls_used: 0,
        daily_ai_calls_reset_at: nextReset.toISOString(),
      })
      .eq('id', ent.id);

    ent.daily_ai_calls_used = 0;
  }

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
 * Increment the daily AI call counter by 1.
 */
export async function incrementUsage(userId: string): Promise<void> {
  const ent = await getEntitlement(userId);

  const { error } = await supabase
    .from('entitlements')
    .update({ daily_ai_calls_used: ent.daily_ai_calls_used + 1 })
    .eq('id', ent.id);

  if (error) throw error;
}
