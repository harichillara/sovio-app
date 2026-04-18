// Minimal expo-* shim for Next.js web builds.
// Shared `@sovio/core` files import expo modules at module level for native
// use. Web code paths are platform-gated and never execute these APIs, but
// webpack still parses them at build time. This stub satisfies all four
// expo-* imports (secure-store, auth-session, linking, notifications, device)
// with no-op implementations so the web bundle resolves cleanly.
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
};
