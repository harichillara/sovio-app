import { supabase } from '../supabase/client';
import type { Friendship, Profile } from '../supabase/types';

export interface FriendWithProfile extends Friendship {
  profile: Profile;
}

export async function getFriends(userId: string): Promise<FriendWithProfile[]> {
  // Friends can be in either direction — where user is user_id or friend_id
  const { data: asUser, error: e1 } = await supabase
    .from('friendships')
    .select(`*, profile:profiles!friendships_friend_id_fkey(*)`)
    .eq('user_id', userId)
    .eq('status', 'accepted');

  const { data: asFriend, error: e2 } = await supabase
    .from('friendships')
    .select(`*, profile:profiles!friendships_user_id_fkey(*)`)
    .eq('friend_id', userId)
    .eq('status', 'accepted');

  if (e1) throw e1;
  if (e2) throw e2;

  return [...(asUser ?? []), ...(asFriend ?? [])] as FriendWithProfile[];
}

export async function sendFriendRequest(
  userId: string,
  friendId: string,
): Promise<Friendship> {
  const { data, error } = await supabase
    .from('friendships')
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function acceptFriendRequest(
  userId: string,
  friendId: string,
): Promise<Friendship> {
  // The request was sent by friendId to userId,
  // so we update where user_id = friendId and friend_id = userId
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('user_id', friendId)
    .eq('friend_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFriendRequests(userId: string): Promise<FriendWithProfile[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select(`*, profile:profiles!friendships_user_id_fkey(*)`)
    .eq('friend_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return (data ?? []) as FriendWithProfile[];
}
