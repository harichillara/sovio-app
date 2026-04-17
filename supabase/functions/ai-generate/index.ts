// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as Sentry from 'https://deno.land/x/sentry@7.120.3/index.mjs';
import { createRequestLogger, Logger } from '../_shared/logger.ts';
import { parseJson, z } from '../_shared/validate.ts';
import { sanitizeUserInput, wrapUntrusted, INJECTION_DEFENSE_HEADER } from '../_shared/prompt-safety.ts';
import { AiGenerateBodySchema, type AiGenerateBody } from './schemas.ts';
import {
  consumeRateLimit,
  rateLimitExceededResponse,
  rateLimitHeaders,
  type RateLimitResult,
} from '../_shared/rate-limit.ts';
import {
  enqueueAiJob,
  claimAiJobs,
  runJobs,
  type ClaimedJob,
} from '../_shared/queue.ts';

// Per-hour caps on the `ai-generate` bucket. Pro gets ~10x the free cap;
// values match the Phase 3 plan (Task 16) — tune via config if abuse patterns
// demand it. Expressed here rather than at the call site so any change touches
// one place.
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const RATE_LIMIT_FREE = 60;
const RATE_LIMIT_PRO = 600;
const RATE_LIMIT_BUCKET = 'ai-generate';

// Request-body schemas live in `./schemas.ts` so unit tests can exercise the
// discriminated-union shape without triggering this module's DB + Sentry
// side-effects at import time. See ai-generate.schemas.test.ts.

const SENTRY_DSN = Deno.env.get('SENTRY_DSN') ?? '';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
  });
  Sentry.setTag('fn', 'ai-generate');
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getBearerToken(req: Request): string {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader) throw new HttpError(401, 'Missing authorization header');
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, "Authorization header must be 'Bearer <token>'");
  return token;
}

async function authenticateUser(req: Request, requestedUserId?: string | null) {
  const token = getBearerToken(req);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new HttpError(401, 'Invalid JWT');
  if (requestedUserId && requestedUserId !== user.id) {
    throw new HttpError(403, 'Cannot perform operations for another user');
  }
  return user;
}

function requireServiceRole(req: Request) {
  const token = getBearerToken(req);
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(403, 'Cron operations require service role key');
  }
}

// ---------------------------------------------------------------------------
// Server-side quota enforcement
//
// Phase 1 design: check-then-increment is NOT atomic — there's a TOCTOU window
// between checkQuotaServer (pre-Gemini) and incrementUsageServer (post-Gemini)
// during which concurrent requests from the same user can all pass the check
// before any of them has incremented. Worst-case overrun is bounded by the
// user's request concurrency; acceptable for Phase 1. Phase 2: do an atomic
// "reserve-slot" RPC (row-level lock or atomic UPDATE with a check-constraint).
// ---------------------------------------------------------------------------

const FREE_DAILY_LIMIT = 50;

// Next UTC midnight — matches the client's getNextResetAt semantics so staged
// users don't see jumpy counters when read on one side and written on the other.
function nextResetAt(base = new Date()): string {
  const next = new Date(base);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

type QuotaResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: 'quota_exceeded' | 'plan_suspended'; used: number; limit: number };

async function checkQuotaServer(userId: string, logger: Logger): Promise<QuotaResult> {
  const { data, error } = await supabase
    .from('entitlements')
    .select('plan, pro_until, daily_ai_calls_used, daily_ai_calls_reset_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('quota_check_failed', { err: error.message });
    // Fail open on read errors — we'd rather let the call through than
    // block legitimate users on a transient DB blip. Authoritative increment
    // will still happen on success.
    return { ok: true, remaining: FREE_DAILY_LIMIT };
  }

  const plan = (data?.plan as 'free' | 'pro' | undefined) ?? 'free';
  const proUntil = data?.pro_until as string | null | undefined;

  const isPro =
    plan === 'pro' &&
    proUntil !== null &&
    proUntil !== undefined &&
    new Date(proUntil).getTime() > Date.now();

  if (isPro) {
    return { ok: true, remaining: Number.POSITIVE_INFINITY };
  }

  // Rollover: if now >= reset_at, the counter is stale — treat used=0.
  const resetAt = data?.daily_ai_calls_reset_at as string | null | undefined;
  const stale = !resetAt || Date.now() >= new Date(resetAt).getTime();
  const used = stale ? 0 : ((data?.daily_ai_calls_used as number | null) ?? 0);

  if (used >= FREE_DAILY_LIMIT) {
    return { ok: false, reason: 'quota_exceeded', used, limit: FREE_DAILY_LIMIT };
  }

  return { ok: true, remaining: FREE_DAILY_LIMIT - used };
}

