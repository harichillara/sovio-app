import * as Location from 'expo-location';
import { supabase } from '../supabase/client';
import type { LocationSnapshot } from '../supabase/types';

export interface Coords {
  latitude: number;
  longitude: number;
}

export function coordsToLocalityBucket(coords: Coords): string {
  const latBucket = Math.round(coords.latitude * 20) / 20;
  const lngBucket = Math.round(coords.longitude * 20) / 20;
  return `${latBucket.toFixed(2)}:${lngBucket.toFixed(2)}`;
}

export async function requestPermission(): Promise<Location.PermissionStatus> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status;
}

export async function getCurrentLocation(): Promise<Location.LocationObject> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return location;
}

export async function getPermissionStatus(): Promise<Location.PermissionStatus> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status;
}

export async function captureLocationSnapshot(
  userId: string,
  location: Location.LocationObject,
  sharingMode: 'approx' | 'precise' = 'approx',
): Promise<LocationSnapshot> {
  const coords = location.coords;
  const localityBucket = coordsToLocalityBucket({
    latitude: coords.latitude,
    longitude: coords.longitude,
  });

  const { data, error } = await supabase
    .from('location_snapshots')
    .insert({
      user_id: userId,
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy_meters: coords.accuracy ? Math.round(coords.accuracy) : null,
      locality_bucket: localityBucket,
      sharing_mode: sharingMode,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getLatestLocationSnapshot(
  userId: string,
): Promise<LocationSnapshot | null> {
  const { data, error } = await supabase
    .from('location_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
