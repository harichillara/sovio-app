import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../supabase/client';
import { darkTheme } from '@sovio/tokens';

export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: darkTheme.accent,
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

  // Save to push_tokens table (upsert by user_id + token)
  const { error } = await supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform },
    { onConflict: 'user_id,token' },
  );

  if (error) {
    // If upsert fails on conflict spec, try insert as fallback
    const { error: insertError } = await supabase.from('push_tokens').insert({
      user_id: userId, token, platform,
    });
    if (insertError) throw insertError;
  }

  return token;
}

export async function removePushToken(
  userId: string,
  token: string,
): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  if (error) throw error;
}

export async function getPushTokens(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.token);
}

export async function disablePushNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

export async function hasPushNotificationsEnabled(userId: string): Promise<boolean> {
  const tokens = await getPushTokens(userId);
  return tokens.length > 0;
}

// ---------------------------------------------------------------------------
// Notification center CRUD (reads from the unified `notifications` table)
// ---------------------------------------------------------------------------

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: 'suggestion' | 'message' | 'replay' | 'insight' | 'match';
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  push_sent: boolean;
  created_at: string;
}

export async function getNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}
