import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type { Profile, ProfileInsert, ProfileUpdate } from '../supabase/types';

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

function deriveDisplayName(user: User) {
  const metadata = user.user_metadata ?? {};
  const candidates = [
    metadata.full_name,
    metadata.display_name,
    metadata.name,
    metadata.user_name,
    user.email?.split('@')[0],
  ];

  return candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? null;
}

export async function ensureProfile(user: User): Promise<Profile> {
  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const insert: ProfileInsert = {
    id: user.id,
    email: user.email ?? '',
    display_name: deriveDisplayName(user),
    onboarded: false,
    subscription_tier: 'free',
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(insert, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  updates: Partial<ProfileUpdate>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadAvatar(
  userId: string,
  file: { uri: string; type: string; name: string },
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `${userId}/avatar.${ext}`;

  // Fetch the file as a blob for upload
  const response = await fetch(file.uri);
  const blob = await response.blob();

  // Read blob as ArrayBuffer
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

  // Update profile with new avatar URL
  await updateProfile(userId, { avatar_url: data.publicUrl });

  return data.publicUrl;
}
