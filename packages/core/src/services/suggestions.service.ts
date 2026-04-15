import { supabase } from '../supabase/client';

export interface Suggestion {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  type: 'plan' | 'place' | 'group';
  status: 'new' | 'accepted' | 'dismissed' | 'expired';
  confidence: number;
  source_label: string | null;
  why_now: string | null;
  candidate_id: string | null;
  payload: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
}

function normalizeSuggestion(row: Record<string, unknown>): Suggestion {
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    title: String(row.title ?? ''),
    summary: String(row.summary ?? ''),
    type: row.type as Suggestion['type'],
    status: row.status as Suggestion['status'],
    confidence: (row.confidence as number) ?? 0.6,
    source_label: (row.source_label as string | null) ?? null,
    why_now: (row.why_now as string | null) ?? null,
    candidate_id: (row.candidate_id as string | null) ?? null,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    expires_at: (row.expires_at as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

export interface RefreshSuggestionsInput {
  userId: string;
  accessToken?: string;
  coords?: {
    lat: number;
    lng: number;
  };
  includePredictHQ?: boolean;
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
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => normalizeSuggestion(row as Record<string, unknown>));
}

/**
 * Accept a suggestion — marks it accepted in the database.
 * Callers are responsible for tracking the corresponding app_event.
 */
export async function acceptSuggestion(suggestionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('suggestions')
    .update({ status: 'accepted' })
    .eq('id', suggestionId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Dismiss a suggestion with an optional reason.
 */
export async function dismissSuggestion(
  suggestionId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const update: Record<string, unknown> = { status: 'dismissed' };
  if (reason) update.dismiss_reason = reason;

  const { error } = await supabase
    .from('suggestions')
    .update(update)
    .eq('id', suggestionId)
    .eq('user_id', userId);

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

export async function refreshSuggestions(
  input: RefreshSuggestionsInput,
): Promise<Suggestion[]> {
  if (!input.accessToken) {
    throw new Error('Missing auth token for intent refresh');
  }

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/intent-refresh`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        userId: input.userId,
        coords: input.coords,
        includePredictHQ: input.includePredictHQ,
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`intent-refresh failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  return (data?.suggestions ?? []).map((row: Record<string, unknown>) => normalizeSuggestion(row));
}
