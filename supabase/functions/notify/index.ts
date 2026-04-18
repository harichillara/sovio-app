// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as Sentry from 'https://deno.land/x/sentry@7.120.3/index.mjs';
import { createRequestLogger, Logger } from '../_shared/logger.ts';
import { parseJson, z } from '../_shared/validate.ts';
import { scrubSentryEvent } from '../_shared/sentry-scrubber.ts';

// Body shape matches sendPushDirect in _shared/notify-helper.ts plus the
// optional notificationId passthrough from notify_insert_and_push. All fields
// capped to reasonable lengths since these ship to Expo's push API and/or
// appear in user devices. userIds capped at 500 (plenty for fanout waves).
const NotifySchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  data: z.record(z.unknown()).optional(),
  channel: z.string().max(64).optional(),
  notificationId: z.string().uuid().optional(),
});

const SENTRY_DSN = Deno.env.get('SENTRY_DSN') ?? '';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
    // Push payload bodies carry user-visible text. Strip emails/keys before
    // anything gets emitted on an Expo push failure path.
    beforeSend: (event: unknown) => scrubSentryEvent(event),
  });
  Sentry.setTag('fn', 'notify');
}

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  SUPABASE_SERVICE_ROLE_KEY,
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ---------------------------------------------------------------------------
// Auth — internal-only endpoint, requires service_role key
// ---------------------------------------------------------------------------

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function requireServiceRole(req: Request) {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader) throw new HttpError(401, 'Missing authorization header');
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, "Authorization header must be 'Bearer <token>'");
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(403, 'Notify endpoint requires service role key');
  }
}

/**
 * Send push notifications via Expo Push API.
 * Returns per-token ticket results so the caller can handle failures.
 */
async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> | undefined,
  logger: Logger,
): Promise<{ sent: number; failed: number; tickets: any[] }> {
  if (tokens.length === 0) return { sent: 0, failed: 0, tickets: [] };

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: data ?? {},
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await res.json();
    const tickets = result.data ?? [];
    const sent = tickets.filter((t: any) => t.status === 'ok').length;
    return { sent, failed: tickets.length - sent, tickets };
  } catch (err) {
    logger.error('push_send_failed', { err });
    return { sent: 0, failed: tokens.length, tickets: [] };
  }
}

/**
 * Clean up tokens that Expo reports as unregistered.
 * This prevents wasting push quota on dead tokens.
 */
async function cleanupDeadTokens(
  tokens: string[],
  tickets: any[],
  logger: Logger,
): Promise<number> {
  const deadTokens: string[] = [];

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (
      ticket.status === 'error' &&
      ticket.details?.error === 'DeviceNotRegistered' &&
      tokens[i]
    ) {
      deadTokens.push(tokens[i]);
    }
  }

  if (deadTokens.length === 0) return 0;

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .in('token', deadTokens);

  if (error) {
    logger.error('dead_token_cleanup_failed', { err: error.message });
    return 0;
  }

  return deadTokens.length;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logger = createRequestLogger('notify');

  try {
    requireServiceRole(req);

    const parsed = await parseJson(req, NotifySchema, corsHeaders);
    if (!parsed.ok) {
      logger.warn('validation_failed', { issue_count: parsed.issues.length });
      return parsed.response;
    }
    const { userIds, title, body, data, channel, notificationId } = parsed.data;

    // Get push tokens for these users
    const { data: tokenRows, error } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds);

    if (error) throw error;

    const tokens = (tokenRows ?? []).map((t: any) => t.token).filter(Boolean);

    const result = await sendPushNotification(tokens, title, body, {
      ...data,
      channel: channel ?? 'default',
    }, logger);

    // Clean up any dead/unregistered tokens
    const cleaned = await cleanupDeadTokens(tokens, result.tickets, logger);
    if (cleaned > 0) {
      logger.info('dead_tokens_cleaned', { count: cleaned });
    }

    // Mark the notification as push_sent if a notificationId was provided
    if (notificationId && result.sent > 0) {
      await supabase
        .from('notifications')
        .update({ push_sent: true })
        .eq('id', notificationId);
    }

    return new Response(
      JSON.stringify({ sent: result.sent, failed: result.failed, cleaned }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    logger.error('unhandled_error', { err });
    if (SENTRY_DSN) Sentry.captureException(err);
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
