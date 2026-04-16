// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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

async function handleIntent(body: any) {
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

  const interestList = (interests ?? []).map((i: any) => i.interest).join(', ');

  const prompt = `You are Sovio, a social planning AI. Generate 1-3 personalized activity suggestions for this user.

User: ${profile?.display_name ?? 'Unknown'}
Bio: ${profile?.bio ?? 'Not set'}
Interests: ${interestList || 'Not specified'}
Tier: ${profile?.subscription_tier ?? 'free'}

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

async function handleReplyDraft(body: any) {
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

  const conversation = (messages ?? [])
    .reverse()
    .map((m: any) => `${m.sender_id === userId ? 'You' : 'Them'}: ${m.content}`)
    .join('\n');

  const prompt = `You are Sovio AI, a friendly social assistant. Draft a natural, warm reply to this conversation. Keep it short (1-2 sentences), match the tone, and don't be overly formal.

Conversation:
${conversation}

Draft reply:`;

  const draft = await callGemini(prompt);
  return { draft: draft.trim() };
}

async function handleReplay(body: any) {
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

  const prompt = `You are Sovio AI. The user missed these opportunities yesterday. For each, write a short (1 sentence) reason why they might want to reconsider today.

Missed:
${dismissed.map((d: any) => `- ${d.title}: ${d.summary}`).join('\n')}

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
    console.error('[handleReplay] Failed to persist missed_moments:', insertErr.message);
  }

  return { items };
}

async function handleWeeklyInsight(body: any) {
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

  const prompt = `You are Sovio AI, a weekly coach. Based on this user's activity this week, provide a brief, warm insight (3-4 sentences) and suggest one small experiment they could try next week.

Activity this week:
${Object.entries(counts).map(([k, v]) => `${k}: ${v} times`).join('\n') || 'Very little activity'}

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
    console.error('[handleWeeklyInsight] Failed to persist insight:', upsertErr.message);
  }

  return {
    ...result,
    week_of: weekOf,
  };
}

async function handleDecisionProposal(body: any) {
  const { userId, constraints } = body;
  if (!userId) throw new Error('userId required');

  const prompt = `You are Sovio Decision Autopilot. Based on the user's constraints, propose a plan.

Constraints:
- Budget: ${constraints?.budget ?? 'Any'}
- Max travel: ${constraints?.maxTravel ?? 'Any'} minutes
- Preferred times: ${(constraints?.preferredTimes ?? []).join(', ') || 'Any'}
- Group size: ${(constraints?.groupSize ?? []).join(', ') || 'Any'}

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
  const { error } = await supabase.from('ai_jobs').insert({
    user_id: userId,
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

async function handleCronSuggestions() {
  // Get all active users (with activity in last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: activeUsers } = await supabase
    .from('app_events')
    .select('user_id')
    .gte('created_at', weekAgo.toISOString());

  const uniqueUserIds = [...new Set((activeUsers ?? []).map((e: any) => e.user_id))];

  let generated = 0;
  for (const userId of uniqueUserIds) {
    try {
      // Check if user already has fresh suggestions
      const { data: existing } = await supabase
        .from('suggestions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'new')
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;
      const refreshResponse = await fetch(`${SUPABASE_URL}/functions/v1/intent-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          userId,
          includePredictHQ: true,
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error(`intent-refresh failed with ${refreshResponse.status}`);
      }

      // Send push notification for new suggestions
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
        console.error(`Failed to send suggestion push for ${userId}:`, pushErr);
      }

      generated++;
    } catch (err) {
      console.error(`Failed to generate suggestions for ${userId}:`, err);
    }
  }

  return { generated, totalUsers: uniqueUserIds.length };
}

async function handleCronPresence() {
  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;

  // Get all users with events today
  const { data: todayUsers } = await supabase
    .from('app_events')
    .select('user_id')
    .gte('created_at', startOfDay);

  const uniqueUserIds = [...new Set((todayUsers ?? []).map((e: any) => e.user_id))];

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

  let computed = 0;
  for (const userId of uniqueUserIds) {
    try {
      const { data: events } = await supabase
        .from('app_events')
        .select('event_type')
        .eq('user_id', userId)
        .gte('created_at', startOfDay);

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

      await supabase.from('presence_daily').upsert(
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

      computed++;
    } catch (err) {
      console.error(`Failed to compute presence for ${userId}:`, err);
    }
  }

  return { computed, totalUsers: uniqueUserIds.length };
}

async function handleCronReplay() {
  // Get users who had dismissed/expired suggestions yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const { data: usersWithMissed } = await supabase
    .from('suggestions')
    .select('user_id')
    .in('status', ['dismissed', 'expired'])
    .gte('created_at', `${yesterdayStr}T00:00:00Z`)
    .lt('created_at', `${yesterdayStr}T23:59:59Z`);

  const uniqueUserIds = [...new Set((usersWithMissed ?? []).map((e: any) => e.user_id))];

  let generated = 0;
  for (const userId of uniqueUserIds) {
    try {
      const replayResult = await handleReplay({ userId });

      generated++;
    } catch (err) {
      console.error(`Failed to generate replay for ${userId}:`, err);
    }
  }

  return { generated, totalUsers: uniqueUserIds.length };
}

async function handleCronWeeklyInsight() {
  // Get all users with any activity in last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: activeUsers } = await supabase
    .from('app_events')
    .select('user_id')
    .gte('created_at', weekAgo.toISOString());

  const uniqueUserIds = [...new Set((activeUsers ?? []).map((e: any) => e.user_id))];

  let generated = 0;
  for (const userId of uniqueUserIds) {
    try {
      const insightResult = await handleWeeklyInsight({ userId });

      generated++;
    } catch (err) {
      console.error(`Failed to generate insight for ${userId}:`, err);
    }
  }

  return { generated, totalUsers: uniqueUserIds.length };
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

  try {
    const body = await req.json();
    const op = body.op;

    let result: any;

    switch (op) {
      // User-facing ops — require JWT, verify userId matches caller
      case 'intent':
        await authenticateUser(req, body.userId);
        result = await handleIntent(body);
        break;
      case 'reply_draft':
        await authenticateUser(req, body.userId);
        result = await handleReplyDraft(body);
        break;
      case 'replay':
        await authenticateUser(req, body.userId);
        result = await handleReplay(body);
        break;
      case 'weekly_insight':
        await authenticateUser(req, body.userId);
        result = await handleWeeklyInsight(body);
        break;
      case 'decision_proposal':
        await authenticateUser(req, body.userId);
        result = await handleDecisionProposal(body);
        break;

      // Cron ops — require service_role key (called from pg_cron via pg_net)
      case 'cron_suggestions':
        requireServiceRole(req);
        result = await handleCronSuggestions();
        break;
      case 'cron_presence':
        requireServiceRole(req);
        result = await handleCronPresence();
        break;
      case 'cron_replay':
        requireServiceRole(req);
        result = await handleCronReplay();
        break;
      case 'cron_weekly_insight':
        requireServiceRole(req);
        result = await handleCronWeeklyInsight();
        break;
      case 'cron_cleanup':
        requireServiceRole(req);
        result = await handleCronCleanup();
        break;
      case 'cron_retention':
        requireServiceRole(req);
        result = await handleCronRetention();
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown op: ${op}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('ai-generate error:', err);
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
