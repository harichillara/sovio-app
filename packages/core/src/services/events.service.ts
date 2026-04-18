import { supabase } from '../supabase/client';
import type { Json } from '../supabase/database.types';
import { eventBuffer } from '../analytics/eventBuffer';

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

export const EventTypes = {
  SUGGESTION_VIEWED: 'suggestion_viewed',
  SUGGESTION_ACCEPTED: 'suggestion_accepted',
  SUGGESTION_DISMISSED: 'suggestion_dismissed',
  SUGGESTION_REFRESHED: 'suggestion_refreshed',
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
  AUTOPILOT_APPROVED: 'autopilot_approved',
  AUTOPILOT_REJECTED: 'autopilot_rejected',
  BILLING_INTEREST_REQUESTED: 'billing_interest_requested',
  BILLING_CANCELLATION_REQUESTED: 'billing_cancellation_requested',
  ACCOUNT_DELETION_REQUESTED: 'account_deletion_requested',
  MESSAGE_REPORTED: 'message_reported',
  USER_REPORTED: 'user_reported',
  NOTIFICATION_READ: 'notification_read',
  NOTIFICATION_TAPPED: 'notification_tapped',
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
 *
 * Events are buffered client-side and flushed as a batch (see
 * `analytics/eventBuffer.ts`) to cut write contention on the `app_events`
 * table. Buffered inserts are best-effort — a network failure drops the
 * batch rather than retrying forever. If you need a synchronous guarantee
 * (e.g. right before sign-out), call `flushEvents()`.
 *
 * The signature is preserved for backward compatibility with callers that
 * still `await trackEvent(...)`. The returned promise resolves immediately
 * after buffering — it does NOT wait for the batch to hit the server.
 */
export async function trackEvent(
  userId: string,
  eventType: EventType,
  payload?: Json,
  source?: string,
): Promise<void> {
  eventBuffer.track({
    user_id: userId,
    event_type: eventType,
    payload: payload ?? null,
    source: source ?? 'mobile',
  });
}

/**
 * Force an immediate flush of the in-memory event buffer. Useful right
 * before sign-out or when the app knows it is about to terminate.
 */
export async function flushEvents(): Promise<void> {
  await eventBuffer.flush();
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
