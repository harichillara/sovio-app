import { supabase } from '../supabase/client';
import type { AITokenUsage, Profile, UserInterest } from '../supabase/types';
import {
  checkQuota,
  incrementUsage,
} from './entitlements.service';

export async function getTokenUsage(userId: string): Promise<AITokenUsage | null> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabase
    .from('ai_token_usage')
    .select('*')
    .eq('user_id', userId)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
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

export async function incrementTokens(userId: string, count: number): Promise<void> {
  await incrementUsage(userId, count);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const existing = await getTokenUsage(userId);

    if (existing) {
      const { data, error } = await supabase
        .from('ai_token_usage')
        .update({ tokens_used: existing.tokens_used + count })
        .eq('id', existing.id)
        .eq('tokens_used', existing.tokens_used)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (data) return;
      continue;
    }

    const { error } = await supabase.from('ai_token_usage').insert({
      user_id: userId,
      tokens_used: count,
      period_start: periodStart,
      period_end: periodEnd,
    });

    if (!error) return;
    if (error.code !== '23505') {
      throw error;
    }
  }

  throw new Error('Could not update AI usage. Please try again.');
}

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