async function incrementUsageServer(userId: string): Promise<void> {
  // Try to read the current row (service_role bypasses RLS).
  const { data: existing, error: readErr } = await supabase
    .from('entitlements')
    .select('id, daily_ai_calls_used, daily_ai_calls_reset_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr) throw readErr;

  if (!existing) {
    // New user — create the row on free tier with used=1.
    const { error } = await supabase.from('entitlements').insert({
      user_id: userId,
      plan: 'free',
      pro_until: null,
      daily_ai_calls_used: 1,
      daily_ai_calls_reset_at: nextResetAt(),
    });
    if (error) throw error;
    return;
  }

  const resetAt = existing.daily_ai_calls_reset_at as string | null;
  const stale = !resetAt || Date.now() >= new Date(resetAt).getTime();
  const nextUsed = stale ? 1 : ((existing.daily_ai_calls_used as number) ?? 0) + 1;
  const nextReset = stale ? nextResetAt() : resetAt;

  const { error: updateErr } = await supabase
    .from('entitlements')
    .update({
      daily_ai_calls_used: nextUsed,
      daily_ai_calls_reset_at: nextReset,
    })
    .eq('id', existing.id);

  if (updateErr) throw updateErr;
}

/**
 * Look up the caller's plan for rate-limit purposes. Returns 'pro' only if
 * pro_until is still in the future (5-min clock-skew grace matches the
 * client-side `isPro` check in entitlements.service.ts). Any lookup failure
 * falls back to 'free' — conservative denominator for the cap.
 */
async function getPlanForRateLimit(userId: string, logger: Logger): Promise<'free' | 'pro'> {
  const { data, error } = await supabase
    .from('entitlements')
    .select('plan, pro_until')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.warn('rate_limit_plan_lookup_failed', { err: error.message });
    return 'free';
  }
  if (!data || data.plan !== 'pro' || !data.pro_until) return 'free';

  const GRACE_MS = 5 * 60 * 1000;
  const proUntil = new Date(data.pro_until).getTime();
  return proUntil > Date.now() - GRACE_MS ? 'pro' : 'free';
}

async function enforceQuotaAndRun<T>(
  userId: string,
  logger: Logger,
  corsHeaders: Record<string, string>,
  run: () => Promise<T>,
): Promise<{ response: Response } | { result: T; headers: Record<string, string> }> {
  // 1. Per-hour rate limit — cheap, deterministic, blocks Gemini burn FIRST
  //    so quota/Gemini calls don't happen for users spamming the endpoint.
  const plan = await getPlanForRateLimit(userId, logger);
  const cap = plan === 'pro' ? RATE_LIMIT_PRO : RATE_LIMIT_FREE;
  const rl: RateLimitResult = await consumeRateLimit(
    supabase,
    userId,
    { bucket: RATE_LIMIT_BUCKET, max: cap, windowSeconds: RATE_LIMIT_WINDOW_SECONDS },
    logger,
  );
  if (!rl.allowed) {
    logger.warn('rate_limit_exceeded', { plan, used: rl.used, limit: cap });
    return { response: rateLimitExceededResponse(rl, cap, corsHeaders) };
  }

  // 2. Daily token-usage quota — separate concern (cost ceiling per day vs
  //    anti-abuse per hour). Kept as an independent gate.
  const quota = await checkQuotaServer(userId, logger);
  if (!quota.ok) {
    return {
      response: new Response(
        JSON.stringify({ error: 'quota_exceeded', ...quota }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            ...rateLimitHeaders(rl, cap),
          },
        },
      ),
    };
  }

  const result = await run();

  // Increment AFTER a successful run. Wrap so increment failures do not
  // fail the user's call — just log. See TOCTOU note above.
  try {
    await incrementUsageServer(userId);
  } catch (incErr) {
    logger.error('usage_increment_failed', { err: incErr });
  }

  return { result, headers: rateLimitHeaders(rl, cap) };
}

// ---------------------------------------------------------------------------
// Gemini helper
// ---------------------------------------------------------------------------

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) return '(AI unavailable — no API key configured)';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

