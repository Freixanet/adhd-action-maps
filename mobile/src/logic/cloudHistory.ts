import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { HistoryEntry, HistoryStore } from './history';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/** URL estable registrada en Supabase (evita exp:// que redirige al sitio web). */
export function getAuthRedirectUrl(): string {
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
  const parsed = Linking.parse(url);
  const fromQuery = parsed.queryParams?.[key];
  if (typeof fromQuery === 'string') return fromQuery;

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const hashParams = new URLSearchParams(url.slice(hashIndex + 1));
    return hashParams.get(key) ?? undefined;
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
 * Flujo OAuth completo para móvil: abre el navegador de autenticación del sistema,
 * recoge la redirección hacia la app y canjea el código/token por una sesión persistida.
 */
export async function signInWithProvider(provider: 'google' | 'apple') {
  if (!supabase) throw new Error('La sincronización todavía no está configurada.');

  const redirectTo = getAuthRedirectUrl();

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

export async function migrateLocalHistory(store: HistoryStore) {
  if (!supabase || store.entries.length === 0) return;
  const { error } = await supabase.from('maps').upsert(
    store.entries.map(toCloudMap),
    { onConflict: 'id', ignoreDuplicates: false }
  );
  if (error) throw error;
}

export async function pullCloudHistory(): Promise<HistoryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('maps')
    .select('id,title,category,pinned_at,source_type,session,created_at,updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as CloudMap[]).map(fromCloudMap);
}

export async function pushHistoryEntry(entry: HistoryEntry) {
  if (!supabase) return;
  const { error } = await supabase.from('maps').upsert(toCloudMap(entry), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteCloudHistoryEntry(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from('maps').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllCloudHistory(): Promise<void> {
  if (!supabase) return;
  const entries = await pullCloudHistory();
  await Promise.all(entries.map((entry) => deleteCloudHistoryEntry(entry.id)));
}
