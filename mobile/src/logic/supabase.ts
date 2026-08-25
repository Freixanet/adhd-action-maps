import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const isWeb = Platform.OS === 'web';

function isUsableSupabaseConfig(candidateUrl?: string, candidateKey?: string): boolean {
  if (!candidateUrl || !candidateKey) return false;
  if (/your-project\.supabase\.co/i.test(candidateUrl)) return false;
  if (/^your-anon-key$/i.test(candidateKey)) return false;
  return true;
}

const webAuthStorage = {
  getItem: (key: string) => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {
      /* private mode / sandboxed embed */
    }
  },
  removeItem: (key: string) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/** Null when cloud sync is not configured or still on placeholder env. */
export const supabase: SupabaseClient | null = isUsableSupabaseConfig(url, anonKey)
  ? createClient(url!, anonKey!, {
      auth: {
        storage: isWeb ? webAuthStorage : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Native uses deep-link callback; web needs hash/query session pickup after Google.
        detectSessionInUrl: isWeb,
        flowType: 'pkce',
      },
    })
  : null;

export const isCloudSyncConfigured = Boolean(supabase);
