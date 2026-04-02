import { create } from 'zustand';
import type { PermissionStatus } from 'expo-location';

interface Coords {
  latitude: number;
  longitude: number;
}

interface LocationState {
  currentCoords: Coords | null;
  permissionStatus: PermissionStatus | null;
  setCurrentCoords: (coords: Coords | null) => void;
  setPermissionStatus: (status: PermissionStatus) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentCoords: null,
  permissionStatus: null,
  setCurrentCoords: (currentCoords) => set({ currentCoords }),
  setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
  reset: () => set({ currentCoords: null, permissionStatus: null }),
}));
