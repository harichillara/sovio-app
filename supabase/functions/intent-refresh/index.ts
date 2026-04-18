// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as Sentry from 'https://deno.land/x/sentry@7.120.3/index.mjs';
import { createRequestLogger, Logger } from '../_shared/logger.ts';
import { parseJson, z } from '../_shared/validate.ts';
import { sanitizeUserInput, wrapUntrusted, INJECTION_DEFENSE_HEADER } from '../_shared/prompt-safety.ts';
import { scrubSentryEvent } from '../_shared/sentry-scrubber.ts';

// Body schema: { userId, includePredictHQ?, coords? }. Cross-checked against
// refreshIntent(): userId is required, includePredictHQ defaults to true at the
// handler level (any boolean accepted), coords are optional lat/lng pair.
const IntentRefreshSchema = z.object({
  userId: z.string().uuid(),
  includePredictHQ: z.boolean().optional(),
  coords: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

const SENTRY_DSN = Deno.env.get('SENTRY_DSN') ?? '';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
    // Scrub PII + secrets. Intent-refresh handles user coords + PredictHQ API
    // key — neither should hit Sentry if an error path echoes them.
    beforeSend: (event: unknown) => scrubSentryEvent(event),
  });
  Sentry.setTag('fn', 'intent-refresh');
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';
const PREDICTHQ_API_TOKEN = Deno.env.get('PREDICTHQ_API_TOKEN') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type CandidateSource = 'google_place' | 'predicthq_event' | 'social';
type CandidateKind = 'place' | 'event' | 'moment';

interface IntentCandidate {
  source: CandidateSource;
  kind: CandidateKind;
  external_id?: string | null;
  title: string;
  summary: string;
  lat?: number | null;
  lng?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  distance_meters?: number | null;
  social_fit_score: number;
  novelty_score: number;
  friction_score: number;
  timing_score: number;
  source_confidence: number;
  rank_score: number;
  payload?: Record<string, unknown> | null;
}

interface NearbyFriend {
  friend_id: string;
  display_name: string | null;
  avatar_url: string | null;
  lat: number | null;
  lng: number | null;
  distance_meters: number;
  category: string | null;
  available_until: string;
  confidence_label: string;
}

const DEFAULT_RADIUS_METERS = 3000;

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return '';
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 900 },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function toLocalityBucket(lat: number, lng: number): string {
  const latBucket = Math.round(lat * 20) / 20;
  const lngBucket = Math.round(lng * 20) / 20;
  return `${latBucket.toFixed(2)}:${lngBucket.toFixed(2)}`;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function summarizeTimeUntil(iso?: string | null): string {
  if (!iso) return 'soon';
  const deltaMinutes = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  if (deltaMinutes < 60) return `in ${deltaMinutes} min`;
  const hours = Math.round(deltaMinutes / 60);
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}

function mapInterestToGoogleTypes(interests: string[]): string[] {
  const joined = interests.join(' ').toLowerCase();
  const types = new Set<string>();

  if (/(coffee|cafe|matcha|tea)/.test(joined)) types.add('cafe');
  if (/(food|brunch|dinner|lunch|restaurant)/.test(joined)) types.add('restaurant');
  if (/(drink|bar|cocktail|nightlife|beer)/.test(joined)) types.add('bar');
  if (/(walk|run|park|outdoor|hike)/.test(joined)) types.add('park');
  if (/(museum|gallery|art)/.test(joined)) types.add('museum');
  if (/(movie|cinema|film)/.test(joined)) types.add('movie_theater');
  if (/(bowling|arcade|games)/.test(joined)) types.add('bowling_alley');

  if (types.size === 0) {
    ['restaurant', 'cafe', 'bar', 'park'].forEach((type) => types.add(type));
  }

  return [...types].slice(0, 6);
}

async function fetchGooglePlaces(
  lat: number,
  lng: number,
  interests: string[],
  radiusMeters: number,
  logger: Logger,
): Promise<IntentCandidate[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];

  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.rating,places.userRatingCount',
      },
      body: JSON.stringify({
        includedTypes: mapInterestToGoogleTypes(interests),
        maxResultCount: 6,
        rankPreference: 'POPULARITY',
        languageCode: 'en',
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusMeters,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    logger.error('google_places_failed', { status: response.status, body: await response.text() });
    return [];
  }

  const data = await response.json();
  const places = data.places ?? [];

  return places.map((place: any) => {
    const distanceMeters = place.location
      ? haversineDistance(lat, lng, place.location.latitude, place.location.longitude)
      : null;
    const friction = distanceMeters ? clamp(distanceMeters / radiusMeters) : 0.5;
    const rating = typeof place.rating === 'number' ? place.rating / 5 : 0.7;
    const socialFit = clamp(0.45 + rating * 0.35);
    const novelty = clamp(place.userRatingCount ? 0.65 : 0.45);
    const timing = 0.72;
    const confidence = clamp(0.55 + rating * 0.3);

    return {
      source: 'google_place',
      kind: 'place',
      external_id: place.id,
      title: place.displayName?.text ?? 'Nearby spot',
      summary: place.formattedAddress ?? 'Good low-friction option nearby.',
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      distance_meters: distanceMeters,
      social_fit_score: socialFit,
      novelty_score: novelty,
      friction_score: friction,
      timing_score: timing,
      source_confidence: confidence,
      rank_score: rankCandidate({ socialFit, novelty, friction, timing, confidence }),
      payload: {
        primaryType: place.primaryType ?? null,
        rating: place.rating ?? null,
        userRatingCount: place.userRatingCount ?? null,
        address: place.formattedAddress ?? null,
      },
    } satisfies IntentCandidate;
  });
}

