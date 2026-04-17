import { supabase } from '../supabase/client';
import type { Profile, UserInterest } from '../supabase/types';
import { checkQuota } from './entitlements.service';

/**
 * Thrown when the ai-generate edge function returns HTTP 429.
 * The authoritative quota lives server-side; UI should catch this and
 * show a paywall / upgrade prompt.
 */
export class QuotaExceededError extends Error {
  public readonly used?: number;
  public readonly limit?: number;

  constructor(message = 'AI quota exceeded', meta?: { used?: number; limit?: number }) {
    super(message);
    this.name = 'QuotaExceededError';
    this.used = meta?.used;
    this.limit = meta?.limit;
  }
}

/**
 * Invoke the ai-generate edge function. Surfaces 429 responses as a typed
 * QuotaExceededError so callers can render an upgrade prompt.
 */
export async function invokeAIGenerate<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-generate', { body });

  // supabase-js surfaces non-2xx responses via `error`. The JSON body
  // (including our { error: 'quota_exceeded', used, limit }) is in `data`
  // or on `error.context` depending on the client version — check both.
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  const payload = (data as { error?: string; used?: number; limit?: number } | null) ?? null;

  if (status === 429 || payload?.error === 'quota_exceeded') {
    throw new QuotaExceededError('AI quota exceeded', {
      used: payload?.used,
      limit: payload?.limit,
    });
  }

  if (error) throw error;
  return data as T;
}

export async function checkCanUseAI(userId: string): Promise<{
  allowed: boolean;
  tokensUsed: number;
  tokensLimit: number;
}> {
  const quota = await checkQuota(userId);

  return {
    allowed: quota.allowed,
    tokensUsed: quota.used,
    tokensLimit: quota.limit,
  };
}

// NOTE: `incrementTokens` and `getTokenUsage` were removed — they were dead
// code (no callers anywhere in apps/ or packages/), and their client-side
// UPDATE/INSERT on `ai_token_usage` blocked tightening RLS to SELECT-only.
// The authoritative daily quota is enforced server-side inside `ai-generate`
// (see enforceQuotaAndRun in supabase/functions/ai-generate/index.ts).
// If a monthly-token meter is wanted in the UI later, expose a SECURITY
// DEFINER RPC — the client should never write ai_token_usage directly.

export function buildAIContext(
  profile: Profile,
  interests: UserInterest[],
  location?: { lat: number; lng: number },
): string {
  const parts: string[] = [];

  parts.push(`User: ${profile.display_name ?? 'Unknown'}`);
  parts.push(`Tier: ${profile.subscription_tier}`);

  if (profile.bio) {
    parts.push(`Bio: ${profile.bio}`);
  }

  if (interests.length > 0) {
    parts.push(`Interests: ${interests.map((i) => i.interest).join(', ')}`);
  }

  if (location) {
    parts.push(`Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
  }

  return parts.join('\n');
}