async function handleIntent(body: any, logger: Logger) {
  const { userId } = body;
  if (!userId) throw new Error('userId required');

  // Fetch user context
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, bio, subscription_tier')
    .eq('id', userId)
    .single();

  const { data: interests } = await supabase
    .from('user_interests')
    .select('interest')
    .eq('user_id', userId);

  const nameRes = sanitizeUserInput(profile?.display_name ?? 'Unknown');
  const bioRes = sanitizeUserInput(profile?.bio ?? 'Not set');
  const interestList = (interests ?? []).map((i: any) => i.interest).join(', ');
  const interestsRes = sanitizeUserInput(interestList || 'Not specified');
  const tierRes = sanitizeUserInput(profile?.subscription_tier ?? 'free');

  const allFlags = [
    ...nameRes.flags,
    ...bioRes.flags,
    ...interestsRes.flags,
    ...tierRes.flags,
  ];
  if (allFlags.length) {
    logger.warn('injection_attempt_sanitized', {
      site: 'intent',
      fields: ['display_name', 'bio', 'interests', 'subscription_tier'],
      flags: allFlags,
    });
  }

  const prompt = `${INJECTION_DEFENSE_HEADER}

You are Sovio, a social planning AI. Generate 1-3 personalized activity suggestions for this user.

User: ${wrapUntrusted('display_name', nameRes.clean)}
Bio: ${wrapUntrusted('bio', bioRes.clean)}
Interests: ${wrapUntrusted('interests', interestsRes.clean)}
Tier: ${wrapUntrusted('subscription_tier', tierRes.clean)}

Return a JSON array of objects with: title (string), summary (string, 1-2 sentences), type ("plan" | "place" | "group"), confidence (0.0-1.0).
Return ONLY valid JSON, no markdown.`;

  const raw = await callGemini(prompt);

  let suggestions: any[];
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    suggestions = JSON.parse(cleaned);
  } catch {
    suggestions = [
      {
        title: 'Explore something new',
        summary: 'Check out a spot you haven\'t been to before.',
        type: 'plan',
        confidence: 0.6,
      },
    ];
  }

  // Write suggestions to DB
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const rows = suggestions.slice(0, 3).map((s: any) => ({
    user_id: userId,
    title: s.title ?? 'Suggestion',
    summary: s.summary ?? '',
    type: s.type ?? 'plan',
    status: 'new',
    confidence: Math.min(Math.max(s.confidence ?? 0.5, 0), 1),
    expires_at: expiresAt,
  }));

  const { error } = await supabase.from('suggestions').insert(rows);
  if (error) throw error;

  return { suggestions: rows };
}

async function handleReplyDraft(body: any, logger: Logger) {
  const { threadId, userId } = body;
  if (!threadId) throw new Error('threadId required');
  if (!userId) throw new Error('userId required');

  // Fetch recent messages for context
  const { data: messages } = await supabase
    .from('messages')
    .select('content, sender_id, is_ai_draft')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(10);

  const allFlags: string[] = [];
  const conversation = (messages ?? [])
    .reverse()
    .map((m: any) => {
      const res = sanitizeUserInput(m.content);
      if (res.flags.length) allFlags.push(...res.flags);
      return `${m.sender_id === userId ? 'You' : 'Them'}: ${res.clean}`;
    })
    .join('\n');

  if (allFlags.length) {
    logger.warn('injection_attempt_sanitized', {
      site: 'reply_draft',
      fields: ['messages.content'],
      flags: allFlags,
    });
  }

  const prompt = `${INJECTION_DEFENSE_HEADER}

You are Sovio AI, a friendly social assistant. Draft a natural, warm reply to this conversation. Keep it short (1-2 sentences), match the tone, and don't be overly formal.

Conversation:
${wrapUntrusted('conversation', conversation)}

Draft reply:`;

  const draft = await callGemini(prompt);
  return { draft: draft.trim() };
}

