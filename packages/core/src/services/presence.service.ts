import { supabase } from '../supabase/client';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface PresenceDaily {
  id: string;
  user_id: string;
  day: string; // YYYY-MM-DD
  score: number;
  activity_score: number;
  social_score: number;
  movement_score: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Get the presence score for a specific day.
 */
export async function getDailyScore(
  userId: string,
  day?: string,
): Promise<PresenceDaily | null> {
  const targetDay = day ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('presence_daily')
    .select('*')
    .eq('user_id', userId)
    .eq('day', targetDay)
    .maybeSingle();

  if (error) throw error;
  return data as PresenceDaily | null;
}

/**
 * Get score history for the last N days.
 */
export async function getScoreHistory(
  userId: string,
  days = 7,
): Promise<PresenceDaily[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('presence_daily')
    .select('*')
    .eq('user_id', userId)
    .gte('day', sinceStr)
    .order('day', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PresenceDaily[];
}

/**
 * Compute and upsert today's presence score from app_events.
 * This is intended to be called from a cron job / Edge Function, NOT the client.
 */
export async function computeScore(userId: string): Promise<PresenceDaily> {
  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;

  // Count events by category
  const { data: events, error } = await supabase
    .from('app_events')
    .select('event_type')
    .eq('user_id', userId)
    .gte('created_at', startOfDay);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const e of events ?? []) {
    counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;
  }

  // Simple scoring model (each out of ~33, total 100)
  const activityEvents = [
    'suggestion_viewed',
    'suggestion_accepted',
    'replay_viewed',
    'weekly_insight_viewed',
    'presence_score_viewed',
  ];
  const socialEvents = [
    'message_sent',
    'match_created',
    'plan_joined',
    'ai_draft_accepted',
  ];
  const movementEvents = [
    'momentum_available_toggled',
    'plan_created',
    'experiment_completed',
  ];

  const activityRaw = activityEvents.reduce(
    (sum, t) => sum + (counts[t] ?? 0),
    0,
  );
  const socialRaw = socialEvents.reduce(
    (sum, t) => sum + (counts[t] ?? 0),
    0,
  );
  const movementRaw = movementEvents.reduce(
    (sum, t) => sum + (counts[t] ?? 0),
    0,
  );

  const cap = (val: number, max: number) => Math.min(val, max);
  const activityScore = cap(Math.round((activityRaw / 5) * 33), 33);
  const socialScore = cap(Math.round((socialRaw / 4) * 34), 34);
  const movementScore = cap(Math.round((movementRaw / 3) * 33), 33);
  const score = activityScore + socialScore + movementScore;

  const row: Omit<PresenceDaily, 'id' | 'created_at'> = {
    user_id: userId,
    day: today,
    score,
    activity_score: activityScore,
    social_score: socialScore,
    movement_score: movementScore,
  };

  const { data: upserted, error: upsertError } = await supabase
    .from('presence_daily')
    .upsert(row, { onConflict: 'user_id,day' })
    .select('*')
    .single();

  if (upsertError) throw upsertError;
  return upserted as PresenceDaily;
}