async function fetchPredictHqSuggestedRadius(lat: number, lng: number, logger: Logger): Promise<number | null> {
  if (!PREDICTHQ_API_TOKEN) return null;

  const url = new URL('https://api.predicthq.com/v1/suggested-radius/');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PREDICTHQ_API_TOKEN}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    logger.error('predicthq_suggested_radius_failed', { status: response.status, body: await response.text() });
    return null;
  }

  const data = await response.json();
  const meters = data?.suggested_radius?.meters;
  return typeof meters === 'number' ? meters : null;
}

async function fetchPredictHqEvents(
  lat: number,
  lng: number,
  includePredictHQ: boolean,
  logger: Logger,
): Promise<IntentCandidate[]> {
  if (!includePredictHQ || !PREDICTHQ_API_TOKEN) return [];

  const suggestedRadiusMeters = await fetchPredictHqSuggestedRadius(lat, lng, logger);
  const withinKm = Math.max(2, Math.round((suggestedRadiusMeters ?? 10000) / 1000));
  const startAfter = new Date().toISOString();

  const url = new URL('https://api.predicthq.com/v1/events/');
  url.searchParams.set('within', `${withinKm}km@${lat},${lng}`);
  url.searchParams.set('limit', '6');
  url.searchParams.set('sort', '-local_rank,start');
  url.searchParams.set('local_rank.gte', '20');
  url.searchParams.set('category', 'concerts,festivals,performing-arts,community,sports');
  url.searchParams.set('start.gte', startAfter);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PREDICTHQ_API_TOKEN}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    logger.error('predicthq_search_failed', { status: response.status, body: await response.text() });
    return [];
  }

  const data = await response.json();
  const events = data.results ?? [];

  return events.map((event: any) => {
    const eventLat = event.location?.[1] ?? null;
    const eventLng = event.location?.[0] ?? null;
    const distanceMeters =
      eventLat !== null && eventLng !== null
        ? haversineDistance(lat, lng, eventLat, eventLng)
        : null;
    const localRank = typeof event.local_rank === 'number' ? event.local_rank / 100 : 0.45;
    const timing = clamp(
      1 - Math.min(Math.abs(new Date(event.start).getTime() - Date.now()) / (1000 * 60 * 60 * 12), 1),
    );
    const friction = distanceMeters ? clamp(distanceMeters / Math.max(suggestedRadiusMeters ?? 10000, 3000)) : 0.5;
    const novelty = clamp(0.7 + (event.phq_rank ? Math.min(event.phq_rank / 200, 0.2) : 0));
    const confidence = clamp(0.5 + localRank * 0.4);

    return {
      source: 'predicthq_event',
      kind: 'event',
      external_id: event.id,
      title: event.title ?? 'Nearby event',
      summary: `${event.category ?? 'event'} ${summarizeTimeUntil(event.start)}`,
      lat: eventLat,
      lng: eventLng,
      starts_at: event.start ?? null,
      ends_at: event.end ?? null,
      distance_meters: distanceMeters,
      social_fit_score: clamp(0.4 + localRank * 0.45),
      novelty_score: novelty,
      friction_score: friction,
      timing_score: timing,
      source_confidence: confidence,
      rank_score: rankCandidate({
        socialFit: clamp(0.4 + localRank * 0.45),
        novelty,
        friction,
        timing,
        confidence,
      }),
      payload: {
        category: event.category ?? null,
        labels: event.labels ?? [],
        local_rank: event.local_rank ?? null,
        phq_rank: event.rank ?? null,
      },
    } satisfies IntentCandidate;
  });
}

