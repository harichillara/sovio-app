import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../supabase/client';

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
      lightColor: '#BDFF2E',
    });
  }

  // Get the push token
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Determine platform
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  // Save to push_tokens table (upsert by user_id + token)
  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: platform as 'ios' | 'android',
    },
    { onConflict: 'user_id,token' },
  );

  if (error) {
    // If upsert fails on conflict spec, try insert
    await supabase.from('push_tokens').insert({
      user_id: userId,
      token,
      platform: platform as 'ios' | 'android',
    });
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
