// Minimal expo-* shim for Next.js web builds.
// Shared `@sovio/core` files import expo modules at module level for native
// use. Web code paths are platform-gated and never execute these APIs, but
// webpack still parses them at build time. This stub satisfies all expo-*
// imports (secure-store, auth-session, linking, notifications, device,
// location, modules-core) with no-op implementations so the web bundle
// resolves cleanly.
//
// SDK 54 note: `expo-modules-core@3.0.29` still ships raw `.ts` as its entry
// (`"main": "src/index.ts"`), which Next 15's webpack cannot parse. Aliasing
// here short-circuits the resolution before webpack sees the raw TS.
const asyncNull = async () => null;
const asyncVoid = async () => undefined;
const noop = () => undefined;

module.exports = {
  // expo-secure-store
  getItemAsync: asyncNull,
  setItemAsync: asyncVoid,
  deleteItemAsync: asyncVoid,

  // expo-auth-session
  makeRedirectUri: () => '',

  // expo-linking
  createURL: () => '',
  addEventListener: () => ({ remove: noop }),
  getInitialURL: asyncNull,

  // expo-notifications
  getPermissionsAsync: async () => ({ status: 'undetermined' }),
  requestPermissionsAsync: async () => ({ status: 'undetermined' }),
  getExpoPushTokenAsync: async () => ({ data: '' }),
  setNotificationHandler: noop,
  addNotificationReceivedListener: () => ({ remove: noop }),
  addNotificationResponseReceivedListener: () => ({ remove: noop }),

  // expo-device
  isDevice: false,
  osName: 'web',

  // expo-location — location.service.ts is imported transitively via
  // @sovio/core's barrel but never invoked on web. These stubs exist purely
  // so webpack can resolve type/value references at parse time.
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: async () => ({ status: 'undetermined' }),
  getForegroundPermissionsAsync: async () => ({ status: 'undetermined' }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: 0, longitude: 0 }, timestamp: 0 }),

  // expo-modules-core — its v3.0.29 entry is still raw TS; stub the surface
  // that `expo` and `expo-location` touch at import time. All call sites
  // on web are dead code paths behind `Platform.OS === 'web'` guards.
  NativeModule: class {},
  SharedObject: class {},
  SharedRef: class {},
  EventEmitter: class { addListener() { return { remove: noop }; } },
  requireNativeModule: () => ({}),
  requireOptionalNativeModule: () => null,
  registerWebModule: () => ({}),
  Platform: { OS: 'web' },
  uuid: { v4: () => '', v5: () => '' },
  createWebModule: () => ({}),
  LegacyEventEmitter: class { addListener() { return { remove: noop }; } },
};