function buildSocialCandidates(friends: NearbyFriend[]): IntentCandidate[] {
  if (friends.length === 0) return [];

  const topFriends = friends.slice(0, 3);
  const names = topFriends
    .map((friend) => friend.display_name)
    .filter(Boolean)
    .join(', ');
  const nearestDistance = Math.min(...topFriends.map((friend) => friend.distance_meters));
  const summary =
    names.length > 0
      ? `${topFriends.length} friend${topFriends.length === 1 ? '' : 's'} nearby open to plans: ${names}.`
      : `${topFriends.length} friend${topFriends.length === 1 ? '' : 's'} nearby open to plans.`;

  return [
    {
      source: 'social',
      kind: 'moment',
      title: `${topFriends.length} friend${topFriends.length === 1 ? '' : 's'} nearby are open to plans`,
      summary,
      distance_meters: nearestDistance,
      social_fit_score: clamp(0.7 + topFriends.length * 0.08),
      novelty_score: 0.58,
      friction_score: clamp(nearestDistance / 3000),
      timing_score: 0.92,
      source_confidence: 0.9,
      rank_score: rankCandidate({
        socialFit: clamp(0.7 + topFriends.length * 0.08),
        novelty: 0.58,
        friction: clamp(nearestDistance / 3000),
        timing: 0.92,
        confidence: 0.9,
      }),
      payload: {
        friends: topFriends,
      },
    },
  ];
}