async function handleReplay(body: any, logger: Logger) {
  const { userId } = body;
  if (!userId) throw new Error('userId required');

  // Get yesterday's dismissed suggestions and expired plans
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const { data: dismissed } = await supabase
    .from('suggestions')
    .select('title, summary')
    .eq('user_id', userId)
    .in('status', ['dismissed', 'expired'])
    .gte('created_at', `${yesterdayStr}T00:00:00Z`)
    .limit(5);

  if (!dismissed?.length) {
    return { items: [] };
  }

  const allFlags: string[] = [];
  const missedLines = dismissed.map((d: any) => {
    const titleRes = sanitizeUserInput(d.title);
    const summaryRes = sanitizeUserInput(d.summary);
    if (titleRes.flags.length) allFlags.push(...titleRes.flags);
    if (summaryRes.flags.length) allFlags.push(...summaryRes.flags);
    return `- ${titleRes.clean}: ${summaryRes.clean}`;
  }).join('\n');

  if (allFlags.length) {
    logger.warn('injection_attempt_sanitized', {
      site: 'replay',
      fields: ['dismissed.title', 'dismissed.summary'],
      flags: allFlags,
    });
  }

  const prompt = `${INJECTION_DEFENSE_HEADER}

You are Sovio AI. The user missed these opportunities yesterday. For each, write a short (1 sentence) reason why they might want to reconsider today.

Missed:
${wrapUntrusted('missed_moments', missedLines)}

Return a JSON array of objects with: title (string), reason (string).
Return ONLY valid JSON.`;

  const raw = await callGemini(prompt);

  let items: any[];
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    items = JSON.parse(cleaned);
  } catch {
    items = dismissed.map((d: any) => ({
      title: d.title,
      reason: 'Give this another look today.',
    }));
  }

  // Write to missed_moments
  const rows = items.slice(0, 5).map((item: any) => ({
    user_id: userId,
    reason: item.reason ?? 'Missed opportunity',
  }));

  const { error: insertErr } = await supabase.from('missed_moments').insert(rows);
  if (insertErr) {
    logger.error('replay_persist_failed', { err: insertErr.message });
  }

  return { items };
}

async function handleWeeklyInsight(body: any, logger: Logger) {
  const { userId } = body;
  if (!userId) throw new Error('userId required');
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const weekStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - diffToMonday,
  ));
  const weekOf = weekStart.toISOString().slice(0, 10);

  // Get last 7 days of events
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: events } = await supabase
    .from('app_events')
    .select('event_type')
    .eq('user_id', userId)
    .gte('created_at', weekAgo.toISOString());

  const counts: Record<string, number> = {};
  for (const e of events ?? []) {
    counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;
  }

  const activityText =
    Object.entries(counts).map(([k, v]) => `${k}: ${v} times`).join('\n') || 'Very little activity';
  // Event types are from a fixed server-side vocabulary, but sanitize + wrap
  // for uniformity / defense-in-depth.
  const activityRes = sanitizeUserInput(activityText);
  if (activityRes.flags.length) {
    logger.warn('injection_attempt_sanitized', {
      site: 'weekly_insight',
      fields: ['activity_counts'],
      flags: activityRes.flags,
    });
  }

  const prompt = `${INJECTION_DEFENSE_HEADER}

You are Sovio AI, a weekly coach. Based on this user's activity this week, provide a brief, warm insight (3-4 sentences) and suggest one small experiment they could try next week.

Activity this week:
${wrapUntrusted('activity', activityRes.clean)}

Return a JSON object with: insight (string), experiment (string, 1 sentence).
Return ONLY valid JSON.`;

  const raw = await callGemini(prompt);

  let result: any;
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    result = JSON.parse(cleaned);
  } catch {
    result = {
      insight: 'You had a quiet week. Sometimes rest is the move.',
      experiment: 'Try saying yes to one spontaneous invite this week.',
    };
  }

  // Store insight in the canonical weekly_insights table.
  const { error: upsertErr } = await supabase.from('weekly_insights').upsert(
    {
      user_id: userId,
      week_of: weekOf,
      insight: result.insight,
      experiment: result.experiment,
      experiment_done: false,
    },
    { onConflict: 'user_id,week_of' },
  );
  if (upsertErr) {
    logger.error('weekly_insight_persist_failed', { err: upsertErr.message });
  }

  return {
    ...result,
    week_of: weekOf,
  };
}

