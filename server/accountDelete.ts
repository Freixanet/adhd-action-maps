/**
 * Account deletion orchestration (server-only).
 * Success only when Storage is empty for the user, DB rows are gone, and Auth identity is deleted.
 * Any Storage uncertainty → storage_purge_failed and Auth is NOT deleted.
 */

import { validateOwnedStorageRef } from '../shared/sourcesStorage';

export type AccountDeleteCode =
  | 'auth_required'
  | 'delete_not_configured'
  | 'maps_purge_failed'
  | 'sources_purge_failed'
  | 'storage_purge_failed'
  | 'auth_delete_failed'
  | 'ok';

export type AccountDeleteResult =
  | { ok: true; code: 'ok' }
  | { ok: false; status: number; code: AccountDeleteCode; error: string };

export type AccountDeleteDeps = {
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
  isPlaceholderUrl: (url: string) => boolean;
  fetchImpl?: typeof fetch;
  /** Test seam — default 100. */
  storageListPageSize?: number;
  storageDeleteBatchSize?: number;
};

type StorageListItem = {
  name?: string;
  id?: string | null;
};

function fail(
  status: number,
  code: AccountDeleteCode,
  error: string
): AccountDeleteResult {
  return { ok: false, status, code, error };
}

async function serviceFetch(
  fetchImpl: typeof fetch,
  url: string,
  serviceKey: string,
  init?: RequestInit
): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(20000),
  });
}

async function collectStoragePathsFromVersions(
  fetchImpl: typeof fetch,
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  pageSize: number
): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  const paths: string[] = [];
  let offset = 0;
  for (;;) {
    const url =
      `${supabaseUrl}/rest/v1/source_versions` +
      `?owner_id=eq.${encodeURIComponent(userId)}` +
      `&select=storage_path,storage_bucket,source_id,owner_id` +
      `&or=(storage_path.not.is.null,storage_bucket.not.is.null)` +
      `&limit=${pageSize}&offset=${offset}`;
    const res = await serviceFetch(fetchImpl, url, serviceKey, {
      method: 'GET',
      headers: { Prefer: 'count=exact' },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const missing =
        res.status === 404 ||
        /could not find the table|relation .* does not exist|PGRST205/i.test(detail);
      if (missing && offset === 0) return { ok: true, paths: [] };
      return { ok: false, error: 'source_versions path inventory failed' };
    }
    let rows: Array<{
      storage_path?: string | null;
      storage_bucket?: string | null;
      source_id?: string | null;
      owner_id?: string | null;
    }>;
    try {
      rows = (await res.json()) as typeof rows;
      if (!Array.isArray(rows)) return { ok: false, error: 'source_versions inventory malformed' };
    } catch {
      return { ok: false, error: 'source_versions inventory malformed' };
    }
    for (const row of rows) {
      const path = typeof row.storage_path === 'string' ? row.storage_path.trim() : null;
      const bucket = typeof row.storage_bucket === 'string' ? row.storage_bucket.trim() : null;
      if (!path && !bucket) continue;
      const owner = typeof row.owner_id === 'string' ? row.owner_id : userId;
      const sourceId = typeof row.source_id === 'string' ? row.source_id : '';
      // Defense in depth: never trust PostgREST paths without canonical validation.
      const validated = validateOwnedStorageRef({
        ownerId: owner,
        sourceId,
        bucket,
        path,
      });
      if (validated.ok === false || !('path' in validated) || validated.path == null) {
        return { ok: false, error: 'source_versions storage_path failed ownership validation' };
      }
      if (owner !== userId) {
        return { ok: false, error: 'source_versions storage_path owner mismatch' };
      }
      paths.push(validated.path);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return { ok: true, paths };
}

async function listStoragePage(
  fetchImpl: typeof fetch,
  supabaseUrl: string,
  serviceKey: string,
  prefix: string,
  limit: number,
  offset: number
): Promise<{ ok: true; items: StorageListItem[] } | { ok: false; error: string }> {
  const res = await serviceFetch(
    fetchImpl,
    `${supabaseUrl}/storage/v1/object/list/sources`,
    serviceKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit, offset }),
    }
  );
  if (!res.ok) {
    return { ok: false, error: `storage list failed (${res.status})` };
  }
  let items: unknown;
  try {
    items = await res.json();
  } catch {
    return { ok: false, error: 'storage list malformed' };
  }
  if (!Array.isArray(items)) return { ok: false, error: 'storage list malformed' };
  return { ok: true, items: items as StorageListItem[] };
}

/**
 * Recursively list all object paths under `{userId}/` with pagination.
 * Fail closed on any list/parse error.
 */
export async function listAllOwnerStoragePaths(
  fetchImpl: typeof fetch,
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  pageSize: number
): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  const root = `${userId}/`;
  const paths = new Set<string>();
  const folders = [root];

  while (folders.length > 0) {
    const prefix = folders.pop()!;
    let offset = 0;
    for (;;) {
      const page = await listStoragePage(
        fetchImpl,
        supabaseUrl,
        serviceKey,
        prefix,
        pageSize,
        offset
      );
      if (page.ok === false) return { ok: false, error: page.error };
      if (page.items.length === 0) break;

      for (const item of page.items) {
        if (typeof item.name !== 'string' || !item.name || item.name.includes('..')) {
          return { ok: false, error: 'storage list malformed item' };
        }
        const childPrefix = prefix.endsWith('/') ? `${prefix}${item.name}` : `${prefix}/${item.name}`;
        const isFolder = item.id == null;
        if (isFolder) {
          folders.push(childPrefix.endsWith('/') ? childPrefix : `${childPrefix}/`);
        } else {
          paths.add(childPrefix);
        }
      }
      if (page.items.length < pageSize) break;
      offset += pageSize;
    }
  }

  return { ok: true, paths: Array.from(paths) };
}