function rankCandidate(input: {
  socialFit: number;
  novelty: number;
  friction: number;
  timing: number;
  confidence: number;
}) {
  return clamp(
    input.socialFit * 0.34 +
      input.timing * 0.24 +
      input.confidence * 0.18 +
      input.novelty * 0.14 +
      (1 - input.friction) * 0.1,
  );
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLng = toRad(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}

async function getUserContext(userId: string) {
  const [{ data: profile, error: profileError }, { data: interests, error: interestError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, bio, subscription_tier')
        .eq('id', userId)
        .single(),
      supabase
        .from('user_interests')
        .select('interest')
        .eq('user_id', userId),
    ]);

  if (profileError) throw profileError;
  if (interestError) throw interestError;

  return {
    profile,
    interests: (interests ?? []).map((row: any) => row.interest as string),
  };
}

async function getCoords(userId: string, bodyCoords?: { lat: number; lng: number }) {
  if (bodyCoords) {
    return bodyCoords;
  }

  const { data, error } = await supabase
    .from('location_snapshots')
    .select('lat, lng')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return { lat: data.lat, lng: data.lng };
}

async function getNearbyFriends(
  userId: string,
  lat: number,
  lng: number,
  logger: Logger,
): Promise<NearbyFriend[]> {
  const { data, error } = await supabase.rpc('get_nearby_available_friends', {
    viewer_id: userId,
    center_lat: lat,
    center_lng: lng,
    radius_meters: DEFAULT_RADIUS_METERS,
  });

  if (error) {
    logger.warn('get_nearby_available_friends_degraded', { err: error.message });
    return [];
  }
  return (data ?? []) as NearbyFriend[];
}

async function insertSuggestionsWithFallback(rows: any[]) {
  if (rows.length === 0) return rows;

  const fullInsert = await supabase.from('suggestions').insert(rows).select('*');
  if (!fullInsert.error) {
    return fullInsert.data ?? rows;
  }

  const fallbackRows = rows.map((row) => ({
    user_id: row.user_id,
    title: row.title,
    summary: row.summary,
    type: row.type,
    status: row.status,
    expires_at: row.expires_at,
  }));

  const retryInsert = await supabase
    .from('suggestions')
    .insert(fallbackRows)
    .select('*');

  if (retryInsert.error) {
    throw fullInsert.error;
  }

  return (retryInsert.data ?? fallbackRows).map((row: any, index) => ({
    ...rows[index],
    ...row,
    confidence: rows[index].confidence,
    source_label: rows[index].source_label ?? null,
    why_now: rows[index].why_now ?? null,
    candidate_id: rows[index].candidate_id ?? null,
    payload: rows[index].payload ?? null,
  }));
}

function buildFallbackSuggestions(
  candidates: IntentCandidate[],
  nearbyFriends: NearbyFriend[],
): Array<{ title: string; summary: string; type: 'plan' | 'place' | 'group'; why_now: string | null; candidate_title: string | null }> {
  return candidates.slice(0, 3).map((candidate) => {
    if (candidate.source === 'social') {
      return {
        title: candidate.title,
        summary:
          nearbyFriends.length > 0
            ? `${nearbyFriends.length} friend${nearbyFriends.length === 1 ? '' : 's'} nearby are open to plans right now.`
            : candidate.summary,
        type: 'group',
        why_now: 'Your circle is active nearby and available now.',
        candidate_title: candidate.title,
      };
    }

    if (candidate.source === 'predicthq_event') {
      return {
        title: candidate.title,
        summary: `${candidate.summary}. Sovio thinks this is the highest-energy option nearby.`,
        type: 'plan',
        why_now: candidate.starts_at ? `It starts ${summarizeTimeUntil(candidate.starts_at)}.` : 'It is happening nearby soon.',
        candidate_title: candidate.title,
      };
    }

    return {
      title: candidate.title,
      summary: `${candidate.summary}. Low-friction and easy to say yes to.`,
      type: 'place',
      why_now:
        candidate.distance_meters !== null
          ? `${Math.max(1, Math.round(candidate.distance_meters / 1609))} mi away and fits your usual pattern.`
          : 'It fits your usual pattern for a low-effort plan.',
      candidate_title: candidate.title,
    };
  });
}

async function composeSuggestions(
  profile: any,
  candidates: IntentCandidate[],
  nearbyFriends: NearbyFriend[],
  logger: Logger,
): Promise<Array<{ title: string; summary: string; type: 'plan' | 'place' | 'group'; why_now: string | null; candidate_title: string | null }>> {
  if (!GEMINI_API_KEY || candidates.length === 0) {
    return buildFallbackSuggestions(candidates, nearbyFriends);
  }

  // Sanitize + wrap every user-authored value before it reaches the model.
  // display_name and candidate title/summary are stored in the DB and may
  // contain adversarial content (prompt-injection, role spoofing).
  const nameRes = sanitizeUserInput(profile?.display_name ?? 'Unknown');
  const candidateSlice = candidates.slice(0, 5).map((c) => ({
    title: sanitizeUserInput(c.title ?? '').clean,
    summary: sanitizeUserInput(c.summary ?? '').clean,
    source: c.source,
    distance_meters: c.distance_meters,
    starts_at: c.starts_at,
  }));

  const prompt = `${INJECTION_DEFENSE_HEADER}

You are Sovio, an anticipatory social operating system.
Turn the following ranked candidates into 1-3 concise suggestions.

Rules:
- Be warm, sharp, youthful, and premium.
- Never claim you know friends are free unless the signal says they are open to plans.
- Prefer wording like "open to plans" or "active nearby".
- Make each summary 1 sentence.
- Output valid JSON only.

User:
- name: ${wrapUntrusted('display_name', nameRes.clean)}

Candidates:
${wrapUntrusted('candidates_json', JSON.stringify(candidateSlice, null, 2))}

Return a JSON array with objects:
title, summary, type ("plan" | "place" | "group"), why_now.`;

  try {
    const raw = await callGemini(prompt);
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3).map((item, index) => ({
        title: item.title ?? candidates[index]?.title ?? 'Suggestion',
        summary: item.summary ?? candidates[index]?.summary ?? 'A relevant move nearby.',
        type: item.type ?? (candidates[index]?.source === 'social' ? 'group' : 'plan'),
        why_now: item.why_now ?? null,
        candidate_title: candidates[index]?.title ?? null,
      }));
    }
  } catch (error) {
    logger.error('gemini_compose_failed', { err: error });
  }

  return buildFallbackSuggestions(candidates, nearbyFriends);
}

