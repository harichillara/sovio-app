import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Custom storage adapter for React Native using expo-secure-store.
 * SecureStore encrypts data at rest on device (Keychain on iOS, EncryptedSharedPreferences on Android).
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  },
};

const WebStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const globalStorage = globalThis as typeof globalThis & {
      localStorage?: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
      };
    };
    const storage =
      typeof globalThis !== 'undefined' ? globalStorage.localStorage : undefined;
    if (!storage) return null;
    return storage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const globalStorage = globalThis as typeof globalThis & {
      localStorage?: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
      };
    };
    const storage =
      typeof globalThis !== 'undefined' ? globalStorage.localStorage : undefined;
    if (!storage) return;
    storage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    const globalStorage = globalThis as typeof globalThis & {
      localStorage?: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
      };
    };
    const storage =
      typeof globalThis !== 'undefined' ? globalStorage.localStorage : undefined;
    if (!storage) return;
    storage.removeItem(key);
  },
};

const authStorage =
  Platform.OS === 'web' ? WebStorageAdapter : ExpoSecureStoreAdapter;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Keep PKCE callback exchange owned by app code. On web the dedicated
    // /callback route performs the exchange after the Supabase client has
    // initialized; on native the deep-link handler does the same.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
