import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HistoryEntry, HistoryStore } from './history';
import { isChatHistoryEntry } from '@shared/historyKind';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/** URL estable registrada en Supabase (evita exp:// que redirige al sitio web). */
export function getAuthRedirectUrl(): string {
  // Expo web: land on the local API bridge (allowlisted as http://127.0.0.1:3000/**),
  // which bounces ?code= back to Expo web. Avoids Supabase falling back to Railway Site URL.
  if (Platform.OS === 'web') {
    return (
      process.env.EXPO_PUBLIC_AUTH_WEB_BRIDGE_URL?.trim() ||
      'http://127.0.0.1:3000/auth/callback'
    );
  }

  const override = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (override) return override;

  const configuredScheme = Constants.expoConfig?.scheme;
  const scheme =
    typeof configuredScheme === 'string'
      ? configuredScheme
      : Array.isArray(configuredScheme) && typeof configuredScheme[0] === 'string'
        ? configuredScheme[0]
        : 'nucleo';

  return `${scheme}://login-callback`;
}

type CloudMap = {
  id: string;
  title: string;
  category: string | null;
  pinned_at: string | null;
  source_type: HistoryEntry['sourceType'];
  session: HistoryEntry['session'];
  created_at: string;
  updated_at: string;
};

function toCloudMap(entry: HistoryEntry) {
  return {
    id: entry.id,
    title: entry.title,
    category: entry.category ?? null,
    pinned_at: entry.pinnedAt ? new Date(entry.pinnedAt).toISOString() : null,
    source_type: entry.sourceType,
    session: entry.session,
    created_at: new Date(entry.createdAt).toISOString(),
    updated_at: new Date(entry.updatedAt).toISOString(),
  };
}

function fromCloudMap(map: CloudMap): HistoryEntry {
  return {
    id: map.id,
    title: map.title,
    category: map.category ?? undefined,
    pinned: Boolean(map.pinned_at),
    pinnedAt: map.pinned_at ? new Date(map.pinned_at).getTime() : undefined,
    sourceType: map.source_type,
    session: map.session,
    createdAt: new Date(map.created_at).getTime(),
    updatedAt: new Date(map.updated_at).getTime(),
  };
}

export async function signInWith(provider: 'google' | 'apple') {
  if (!supabase) throw new Error('La sincronización todavía no está configurada.');
  const redirectTo = getAuthRedirectUrl();
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
}

function paramFromUrl(url: string, key: string): string | undefined {
  // Pure JS parse — avoids requiring the ExpoLinking native module at startup.
  try {
    const normalized = /:\/\//.test(url) ? url : `nucleo://${url}`;
    const parsed = new URL(normalized);
    const fromQuery = parsed.searchParams.get(key);
    if (fromQuery) return fromQuery;
    if (parsed.hash.length > 1) {
      const fromHash = new URLSearchParams(parsed.hash.slice(1)).get(key);
      if (fromHash) return fromHash;
    }
  } catch {
    /* fall through */
  }

  const qIndex = url.indexOf('?');
  if (qIndex >= 0) {
    const query = url.slice(qIndex + 1).split('#')[0] ?? '';
    const fromQuery = new URLSearchParams(query).get(key);
    if (fromQuery) return fromQuery;
  }

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    return new URLSearchParams(url.slice(hashIndex + 1)).get(key) ?? undefined;
  }
  return undefined;
}

async function establishSessionFromRedirectUrl(url: string): Promise<boolean> {
  if (!supabase) return false;

  const errorDescription = paramFromUrl(url, 'error_description');
  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
  }

  const code = paramFromUrl(url, 'code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return true;
  }

  const accessToken = paramFromUrl(url, 'access_token');
  const refreshToken = paramFromUrl(url, 'refresh_token');
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    return true;
  }

  return false;
}

/** Completa OAuth cuando la app se abre vía deep link (login-callback). */
export async function completeOAuthRedirect(url: string): Promise<boolean> {
  if (!url.includes('login-callback')) return false;
  const established = await establishSessionFromRedirectUrl(url);
  if (!established) {
    throw new Error('No se recibió una sesión válida del proveedor.');
  }
  return true;
}

/**
 * Flujo OAuth completo: en nativo abre el auth session del sistema; en web
 * redirige la pestaña a Google/Apple y vuelve a `window.location.origin`.
 */
export async function signInWithProvider(provider: 'google' | 'apple') {
  if (!supabase) throw new Error('La sincronización todavía no está configurada.');

  const redirectTo = getAuthRedirectUrl();

  if (Platform.OS === 'web') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('No se pudo iniciar el acceso con el proveedor.');
    window.location.assign(data.url);
    return true;
  }

  const { data, error } = await signInWith(provider);
  if (error) throw error;
  if (!data?.url) throw new Error('No se pudo iniciar el acceso con el proveedor.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    return false;
  }

  const established = await establishSessionFromRedirectUrl(result.url);
  if (!established) {
    throw new Error('No se recibió una sesión válida del proveedor.');
  }
  return true;
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('La sincronización todavía no está configurada.');
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signUpWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('La sincronización todavía no está configurada.');
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (!data.session) {
    throw new Error('Revisa tu email para confirmar la cuenta, o usa Google para entrar al instante.');
  }
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

type MapsClient = {
  from: SupabaseClient['from'];
};

/** Upsert entries using a session-bound client (not the mutable global singleton). */
export async function migrateLocalHistoryWithClient(
  client: MapsClient,
  entries: HistoryEntry[] | HistoryStore
) {
  const list = (Array.isArray(entries) ? entries : entries.entries).filter(
    (entry) => !isChatHistoryEntry(entry)
  );
  if (list.length === 0) return;
  const { error } = await client.from('maps').upsert(list.map(toCloudMap), {
    onConflict: 'id',
    ignoreDuplicates: false,
  });
  if (error) throw error;
}

export async function pullCloudHistoryWithClient(client: MapsClient): Promise<HistoryEntry[]> {
  const { data, error } = await client
    .from('maps')
    .select('id,title,category,pinned_at,source_type,session,created_at,updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as CloudMap[]).map(fromCloudMap);
}

export async function deleteCloudHistoryEntryWithClient(client: MapsClient, id: string) {
  const { error } = await client.from('maps').delete().eq('id', id);
  if (error) throw error;
}

export async function pushHistoryEntryWithClient(client: MapsClient, entry: HistoryEntry) {
  if (isChatHistoryEntry(entry)) return;
  const { error } = await client.from('maps').upsert(toCloudMap(entry), { onConflict: 'id' });
  if (error) throw error;
}

/**
 * Global singleton helpers are intentionally unavailable for authenticated mobile sync.
 * Use the WithClient variants with createSessionBoundSupabase(accessToken).
 */
export async function migrateLocalHistory(_entries: HistoryEntry[] | HistoryStore): Promise<never> {
  throw new Error('migrateLocalHistory requires a session-bound client (migrateLocalHistoryWithClient)');
}

export async function pullCloudHistory(): Promise<never> {
  throw new Error('pullCloudHistory requires a session-bound client (pullCloudHistoryWithClient)');
}

export async function pushHistoryEntry(_entry: HistoryEntry): Promise<never> {
  throw new Error('pushHistoryEntry requires a session-bound client (pushHistoryEntryWithClient)');
}

export async function deleteCloudHistoryEntry(_id: string): Promise<never> {
  throw new Error(
    'deleteCloudHistoryEntry requires a session-bound client (deleteCloudHistoryEntryWithClient)'
  );
}

export async function deleteAllCloudHistory(): Promise<never> {
  throw new Error('deleteAllCloudHistory is disabled; use bound deletes per entry');
}
