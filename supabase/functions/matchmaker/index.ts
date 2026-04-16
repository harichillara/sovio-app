// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  SUPABASE_SERVICE_ROLE_KEY,
);

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

async function authenticateUser(req: Request, requestedUserId: string) {
  const token = getBearerToken(req);

  // Allow service_role calls (from other edge functions like ai-generate cron)
  if (token === SUPABASE_SERVICE_ROLE_KEY) return;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new HttpError(401, 'Invalid JWT');
  if (requestedUserId !== user.id) {
    throw new HttpError(403, 'Cannot matchmake for another user');
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
    const { userId, bucket, category, lat, lng } = await req.json();
    if (!userId || (!bucket && (lat == null || lng == null))) {
      return new Response(
        JSON.stringify({ error: 'userId plus bucket or coords required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await authenticateUser(req, userId);

    const now = new Date().toISOString();
    let available: any[] = [];

    if (lat != null && lng != null) {
      const { data, error } = await supabase.rpc('get_nearby_available_friends', {
        viewer_id: userId,
        center_lat: lat,
        center_lng: lng,
        radius_meters: 3000,
      });

      if (error) throw error;
      available = (data ?? []).map((row: any) => ({
        user_id: row.friend_id,
        category: row.category,
        bucket: bucket ?? 'geo',
        confidence_label: row.confidence_label,
        distance_meters: row.distance_meters,
      }));
    } else {
      let query = supabase
        .from('momentum_availability')
        .select('*')
        .eq('bucket', bucket)
        .gt('available_until', now)
        .neq('user_id', userId)
        .limit(5);

      if (category) {
        query = query.eq('category', category);
      }

      const result = await query;
      if (result.error) throw result.error;
      available = result.data ?? [];
    }

    if (!available || available.length === 0) {
      return new Response(
        JSON.stringify({ matched: false, message: 'No one available right now. Check back soon!' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Pick the first match and create a thread + plan
    const match = available[0];
    const participantIds = [userId, match.user_id];
    const bucketLabel = bucket ?? 'geo';

    // Create a plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        title: `${category ?? 'Hangout'} — matched by Momentum`,
        description: `Auto-matched${match.distance_meters ? ` within ${Math.round(match.distance_meters)}m` : ''} in ${bucketLabel}`,
        creator_id: userId,
        status: 'active',
      })
      .select()
      .single();

    if (planError) throw planError;

    // Add participants to plan
    await supabase.from('plan_participants').insert(
      participantIds.map((uid: string) => ({
        plan_id: plan.id,
        user_id: uid,
        status: 'confirmed',
      })),
    );

    // Create a thread for the group
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .insert({
        title: plan.title,
        plan_id: plan.id,
      })
      .select()
      .single();

    if (threadError) throw threadError;

    // Add thread participants
    await supabase.from('thread_participants').insert(
      participantIds.map((uid: string) => ({
        thread_id: thread.id,
        user_id: uid,
      })),
    );

    // Send system message
    await supabase.from('messages').insert({
      thread_id: thread.id,
      sender_id: userId,
      content: `Momentum matched you! Someone nearby is open to plans${category ? ` for ${category}` : ''}. Let's make it happen.`,
      is_ai_draft: true,
    });

    // Track events for both users
    for (const uid of participantIds) {
      await supabase.from('app_events').insert({
        user_id: uid,
        event_type: 'match_created',
        payload: {
          plan_id: plan.id,
          thread_id: thread.id,
          bucket: bucketLabel,
          distance_meters: match.distance_meters ?? null,
          confidence_label: match.confidence_label ?? null,
        },
        source: 'matchmaker',
      });
    }

    // Send push notification to the matched user (not the initiator)
    try {
      await supabase.rpc('notify_insert_and_push', {
        p_user_id: match.user_id,
        p_kind: 'match',
        p_title: "You've been matched!",
        p_body: `Someone nearby is open to plans${category ? ` for ${category}` : ''}. Let's make it happen.`,
        p_data: {
          route: '/(modals)/thread-detail',
          threadId: thread.id,
          planId: plan.id,
        },
      });
    } catch (pushErr) {
      console.error(`Failed to send match push to ${match.user_id}:`, pushErr);
    }

    return new Response(
      JSON.stringify({
        matched: true,
        plan_id: plan.id,
        thread_id: thread.id,
        participants: participantIds,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('matchmaker error:', err);
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
