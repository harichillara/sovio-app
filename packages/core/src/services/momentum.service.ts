import { supabase } from '../supabase/client';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface MomentumAvailability {
  id: string;
  user_id: string;
  bucket: string; // geo-hash or location bucket
  category: string | null; // e.g. "food", "drinks", "activity"
  available_until: string;
  created_at: string;
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
): Promise<MomentumAvailability> {
  const availableUntil = new Date(
    Date.now() + durationMins * 60 * 1000,
  ).toISOString();

  // Remove any existing availability first
  await supabase
    .from('momentum_availability')
    .delete()
    .eq('user_id', userId);

  const { data, error } = await supabase
    .from('momentum_availability')
    .insert({
      user_id: userId,
      bucket,
      category,
      available_until: availableUntil,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as MomentumAvailability;
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
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('momentum_availability')
    .select('*')
    .eq('bucket', bucket)
    .gt('available_until', now)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MomentumAvailability[];
}

/**
 * Check if the user is currently available.
 */
export async function getMyAvailability(
  userId: string,
): Promise<MomentumAvailability | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('momentum_availability')
    .select('*')
    .eq('user_id', userId)
    .gt('available_until', now)
    .maybeSingle();

  if (error) throw error;
  return data as MomentumAvailability | null;
}
