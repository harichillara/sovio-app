// deno-lint-ignore-file no-explicit-any
import { supabase } from './supabase.ts';
import type { Logger } from './logger.ts';

/**
 * Insert a notification and dispatch push via the SQL function.
 * This is the standard way to create a notification from Edge Functions.
 *
 * Pass a request-scoped `logger` to correlate failures with the originating
 * request. Omitting it falls back to raw `console.error` so older callers
 * keep working while the structured-logging migration rolls out.
 */
export async function createNotification(
  userId: string,
  kind: 'suggestion' | 'message' | 'replay' | 'insight' | 'match',
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  logger?: Logger,
): Promise<string | null> {
  const { data: result, error } = await supabase.rpc('notify_insert_and_push', {
    p_user_id: userId,
    p_kind: kind,
    p_title: title,
    p_body: body,
    p_data: data,
  });

  if (error) {
    if (logger) {
      logger.child({ user_id: userId }).error('notification_insert_failed', {
        kind,
        err: error.message,
      });
    } else {
      console.error('notification_insert_failed', { user_id: userId, err: error });
    }
    return null;
  }

  return result as string;
}

/**
 * Send push directly via the notify Edge Function (for cases where
 * the SQL function is not suitable, e.g., calling from another Edge Function
 * that needs to include the notification row itself).
 */
export async function sendPushDirect(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channel?: string,
  logger?: Logger,
): Promise<{ sent: number; failed: number }> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ userIds, title, body, data, channel }),
    });

    if (!res.ok) {
      if (logger) {
        logger.error('notify_fn_call_failed', { status: res.status, recipients: userIds.length });
      } else {
        console.error('notify_fn_call_failed', { status: res.status });
      }
      return { sent: 0, failed: userIds.length };
    }

    return await res.json();
  } catch (err) {
    if (logger) {
      logger.error('send_push_direct_failed', { err, recipients: userIds.length });
    } else {
      console.error('send_push_direct_failed', { err });
    }
    return { sent: 0, failed: userIds.length };
  }
}
