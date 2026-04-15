import { supabase } from '../supabase/client';
import type { Database } from '../supabase/database.types';
import type { AvailabilityMode, ConfidenceLabel, MomentumSource } from '../supabase/app-types';

type MomentumUpdate = Database['public']['Tables']['momentum_availability']['Update'];
type MomentumInsert = Database['public']['Tables']['momentum_availability']['Insert'];

/**
 * Defensive fallback for non-standard row shapes that may surface from
 * raw queries or edge functions. Keeps the cast narrow rather than using `any`.
 */
type LegacyMomentumPayload = { bucket: string; expires_at: string };

let nearbyFriendsRpcSupported: boolean | null = null;
let momentumExtendedSchemaSupported: boolean | null = null;

async function checkMomentumExtendedSchemaSupport(): Promise<boolean> {
  if (momentumExtendedSchemaSupported !== null) {
    return momentumExtendedSchemaSupported;
  }

  const { error } = await supabase
    .from('momentum_availability')
    .select('available_until, category')
    .limit(1);

  momentumExtendedSchemaSupported = !error;
  return momentumExtendedSchemaSupported;
}

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface MomentumAvailability {
  id: string;
  user_id: string;
  bucket: string; // geo-hash or location bucket
  category: string | null; // e.g. "food", "drinks", "activity"
  available_until: string;
  lat: number | null;
  lng: number | null;
  availability_mode: AvailabilityMode;
  confidence_label: ConfidenceLabel;
  source: MomentumSource;
  created_at: string;
}

