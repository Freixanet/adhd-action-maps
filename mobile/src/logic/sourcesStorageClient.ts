/**
 * Minimal authenticated upload/delete against the private `sources` bucket.
 * Path prefix always comes from session.user.id — never from caller-supplied owner.
 */

import { supabase } from './supabase';
import {
  assertPathOwnedBy,
  buildSourcesObjectPath,
  isAllowedSourcesMime,
  SOURCES_MAX_BYTES,
  SOURCES_STORAGE_BUCKET,
} from '@shared/sourcesStorage';

export type SourceUploadResult =
  | { ok: true; path: string; bucket: string }
  | { ok: false; error: string };

async function requireSessionUserId(): Promise<string> {
  if (!supabase) throw new Error('Supabase no configurado.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user?.id;
  if (!userId) throw new Error('Inicia sesión para subir fuentes.');
  return userId;
}

export async function uploadSourceObject(input: {
  sourceId: string;
  objectName: string;
  body: ArrayBuffer | Blob | ArrayBufferView | FormData | File | ReadableStream;
  contentType: string;
  upsert?: boolean;
}): Promise<SourceUploadResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado.' };
  if (!isAllowedSourcesMime(input.contentType)) {
    return { ok: false, error: 'Tipo MIME no permitido.' };
  }
  if (
    typeof Blob !== 'undefined' &&
    input.body instanceof Blob &&
    input.body.size > SOURCES_MAX_BYTES
  ) {
    return { ok: false, error: 'Archivo demasiado grande.' };
  }

  const ownerId = await requireSessionUserId();
  const built = buildSourcesObjectPath({
    ownerId,
    sourceId: input.sourceId,
    objectName: input.objectName,
  });
  if (built.ok === false) return built;

  const { error } = await supabase.storage.from(SOURCES_STORAGE_BUCKET).upload(built.path, input.body, {
    contentType: input.contentType,
    upsert: Boolean(input.upsert),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: built.path, bucket: built.bucket };
}

export async function downloadSourceObject(path: string): Promise<SourceUploadResult & { data?: Blob }> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado.' };
  const ownerId = await requireSessionUserId();
  if (!assertPathOwnedBy(path, ownerId)) {
    return { ok: false, error: 'Ruta fuera del espacio del propietario.' };
  }
  const { data, error } = await supabase.storage.from(SOURCES_STORAGE_BUCKET).download(path);
  if (error || !data) return { ok: false, error: error?.message ?? 'Descarga fallida' };
  return { ok: true, path, bucket: SOURCES_STORAGE_BUCKET, data };
}

export async function createSignedSourceUrl(
  path: string,
  expiresInSeconds = 120
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado.' };
  const ownerId = await requireSessionUserId();
  if (!assertPathOwnedBy(path, ownerId)) {
    return { ok: false, error: 'Ruta fuera del espacio del propietario.' };
  }
  const { data, error } = await supabase.storage
    .from(SOURCES_STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'URL firmada no disponible' };
  }
  return { ok: true, url: data.signedUrl };
}

export async function deleteSourceObject(path: string): Promise<SourceUploadResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado.' };
  const ownerId = await requireSessionUserId();
  if (!assertPathOwnedBy(path, ownerId)) {
    return { ok: false, error: 'Ruta fuera del espacio del propietario.' };
  }
  const { error } = await supabase.storage.from(SOURCES_STORAGE_BUCKET).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true, path, bucket: SOURCES_STORAGE_BUCKET };
}
