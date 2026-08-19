/**
 * Canonical private Storage paths for source blobs.
 * Prefix is always derived from the authenticated user id — never from free caller input.
 * RLS remains the authority; these checks only reject unsafe path construction.
 */

export const SOURCES_STORAGE_BUCKET = 'sources' as const;

/** 50 MiB — matches migration bucket limit. */
export const SOURCES_MAX_BYTES = 52_428_800;

export const SOURCES_ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/html',
  'application/pdf',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'application/octet-stream',
] as const;

export type SourcesPathBuildResult =
  | { ok: true; bucket: typeof SOURCES_STORAGE_BUCKET; path: string }
  | { ok: false; error: string };

function isSafePathSegment(value: string): boolean {
  if (!value) return false;
  if (value === '.' || value === '..') return false;
  if (value.includes('/') || value.includes('\\')) return false;
  // Control chars (C0 + DEL)
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return true;
}

/**
 * Build `ownerId/sourceId/objectName` (exactly three segments).
 * `ownerId` must be the validated session user id (caller responsibility).
 */
export function buildSourcesObjectPath(input: {
  ownerId: string;
  sourceId: string;
  objectName: string;
}): SourcesPathBuildResult {
  const ownerId = input.ownerId?.trim();
  const sourceId = input.sourceId?.trim();
  const objectName = input.objectName?.trim();

  if (!ownerId) return { ok: false, error: 'ownerId required' };
  if (!sourceId) return { ok: false, error: 'sourceId required' };
  if (!objectName) return { ok: false, error: 'objectName required' };

  if (!isSafePathSegment(ownerId)) return { ok: false, error: 'ownerId invalid' };
  if (!isSafePathSegment(sourceId)) return { ok: false, error: 'sourceId invalid' };
  if (!isSafePathSegment(objectName)) return { ok: false, error: 'objectName invalid' };

  const path = `${ownerId}/${sourceId}/${objectName}`;
  if (path.split('/').length !== 3) {
    return { ok: false, error: 'path must have exactly three segments' };
  }

  return {
    ok: true,
    bucket: SOURCES_STORAGE_BUCKET,
    path,
  };
}

export function assertPathOwnedBy(path: string, ownerId: string): boolean {
  const prefix = ownerId.trim();
  if (!prefix || !isSafePathSegment(prefix)) return false;
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Validate a DB storage_bucket + storage_path pair for a known owner/source.
 * Both must be null, or both set to the canonical sources path.
 */
export function validateOwnedStorageRef(input: {
  ownerId: string;
  sourceId: string;
  bucket: string | null | undefined;
  path: string | null | undefined;
}): SourcesPathBuildResult | { ok: true; bucket: null; path: null } {
  const bucket = input.bucket ?? null;
  const path = input.path ?? null;
  if (bucket === null && path === null) {
    return { ok: true, bucket: null, path: null };
  }
  if (bucket === null || path === null) {
    return { ok: false, error: 'storage_bucket and storage_path must both be set or both null' };
  }
  if (bucket !== SOURCES_STORAGE_BUCKET) {
    return { ok: false, error: 'storage_bucket must be sources' };
  }
  const segments = path.split('/');
  if (segments.length !== 3) {
    return { ok: false, error: 'storage_path must have exactly three segments' };
  }
  if (segments[0] !== input.ownerId || segments[1] !== input.sourceId) {
    return { ok: false, error: 'storage_path owner/source mismatch' };
  }
  return buildSourcesObjectPath({
    ownerId: input.ownerId,
    sourceId: input.sourceId,
    objectName: segments[2]!,
  });
}

export function isAllowedSourcesMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const normalized = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  return (SOURCES_ALLOWED_MIME_TYPES as readonly string[]).includes(normalized);
}
