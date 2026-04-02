import { supabase } from '../supabase/client';
import type { Profile, ProfileUpdate } from '../supabase/types';
import { decode } from 'base64-arraybuffer';

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
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
