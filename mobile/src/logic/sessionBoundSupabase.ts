import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

/**
 * Client bound to a captured access token for one hydration/sync run.
 * Does not share mutable auth state with the global singleton.
 */
export function createSessionBoundSupabase(accessToken: string): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Supabase no configurado.');
  }
  const token = accessToken.trim();
  if (!token) throw new Error('accessToken required');

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function captureSessionIdentity(session: Session | null): {
  userId: string | null;
  accessToken: string | null;
} {
  const userId = session?.user?.id?.trim() || null;
  const accessToken = session?.access_token?.trim() || null;
  return { userId, accessToken: userId ? accessToken : null };
}