async function deleteStoragePaths(
  fetchImpl: typeof fetch,
  supabaseUrl: string,
  serviceKey: string,
  paths: string[],
  batchSize: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const res = await serviceFetch(
      fetchImpl,
      `${supabaseUrl}/storage/v1/object/sources`,
      serviceKey,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: batch }),
      }
    );
    if (!res.ok) {
      return { ok: false, error: `storage delete failed (${res.status})` };
    }
  }
  return { ok: true };
}

async function purgeOwnerStorage(args: {
  fetchImpl: typeof fetch;
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  pageSize: number;
  batchSize: number;
}): Promise<AccountDeleteResult | null> {
  const { fetchImpl, supabaseUrl, serviceKey, userId, pageSize, batchSize } = args;

  const fromDb = await collectStoragePathsFromVersions(
    fetchImpl,
    supabaseUrl,
    serviceKey,
    userId,
    pageSize
  );
  if (!fromDb.ok) {
    return fail(502, 'storage_purge_failed', 'No se pudo inventariar rutas de Storage.');
  }

  const listed = await listAllOwnerStoragePaths(
    fetchImpl,
    supabaseUrl,
    serviceKey,
    userId,
    pageSize
  );
  if (!listed.ok) {
    return fail(502, 'storage_purge_failed', 'No se pudo listar los archivos privados de la cuenta.');
  }

  const allPaths = Array.from(new Set([...fromDb.paths, ...listed.paths]));
  if (allPaths.length > 0) {
    const deleted = await deleteStoragePaths(
      fetchImpl,
      supabaseUrl,
      serviceKey,
      allPaths,
      batchSize
    );
    if (!deleted.ok) {
      return fail(502, 'storage_purge_failed', 'No se pudieron borrar los archivos privados de la cuenta.');
    }
  }

  const verify = await listAllOwnerStoragePaths(
    fetchImpl,
    supabaseUrl,
    serviceKey,
    userId,
    pageSize
  );
  if (!verify.ok) {
    return fail(502, 'storage_purge_failed', 'No se pudo verificar el vaciado de Storage.');
  }
  if (verify.paths.length > 0) {
    return fail(502, 'storage_purge_failed', 'Quedan objetos privados tras el borrado de Storage.');
  }
  return null;
}

/**
 * Full account deletion:
 * Storage inventory+purge+verify → maps → sources → Storage re-verify → Auth.
 * Never deletes Auth if Storage is uncertain or non-empty.
 */
export async function deleteAccountFully(
  userId: string | undefined,
  deps: AccountDeleteDeps
): Promise<AccountDeleteResult> {
  if (!userId) {
    return fail(401, 'auth_required', 'Inicia sesión para eliminar la cuenta.');
  }

  const supabaseUrl = deps.supabaseUrl?.replace(/\/$/, '');
  const serviceKey = deps.serviceRoleKey;
  if (!supabaseUrl || !serviceKey || deps.isPlaceholderUrl(supabaseUrl)) {
    return fail(
      503,
      'delete_not_configured',
      'El borrado de cuenta no está configurado en el servidor (falta SUPABASE_SERVICE_ROLE_KEY).'
    );
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const pageSize = Math.max(1, deps.storageListPageSize ?? 100);
  const batchSize = Math.max(1, deps.storageDeleteBatchSize ?? 100);

  const storageError = await purgeOwnerStorage({
    fetchImpl,
    supabaseUrl,
    serviceKey,
    userId,
    pageSize,
    batchSize,
  });
  if (storageError) return storageError;

  const mapsUrl = `${supabaseUrl}/rest/v1/maps?owner_id=eq.${encodeURIComponent(userId)}`;
  const deleteMaps = await serviceFetch(fetchImpl, mapsUrl, serviceKey, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!deleteMaps.ok) {
    return fail(502, 'maps_purge_failed', 'No se pudo borrar el historial en la nube.');
  }

  const sourcesUrl = `${supabaseUrl}/rest/v1/sources?owner_id=eq.${encodeURIComponent(userId)}`;
  const deleteSources = await serviceFetch(fetchImpl, sourcesUrl, serviceKey, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!deleteSources.ok) {
    const detail = await deleteSources.text().catch(() => '');
    const missingRelation =
      deleteSources.status === 404 ||
      /could not find the table|relation .* does not exist|PGRST205/i.test(detail);
    if (!missingRelation) {
      return fail(502, 'sources_purge_failed', 'No se pudieron borrar las fuentes en la nube.');
    }
  }

  const reverify = await listAllOwnerStoragePaths(
    fetchImpl,
    supabaseUrl,
    serviceKey,
    userId,
    pageSize
  );
  if (!reverify.ok || reverify.paths.length > 0) {
    return fail(502, 'storage_purge_failed', 'Storage no quedó vacío antes de eliminar la identidad.');
  }

  const deleteUser = await serviceFetch(
    fetchImpl,
    `${supabaseUrl}/auth/v1/admin/users/${userId}`,
    serviceKey,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
  );
  if (!deleteUser.ok) {
    return fail(502, 'auth_delete_failed', 'No se pudo eliminar la cuenta de autenticación.');
  }

  return { ok: true, code: 'ok' };
}