function normalizeAvailability(row: Record<string, unknown>): MomentumAvailability {
  return {
    id: String(row.id ?? `${String(row.user_id)}:${String(row.bucket ?? 'local')}`),
    user_id: String(row.user_id ?? ''),
    bucket: String(row.bucket ?? 'local'),
    category: (row.category as string | null) ?? null,
    available_until: String(row.available_until ?? row.expires_at ?? row.created_at ?? new Date().toISOString()),
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    availability_mode: (row.availability_mode as AvailabilityMode) ?? 'open_now',
    confidence_label: (row.confidence_label as ConfidenceLabel) ?? 'open_to_plans',
    source: (row.source as MomentumSource) ?? 'manual',
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export interface NearbyAvailableFriend {
  friend_id: string;
  display_name: string | null;
  avatar_url: string | null;
  lat: number | null;
  lng: number | null;
  distance_meters: number;
  category: string | null;
  available_until: string;
  confidence_label: ConfidenceLabel;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Set the current user as available in a location bucket.
 */
export async function setAvailable(
  userId: string,
  bucket: string,
  category: string | null,
  durationMins: number,
  options?: {
    lat?: number | null;
    lng?: number | null;
    availabilityMode?: AvailabilityMode;
    confidenceLabel?: ConfidenceLabel;
    source?: MomentumSource;
  },
): Promise<MomentumAvailability> {
  const availableUntil = new Date(
    Date.now() + durationMins * 60 * 1000,
  ).toISOString();
  const useExtendedSchema = await checkMomentumExtendedSchemaSupport();
  const updatePayload = {
    bucket,
    category,
    available_until: availableUntil,
    lat: options?.lat ?? null,
    lng: options?.lng ?? null,
    availability_mode: options?.availabilityMode ?? 'open_now',
    confidence_label: options?.confidenceLabel ?? 'open_to_plans',
    source: options?.source ?? 'manual',
  };
  const fallbackPayload = {
    bucket,
    available_until: availableUntil,
  };
  const primaryPayload = useExtendedSchema ? updatePayload : fallbackPayload;

  const { data: existing, error: fetchError } = await supabase
    .from('momentum_availability')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    const { error } = await supabase
      .from('momentum_availability')
      .update(primaryPayload as MomentumUpdate | LegacyMomentumPayload)
      .eq('id', existing.id);

    if (!error) {
      const refreshed = await getMyAvailability(userId);
      if (refreshed) {
        return refreshed;
      }
    } else {
      console.warn('[setAvailable] Primary update failed, trying fallback schema. Error:', error.message);
    }

    const { error: fallbackError } = await supabase
      .from('momentum_availability')
      .update(fallbackPayload)
      .eq('id', existing.id);

    if (fallbackError) throw fallbackError;

    const refreshed = await getMyAvailability(userId);
    if (refreshed) {
      return refreshed;
    }

    return normalizeAvailability({
      id: existing.id,
      user_id: userId,
      bucket,
      category,
      available_until: availableUntil,
      lat: options?.lat ?? null,
      lng: options?.lng ?? null,
      availability_mode: options?.availabilityMode ?? 'open_now',
      confidence_label: options?.confidenceLabel ?? 'open_to_plans',
      source: options?.source ?? 'manual',
      created_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from('momentum_availability')
    .insert({
      user_id: userId,
      ...(primaryPayload as MomentumInsert | LegacyMomentumPayload),
    } as MomentumInsert);

  if (!error) {
    const refreshed = await getMyAvailability(userId);
    if (refreshed) {
      return refreshed;
    }
  } else {
    console.warn('[setAvailable] Primary insert failed, trying fallback schema. Error:', error.message);
  }

  const { error: fallbackError } = await supabase
    .from('momentum_availability')
    .insert({
      user_id: userId,
      ...fallbackPayload,
    } as MomentumInsert);

  if (fallbackError) throw fallbackError;

  const refreshed = await getMyAvailability(userId);
  if (refreshed) {
    return refreshed;
  }

  return normalizeAvailability({
    user_id: userId,
    bucket,
    category,
    available_until: availableUntil,
    lat: options?.lat ?? null,
    lng: options?.lng ?? null,
    availability_mode: options?.availabilityMode ?? 'open_now',
    confidence_label: options?.confidenceLabel ?? 'open_to_plans',
    source: options?.source ?? 'manual',
    created_at: new Date().toISOString(),
  });
}

/**
 * Remove the user's current availability.
 */
export async function removeAvailability(userId: string): Promise<void> {
  const { error } = await supabase
    .from('momentum_availability')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Get all available users in a bucket (not expired).
 */
export async function getAvailableUsers(
  bucket: string,
): Promise<MomentumAvailability[]> {
  const now = Date.now();
  const { data, error } = await supabase
    .from('momentum_availability')
    .select('*')
    .eq('bucket', bucket)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAvailableUsers] DB query failed. Bucket:', bucket, 'Error:', error.message);
    throw error;
  }
  return (data ?? [])
    .map((row) => normalizeAvailability(row as Record<string, unknown>))
    .filter((row) => new Date(row.available_until).getTime() > now);
}

/**
 * Check if the user is currently available.
 */
export async function getMyAvailability(
  userId: string,
): Promise<MomentumAvailability | null> {
  const { data, error } = await supabase
    .from('momentum_availability')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getMyAvailability] DB query failed. UserId:', userId, 'Error:', error.message);
    throw error;
  }
  if (!data) return null;

  const normalized = normalizeAvailability(data as Record<string, unknown>);
  if (new Date(normalized.available_until).getTime() <= Date.now()) {
    return null;
  }

  return normalized;
}

export async function getNearbyAvailableFriends(
  userId: string,
  centerLat: number,
  centerLng: number,
  radiusMeters = 2500,
): Promise<NearbyAvailableFriend[]> {
  if (nearbyFriendsRpcSupported === false) {
    return [];
  }

  if (nearbyFriendsRpcSupported === null) {
    const { error: shapeError } = await supabase
      .from('momentum_availability')
      .select('available_until, category')
      .limit(1);

    if (shapeError) {
      // Only permanently disable for schema errors (relation/column not found),
      // not for transient failures like network timeouts
      const isSchemaError = shapeError.code === '42P01' || shapeError.code === '42703';
      if (isSchemaError) {
        nearbyFriendsRpcSupported = false;
        console.warn('Nearby friends RPC disabled until schema alignment is complete');
      }
      // Leave as null so next call retries after transient errors
      return [];
    }
    nearbyFriendsRpcSupported = true;
  }

  const { data, error } = await supabase.rpc('get_nearby_available_friends', {
    viewer_id: userId,
    center_lat: centerLat,
    center_lng: centerLng,
    radius_meters: radiusMeters,
  });

  if (error) {
    console.error('[getNearbyAvailableFriends] RPC call failed. UserId:', userId, 'Error:', error.message);
    throw error;
  }
  return (data ?? []) as NearbyAvailableFriend[];
}
