import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

function isUsableSupabaseConfig(candidateUrl?: string, candidateKey?: string): boolean {
  if (!candidateUrl || !candidateKey) return false;
  if (/your-project\.supabase\.co/i.test(candidateUrl)) return false;
  if (/^your-anon-key$/i.test(candidateKey)) return false;
  return true;
}

/** Null when cloud sync is not configured or still on placeholder env. */
export const supabase: SupabaseClient | null = isUsableSupabaseConfig(url, anonKey)
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const isCloudSyncConfigured = Boolean(supabase);
