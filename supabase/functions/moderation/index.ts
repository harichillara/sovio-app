// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  SUPABASE_SERVICE_ROLE_KEY,
);

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

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

async function authenticateRequest(req: Request) {
  const token = getBearerToken(req);

  // Accept the service_role key for internal calls
  if (token === SUPABASE_SERVICE_ROLE_KEY) return;

  // Validate user JWTs — Supabase gateway does NOT reject invalid JWTs on
  // Edge Functions by default, so we must verify explicitly.
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new HttpError(401, 'Invalid JWT');
}

/**
 * Simple content moderation using Gemini.
 * Returns risk labels and whether the content should be blocked.
 */
async function moderateContent(text: string): Promise<{
  safe: boolean;
  labels: string[];
  reasoning: string;
}> {
  if (!GEMINI_API_KEY || !text.trim()) {
    return { safe: true, labels: [], reasoning: 'No content to moderate' };
  }

  const prompt = `You are a content moderator for a social planning app. Evaluate this content for safety.

Content: "${text}"

Return a JSON object with:
- safe (boolean): true if the content is acceptable
- labels (string array): any applicable risk labels from: ["spam", "harassment", "violence", "sexual", "self_harm", "hate_speech", "impersonation"]
- reasoning (string): brief explanation

Return ONLY valid JSON.`;

  try {
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      },
    );

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Fail closed — block content if moderation is unavailable to prevent unsafe content slipping through
    return { safe: false, labels: ['moderation_unavailable'], reasoning: 'Moderation unavailable — content blocked as a precaution' };
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await authenticateRequest(req);

    const { content, userId, contentType, contentId } = await req.json();

    const result = await moderateContent(content ?? '');

    // Log to audit_log
    await supabase.from('audit_log').insert({
      user_id: userId ?? null,
      actor_type: 'system',
      action: 'content_moderated',
      target: {
        content_type: contentType ?? 'unknown',
        content_id: contentId ?? null,
        safe: result.safe,
        labels: result.labels,
      },
    });

    // If unsafe, auto-flag
    if (!result.safe) {
      await supabase.from('app_events').insert({
        user_id: userId ?? null,
        event_type: 'content_flagged',
        payload: {
          content_type: contentType,
          content_id: contentId,
          labels: result.labels,
          reasoning: result.reasoning,
        },
        source: 'moderation',
      });
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('moderation error:', err);
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
