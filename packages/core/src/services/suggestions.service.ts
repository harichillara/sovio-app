import { supabase } from '../supabase/client';

export interface Suggestion {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  type: 'plan' | 'place' | 'group';
  status: 'new' | 'accepted' | 'dismissed' | 'expired';
  confidence: number;
  expires_at: string | null;
  created_at: string;
}

/**
 * Fetch up to `limit` fresh suggestions for a user.
 */
export async function getSuggestions(
  userId: string,
  limit = 3,
): Promise<Suggestion[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'new')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('confidence', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Suggestion[];
}

/**
 * Accept a suggestion — marks it accepted and tracks an app_event.
 */
export async function acceptSuggestion(suggestionId: string): Promise<void> {
  const { error } = await supabase
    .from('suggestions')
    .update({ status: 'accepted' })
    .eq('id', suggestionId);

  if (error) throw error;
}

/**
 * Dismiss a suggestion with an optional reason.
 */
export async function dismissSuggestion(
  suggestionId: string,
  reason?: string,
): Promise<void> {
  const update: Record<string, unknown> = { status: 'dismissed' };
  if (reason) update.dismiss_reason = reason;

  const { error } = await supabase
    .from('suggestions')
    .update(update)
    .eq('id', suggestionId);

  if (error) throw error;
}

/**
 * Bulk-expire suggestions whose expires_at is in the past.
 */
export async function expireSuggestions(): Promise<number> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('suggestions')
    .update({ status: 'expired' })
    .eq('status', 'new')
    .lt('expires_at', now)
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
}