async function refreshIntent(body: any, logger: Logger) {
  const userId = body.userId;
  const includePredictHQ = body.includePredictHQ !== false;

  if (!userId) throw new Error('userId required');

  const userLogger = logger.child({ user_id: userId });

  const { profile, interests } = await getUserContext(userId);
  const coords = await getCoords(userId, body.coords);

  if (!coords) {
    return { suggestions: [] };
  }

  const [nearbyFriends, places, events] = await Promise.all([
    getNearbyFriends(userId, coords.lat, coords.lng, userLogger),
    fetchGooglePlaces(coords.lat, coords.lng, interests, DEFAULT_RADIUS_METERS, userLogger),
    fetchPredictHqEvents(coords.lat, coords.lng, includePredictHQ, userLogger),
  ]);

  const candidates = [
    ...buildSocialCandidates(nearbyFriends),
    ...places,
    ...events,
  ]
    .sort((a, b) => b.rank_score - a.rank_score)
    .slice(0, 8);

  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  await supabase
    .from('suggestions')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'new');

  await supabase
    .from('intent_candidates')
    .delete()
    .eq('user_id', userId);

  const { data: insertedCandidates, error: candidateError } = await supabase
    .from('intent_candidates')
    .insert(
      candidates.map((candidate) => ({
        user_id: userId,
        source: candidate.source,
        kind: candidate.kind,
        external_id: candidate.external_id ?? null,
        title: candidate.title,
        summary: candidate.summary,
        lat: candidate.lat ?? null,
        lng: candidate.lng ?? null,
        starts_at: candidate.starts_at ?? null,
        ends_at: candidate.ends_at ?? null,
        distance_meters: candidate.distance_meters ?? null,
        social_fit_score: candidate.social_fit_score,
        novelty_score: candidate.novelty_score,
        friction_score: candidate.friction_score,
        timing_score: candidate.timing_score,
        source_confidence: candidate.source_confidence,
        rank_score: candidate.rank_score,
        payload: candidate.payload ?? null,
        expires_at: expiresAt,
      })),
    )
    .select('*');

  if (candidateError) throw candidateError;

  const composed = await composeSuggestions(profile, candidates, nearbyFriends, userLogger);

  const rows = composed.map((item, index) => {
    const candidate = insertedCandidates?.[index];
    return {
      user_id: userId,
      title: item.title,
      summary: item.summary,
      type: item.type,
      status: 'new',
      confidence: candidates[index]?.rank_score ?? 0.6,
      source_label: candidates[index]?.source ?? null,
      why_now: item.why_now,
      candidate_id: candidate?.id ?? null,
      payload: {
        coords,
        nearby_friend_count: nearbyFriends.length,
        locality_bucket: toLocalityBucket(coords.lat, coords.lng),
      },
      expires_at: expiresAt,
    };
  });

  const insertedSuggestions = await insertSuggestionsWithFallback(rows);

  return { suggestions: insertedSuggestions, candidates: insertedCandidates ?? [] };
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader) {
    throw new HttpError(401, 'Missing authorization header');
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, "Authorization header must be 'Bearer <token>'");
  }

  return token;
}

async function authenticateRequest(req: Request, requestedUserId?: string | null) {
  const token = getBearerToken(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new HttpError(401, 'Invalid JWT');
  }

  if (requestedUserId && requestedUserId !== user.id) {
    throw new HttpError(403, 'Cannot refresh intent for another user');
  }

  return user;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logger = createRequestLogger('intent-refresh');

  try {
    const parsed = await parseJson(req, IntentRefreshSchema, corsHeaders);
    if (!parsed.ok) {
      logger.warn('validation_failed', { issue_count: parsed.issues.length });
      return parsed.response;
    }
    const body = parsed.data;
    await authenticateRequest(req, body.userId);
    const result = await refreshIntent(body, logger);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    logger.error('unhandled_error', { err: error });
    if (SENTRY_DSN) Sentry.captureException(error);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Internal error' }),
      {
        status: error?.status ?? 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