async function handleDecisionProposal(body: any) {
  const { userId, constraints } = body;
  if (!userId) throw new Error('userId required');

  // Sanitize any free-form user content before wrapping in delimited blocks.
  // Numeric fields (budget, maxTravel, groupSize) go through string coercion
  // + the same pipeline for uniform treatment and defense-in-depth.
  const budgetRes = sanitizeUserInput(String(constraints?.budget ?? 'Any'));
  const maxTravelRes = sanitizeUserInput(String(constraints?.maxTravel ?? 'Any'));
  const preferredTimesRes = sanitizeUserInput(
    (constraints?.preferredTimes ?? []).join(', ') || 'Any',
  );
  const groupSizeRes = sanitizeUserInput(
    (constraints?.groupSize ?? []).join(', ') || 'Any',
  );
  const allFlags = [
    ...budgetRes.flags,
    ...maxTravelRes.flags,
    ...preferredTimesRes.flags,
    ...groupSizeRes.flags,
  ];
  if (allFlags.length) {
    logger.child({ user_id: userId, op: 'decision_proposal' }).warn(
      'injection_attempt_sanitized',
      { fields: ['budget', 'maxTravel', 'preferredTimes', 'groupSize'], flags: allFlags },
    );
  }

  const prompt = `${INJECTION_DEFENSE_HEADER}

You are Sovio Decision Autopilot. Based on the user's constraints, propose a plan.

Constraints:
- Budget: ${wrapUntrusted('budget', budgetRes.clean)}
- Max travel: ${wrapUntrusted('max_travel', maxTravelRes.clean)} minutes
- Preferred times: ${wrapUntrusted('preferred_times', preferredTimesRes.clean)}
- Group size: ${wrapUntrusted('group_size', groupSizeRes.clean)}

Return a JSON object with: title (string), summary (string, 2-3 sentences), assumptions (string array of 2-3 items).
Return ONLY valid JSON.`;

  const raw = await callGemini(prompt);

  let result: any;
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    result = JSON.parse(cleaned);
  } catch {
    result = {
      title: 'Weekend hangout',
      summary: 'A casual get-together based on your preferences.',
      assumptions: ['Budget-friendly venue', 'Within travel range'],
    };
  }

  // Create AI job
  // kind='autopilot' is the discriminator added in 20260416195000_ai_jobs_unify.
  // Required: the merged ai_jobs_status_check constraint only allows status='done'
  // when kind='autopilot', so the INSERT fails without it.
  const { error } = await supabase.from('ai_jobs').insert({
    user_id: userId,
    kind: 'autopilot',
    job_type: 'decision',
    status: 'done',
    result,
  });

  if (error) throw error;
  return result;
}

// ---------------------------------------------------------------------------
// Cron entry points (called without JWT, authenticated by service role)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Per-user job processors
//
// These are the units of work the queue worker dispatches. Each takes a
// single userId and throws on failure — `runJobs` translates thrown
// exceptions into `fail_ai_job` RPCs (retry w/ backoff, then DLQ).
//
// Extracted from the old serial fan-out so cron producers can enqueue one
// job per user instead of processing inline. Behavior inside each processor
// is unchanged from the pre-queue version; only the surrounding loop moved.
// ---------------------------------------------------------------------------

