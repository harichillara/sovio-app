import { supabase } from '../supabase/client';
import { GeminiClient } from '../ai/gemini-client';
import type { ModerationResult } from '../ai/llm-client';

// ---------------------------------------------------------------------------
// Content safety
// ---------------------------------------------------------------------------

/**
 * Check content for safety using Gemini moderation.
 * Returns a ModerationResult with flagged status and categories.
 *
 * Falls back to a simple keyword check if the API key is not available.
 */
export async function checkContent(
  content: string,
  apiKey?: string,
): Promise<ModerationResult> {
  if (apiKey) {
    const client = new GeminiClient(apiKey);
    return client.moderate(content);
  }

  // Fallback: basic keyword check
  const blocked = [
    'kill',
    'attack',
    'bomb',
    'terror',
    'nude',
    'porn',
    'drug deal',
  ];
  const lower = content.toLowerCase();
  const flagged = blocked.some((w) => lower.includes(w));

  return {
    flagged,
    categories: flagged ? { harmful_content: true } : {},
  };
}

// ---------------------------------------------------------------------------
// Content reporting
// ---------------------------------------------------------------------------

export type ReportTargetType = 'message' | 'plan' | 'profile' | 'suggestion';

export async function reportContent(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: reporterId,
    action: 'content_report',
    target_type: targetType,
    target_id: targetId,
    metadata: { reason },
  });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// User blocking
// ---------------------------------------------------------------------------

export async function blockUser(
  userId: string,
  targetId: string,
): Promise<void> {
  // Update any existing friendship to 'blocked'
  const { error: updateError } = await supabase
    .from('friendships')
    .update({ status: 'blocked', blocked_by: userId })
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${userId})`,
    );

  // If no existing friendship, create a blocked one
  if (!updateError) {
    const { data: existing } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${userId})`,
      )
      .limit(1);

    if (!existing?.length) {
      await supabase.from('friendships').insert({
        user_id: userId,
        friend_id: targetId,
        status: 'blocked',
        blocked_by: userId,
      });
    }
  }
}
