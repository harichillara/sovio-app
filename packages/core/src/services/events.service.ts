import { supabase } from '../supabase/client';
import type { Json } from '../supabase/database.types';

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

export const EventTypes = {
  SUGGESTION_VIEWED: 'suggestion_viewed',
  SUGGESTION_ACCEPTED: 'suggestion_accepted',
  SUGGESTION_DISMISSED: 'suggestion_dismissed',
  MOMENTUM_AVAILABLE_TOGGLED: 'momentum_available_toggled',
  MATCH_CREATED: 'match_created',
  MESSAGE_SENT: 'message_sent',
  AI_DRAFT_REQUESTED: 'ai_draft_requested',
  AI_DRAFT_ACCEPTED: 'ai_draft_accepted',
  REPLAY_VIEWED: 'replay_viewed',
  PLAN_CREATED: 'plan_created',
  PLAN_JOINED: 'plan_joined',
  PROFILE_UPDATED: 'profile_updated',
  PRESENCE_SCORE_VIEWED: 'presence_score_viewed',
  WEEKLY_INSIGHT_VIEWED: 'weekly_insight_viewed',
  EXPERIMENT_COMPLETED: 'experiment_completed',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface AppEvent {
  id: string;
  user_id: string;
  event_type: string;
  payload: Json | null;
  source: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Track a user event.
 */
export async function trackEvent(
  userId: string,
  eventType: EventType | string,
  payload?: Json,
  source?: string,
): Promise<void> {
  const { error } = await supabase.from('app_events').insert({
    user_id: userId,
    event_type: eventType,
    payload: payload ?? null,
    source: source ?? 'mobile',
  });

  if (error) throw error;
}

/**
 * Get recent events for a user.
 */
export async function getRecentEvents(
  userId: string,
  limit = 50,
): Promise<AppEvent[]> {
  const { data, error } = await supabase
    .from('app_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AppEvent[];
}