async function processSuggestionForUser(userId: string, logger: Logger) {
  // Skip users who already have fresh suggestions in the current window.
  const { data: existing } = await supabase
    .from('suggestions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'new')
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    return { skipped: 'fresh' as const };
  }

  const refreshResponse = await fetch(`${SUPABASE_URL}/functions/v1/intent-refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ userId, includePredictHQ: true }),
  });

  if (!refreshResponse.ok) {
    // Throwing re-queues the job with backoff (and eventually DLQs it).
    throw new Error(`intent-refresh failed with ${refreshResponse.status}`);
  }

  // Best-effort push notification — don't fail the job if this flops;
  // the user already has their suggestion, the push is a nice-to-have.
  try {
    const { data: freshSuggestions } = await supabase
      .from('suggestions')
      .select('title')
      .eq('user_id', userId)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(1);

    const firstTitle = freshSuggestions?.[0]?.title ?? 'New suggestions waiting for you';
    await supabase.rpc('notify_insert_and_push', {
      p_user_id: userId,
      p_kind: 'suggestion',
      p_title: 'A low-friction plan is ready',
      p_body: firstTitle,
      p_data: { route: '/(tabs)/home' },
    });
  } catch (pushErr) {
    logger.error('suggestion_push_failed', { err: pushErr });
  }

  return { generated: true };
}

async function processPresenceForUser(userId: string, logger: Logger) {
  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;

  const activityEvents = [
    'suggestion_viewed', 'suggestion_accepted', 'replay_viewed',
    'weekly_insight_viewed', 'presence_score_viewed',
  ];
  const socialEvents = [
    'message_sent', 'match_created', 'plan_joined', 'ai_draft_accepted',
  ];
  const movementEvents = [
    'momentum_available_toggled', 'plan_created', 'experiment_completed',
  ];

  const { data: events, error: evErr } = await supabase
    .from('app_events')
    .select('event_type')
    .eq('user_id', userId)
    .gte('created_at', startOfDay);

  if (evErr) throw new Error(`presence read failed: ${evErr.message}`);

  const counts: Record<string, number> = {};
  for (const e of events ?? []) {
    counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;
  }

  const activityRaw = activityEvents.reduce((s, t) => s + (counts[t] ?? 0), 0);
  const socialRaw = socialEvents.reduce((s, t) => s + (counts[t] ?? 0), 0);
  const movementRaw = movementEvents.reduce((s, t) => s + (counts[t] ?? 0), 0);

  const cap = (val: number, max: number) => Math.min(val, max);
  const activityScore = cap(Math.round((activityRaw / 5) * 33), 33);
  const socialScore = cap(Math.round((socialRaw / 4) * 34), 34);
  const movementScore = cap(Math.round((movementRaw / 3) * 33), 33);
  const score = activityScore + socialScore + movementScore;

  const { error: upErr } = await supabase.from('presence_daily').upsert(
    {
      user_id: userId,
      day: today,
      score,
      activity_score: activityScore,
      social_score: socialScore,
      movement_score: movementScore,
    },
    { onConflict: 'user_id,day' },
  );
  if (upErr) throw new Error(`presence upsert failed: ${upErr.message}`);

  logger.info('presence_computed', { score });
  return { score };
}

async function processReplayForUser(userId: string, logger: Logger) {
  return await handleReplay({ userId }, logger);
}

async function processWeeklyInsightForUser(userId: string, logger: Logger) {
  return await handleWeeklyInsight({ userId }, logger);
}

// ---------------------------------------------------------------------------
// Cron producers — enqueue per-user jobs
//
// Each cron now JUST fans out enqueue calls and returns immediately. Actual
// work happens later, in the worker op, bounded by DB concurrency. This
// takes fan-out time from "O(users × per_user_seconds)" (blocked by edge-fn
// timeout past ~1k DAU) to "O(users × enqueue_latency)" — a few seconds
// even for 10k+ users.
// ---------------------------------------------------------------------------

/**
 * Derive a job_key scope for dedup. Scope is per fan-out window so a later
 * cron tick's work enqueues fresh but a SAME-tick retry (or duplicate pg_cron
 * run) doesn't pile up twins.
 */
function jobKeyFor(jobType: string, userId: string, scope: string): string {
  return `${jobType}:${userId}:${scope}`;
}

async function handleCronSuggestions(logger: Logger) {
  // Active users — any event in the last 7 days.
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: activeUsers, error: qErr } = await supabase
    .from('app_events')
    .select('user_id')
    .gte('created_at', weekAgo.toISOString());
  if (qErr) throw new Error(`active_users query failed: ${qErr.message}`);

  const uniqueUserIds = [...new Set((activeUsers ?? []).map((e: any) => e.user_id))];

  // Hour-precision scope — re-firing the hourly cron within the same hour
  // no-ops on dedup. Next hour's cron scopes to a fresh bucket.
  const scope = new Date().toISOString().slice(0, 13); // yyyy-mm-ddTHH
  let enqueued = 0;
  let skipped = 0;
  for (const userId of uniqueUserIds) {
    const res = await enqueueAiJob(
      supabase,
      {
        userId,
        jobType: 'suggestions',
        jobKey: jobKeyFor('suggestions', userId, scope),
      },
      logger,
    );
    if (res.enqueued) enqueued++;
    else skipped++;
  }
  logger.info('cron_suggestions_enqueued', { enqueued, skipped, totalUsers: uniqueUserIds.length });
  return { enqueued, skipped, totalUsers: uniqueUserIds.length };
}

async function handleCronPresence(logger: Logger) {
  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;

  const { data: todayUsers, error: qErr } = await supabase
    .from('app_events')
    .select('user_id')
    .gte('created_at', startOfDay);
  if (qErr) throw new Error(`presence active_users query failed: ${qErr.message}`);

  const uniqueUserIds = [...new Set((todayUsers ?? []).map((e: any) => e.user_id))];

  let enqueued = 0;
  let skipped = 0;
  for (const userId of uniqueUserIds) {
    const res = await enqueueAiJob(
      supabase,
      {
        userId,
        jobType: 'presence',
        jobKey: jobKeyFor('presence', userId, today),
      },
      logger,
    );
    if (res.enqueued) enqueued++;
    else skipped++;
  }
  logger.info('cron_presence_enqueued', { enqueued, skipped, totalUsers: uniqueUserIds.length });
  return { enqueued, skipped, totalUsers: uniqueUserIds.length };
}

async function handleCronReplay(logger: Logger) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const { data: usersWithMissed, error: qErr } = await supabase
    .from('suggestions')
    .select('user_id')
    .in('status', ['dismissed', 'expired'])
    .gte('created_at', `${yesterdayStr}T00:00:00Z`)
    .lt('created_at', `${yesterdayStr}T23:59:59Z`);
  if (qErr) throw new Error(`replay users query failed: ${qErr.message}`);

  const uniqueUserIds = [...new Set((usersWithMissed ?? []).map((e: any) => e.user_id))];

  let enqueued = 0;
  let skipped = 0;
  for (const userId of uniqueUserIds) {
    const res = await enqueueAiJob(
      supabase,
      {
        userId,
        jobType: 'replay',
        jobKey: jobKeyFor('replay', userId, yesterdayStr),
      },
      logger,
    );
    if (res.enqueued) enqueued++;
    else skipped++;
  }
  logger.info('cron_replay_enqueued', { enqueued, skipped, totalUsers: uniqueUserIds.length });
  return { enqueued, skipped, totalUsers: uniqueUserIds.length };
}

async function handleCronWeeklyInsight(logger: Logger) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: activeUsers, error: qErr } = await supabase
    .from('app_events')
    .select('user_id')
    .gte('created_at', weekAgo.toISOString());
  if (qErr) throw new Error(`weekly_insight active_users query failed: ${qErr.message}`);

  const uniqueUserIds = [...new Set((activeUsers ?? []).map((e: any) => e.user_id))];

  // ISO week scope — re-firing within the same week dedups; next week's run
  // enqueues fresh.
  const now = new Date();
  const scope = `${now.getUTCFullYear()}W${Math.ceil((now.getUTCDate() + 6) / 7)}`;
  let enqueued = 0;
  let skipped = 0;
  for (const userId of uniqueUserIds) {
    const res = await enqueueAiJob(
      supabase,
      {
        userId,
        jobType: 'weekly_insight',
        jobKey: jobKeyFor('weekly_insight', userId, scope),
      },
      logger,
    );
    if (res.enqueued) enqueued++;
    else skipped++;
  }
  logger.info('cron_weekly_insight_enqueued', { enqueued, skipped, totalUsers: uniqueUserIds.length });
  return { enqueued, skipped, totalUsers: uniqueUserIds.length };
}

// ---------------------------------------------------------------------------
// Queue worker — drains ai_jobs
//
// Called every minute by pg_cron. Claims up to JOB_BATCH jobs, runs them
// with bounded concurrency, acks/nacks via RPC. Stuck workers are auto-
// reclaimed after JOB_VISIBILITY_SEC by the next tick's claim.
//
// Tuning:
//   JOB_BATCH × (60s / per-job-seconds) ≈ throughput per tick.
//   Increase JOB_CONCURRENCY before JOB_BATCH — more parallelism per tick
//   amortizes Gemini latency better than claiming more jobs serially.
// ---------------------------------------------------------------------------

const JOB_BATCH = 8;
const JOB_CONCURRENCY = 4;
const JOB_VISIBILITY_SEC = 120;

async function handleCronWorker(logger: Logger) {
  const jobs: ClaimedJob[] = await claimAiJobs(supabase, JOB_BATCH, JOB_VISIBILITY_SEC, logger);
  if (jobs.length === 0) {
    return { claimed: 0, succeeded: 0, retried: 0, dlq: 0, stale: 0 };
  }

  const counts = await runJobs(
    supabase,
    jobs,
    async (job) => {
      const userLogger = logger.child({
        user_id: job.userId,
        job_type: job.jobType,
        job_id: job.id,
        attempt: job.attempt,
      });
      switch (job.jobType) {
        case 'suggestions':
          return (await processSuggestionForUser(job.userId, userLogger)) as Record<string, unknown>;
        case 'presence':
          return (await processPresenceForUser(job.userId, userLogger)) as Record<string, unknown>;
        case 'replay':
          return (await processReplayForUser(job.userId, userLogger)) as unknown as Record<string, unknown>;
        case 'weekly_insight':
          return (await processWeeklyInsightForUser(job.userId, userLogger)) as unknown as Record<string, unknown>;
        default:
          // Unknown job_type — fail-terminal via high attempt count. Throwing
          // goes through failAiJob → DLQ after max_attempts. For an unknown
          // type we'd rather DLQ immediately, so surface a clear error.
          throw new Error(`Unknown job_type: ${job.jobType}`);
      }
    },
    JOB_CONCURRENCY,
    logger,
  );

  logger.info('cron_worker_tick', { claimed: jobs.length, ...counts });
  return { claimed: jobs.length, ...counts };
}

async function handleCronCleanup() {
  const now = new Date().toISOString();

  // Expire old suggestions
  const { data: expiredSuggestions } = await supabase
    .from('suggestions')
    .update({ status: 'expired' })
    .eq('status', 'new')
    .lt('expires_at', now)
    .select('id');

  // Remove expired momentum availability
  const { data: expiredMomentum } = await supabase
    .from('momentum_availability')
    .delete()
    .lt('available_until', now)
    .select('id');

  return {
    expiredSuggestions: expiredSuggestions?.length ?? 0,
    expiredMomentum: expiredMomentum?.length ?? 0,
  };
}

async function handleCronRetention() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: purged } = await supabase
    .from('app_events')
    .delete()
    .lt('created_at', ninetyDaysAgo.toISOString())
    .select('id');

  return { purged: purged?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logger = createRequestLogger('ai-generate');

  try {
    const parsed = await parseJson(req, AiGenerateBodySchema, corsHeaders);
    if (!parsed.ok) {
      logger.warn('validation_failed', { issue_count: parsed.issues.length });
      return parsed.response;
    }
    const body: AiGenerateBody = parsed.data;
    const op = body.op;

    let result: any;
    // Rate-limit headers from the user-facing path, forwarded onto the final
    // success response so clients can render a usage meter without a second
    // round-trip. Cron ops leave this empty.
    let rateHeaders: Record<string, string> = {};

    switch (op) {
      // User-facing ops — require JWT, verify userId matches caller.
      // Each wraps its handler in enforceQuotaAndRun, which enforces the
      // per-hour rate limit (60/hr free, 600/hr pro) AND the daily token
      // quota, and increments usage on success.
      case 'intent': {
        const user = await authenticateUser(req, body.userId);
        const userLogger = logger.child({ user_id: user.id, op });
        const outcome = await enforceQuotaAndRun(user.id, userLogger, corsHeaders, () => handleIntent(body, userLogger));
        if ('response' in outcome) return outcome.response;
        result = outcome.result;
        rateHeaders = outcome.headers;
        break;
      }
      case 'reply_draft': {
        const user = await authenticateUser(req, body.userId);
        const userLogger = logger.child({ user_id: user.id, op });
        const outcome = await enforceQuotaAndRun(user.id, userLogger, corsHeaders, () => handleReplyDraft(body, userLogger));
        if ('response' in outcome) return outcome.response;
        result = outcome.result;
        rateHeaders = outcome.headers;
        break;
      }
      case 'replay': {
        const user = await authenticateUser(req, body.userId);
        const userLogger = logger.child({ user_id: user.id, op });
        const outcome = await enforceQuotaAndRun(user.id, userLogger, corsHeaders, () => handleReplay(body, userLogger));
        if ('response' in outcome) return outcome.response;
        result = outcome.result;
        rateHeaders = outcome.headers;
        break;
      }
      case 'weekly_insight': {
        const user = await authenticateUser(req, body.userId);
        const userLogger = logger.child({ user_id: user.id, op });
        const outcome = await enforceQuotaAndRun(user.id, userLogger, corsHeaders, () => handleWeeklyInsight(body, userLogger));
        if ('response' in outcome) return outcome.response;
        result = outcome.result;
        rateHeaders = outcome.headers;
        break;
      }
      case 'decision_proposal': {
        const user = await authenticateUser(req, body.userId);
        const userLogger = logger.child({ user_id: user.id, op });
        const outcome = await enforceQuotaAndRun(user.id, userLogger, corsHeaders, () => handleDecisionProposal(body));
        if ('response' in outcome) return outcome.response;
        result = outcome.result;
        rateHeaders = outcome.headers;
        break;
      }

      // Cron ops — require service_role key (called from pg_cron via pg_net)
      case 'cron_suggestions':
        requireServiceRole(req);
        result = await handleCronSuggestions(logger.child({ op }));
        break;
      case 'cron_presence':
        requireServiceRole(req);
        result = await handleCronPresence(logger.child({ op }));
        break;
      case 'cron_replay':
        requireServiceRole(req);
        result = await handleCronReplay(logger.child({ op }));
        break;
      case 'cron_weekly_insight':
        requireServiceRole(req);
        result = await handleCronWeeklyInsight(logger.child({ op }));
        break;
      case 'cron_cleanup':
        requireServiceRole(req);
        result = await handleCronCleanup();
        break;
      case 'cron_retention':
        requireServiceRole(req);
        result = await handleCronRetention();
        break;
      case 'cron_worker':
        requireServiceRole(req);
        result = await handleCronWorker(logger.child({ op }));
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown op: ${op}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...rateHeaders,
        },
      },
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
