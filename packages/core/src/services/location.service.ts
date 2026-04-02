import * as Location from 'expo-location';

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
