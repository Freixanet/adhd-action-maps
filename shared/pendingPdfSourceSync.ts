/**
 * Owner-scoped pending PDF source-sync queue (S08).
 * Stores local file URI + hashes — never 20 MiB base64 in KV storage.
 * Metadata writes await durable storage; never report ok when the durable write failed.
 */

import { getDurableStorage, getStorage } from './storage';
import { isUuidLike } from './pastedText';
import type { PdfCoverage, PdfSegmentPayload } from './pdf/types';
import {
  removePendingPdfFile,
  writePendingPdfFile,
} from './pdf/pendingPdfFileIO';

export type PendingPdfSourceSyncItem = {
  mapId: string;
  sourceId: string;
  sourceVersionId: string;
  sourceRequestId: string;
  contentHash: string;
  extractionDigest: string;
  pageCount: number;
  segments: PdfSegmentPayload[];
  coverage: PdfCoverage;
  /** Durable local file URI (not base64). */
  localFileUri: string;
  byteSize: number;
  storagePath?: string;
  title?: string;
  updatedAt: number;
};

function keyForUser(userId: string): string {
  return `nucleo_pending_pdf_source_sync:user:${userId.trim()}`;
}

export function isValidPendingPdfSourceSyncItem(
  item: unknown
): item is PendingPdfSourceSyncItem {
  if (!item || typeof item !== 'object') return false;
  const row = item as PendingPdfSourceSyncItem;
  return (
    isUuidLike(row.mapId) &&
    isUuidLike(row.sourceId) &&
    isUuidLike(row.sourceVersionId) &&
    isUuidLike(row.sourceRequestId) &&
    typeof row.contentHash === 'string' &&
    row.contentHash.length > 0 &&
    typeof row.extractionDigest === 'string' &&
    row.extractionDigest.length > 0 &&
    typeof row.pageCount === 'number' &&
    Array.isArray(row.segments) &&
    row.segments.length > 0 &&
    typeof row.localFileUri === 'string' &&
    row.localFileUri.length > 0 &&
    typeof row.byteSize === 'number' &&
    row.byteSize > 0 &&
    row.coverage != null &&
    typeof row.coverage === 'object' &&
    typeof row.updatedAt === 'number'
  );
}

export function loadPendingPdfSourceSync(userId: string): PendingPdfSourceSyncItem[] {
  const id = userId.trim();
  if (!id) return [];
  try {
    const raw = getStorage().getItem(keyForUser(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPendingPdfSourceSyncItem);
  } catch {
    return [];
  }
}

/**
 * Await durable metadata write. Never swallows errors as success.
 * Requires DurableKeyValueStorage (AsyncStorage-backed on RN).
 */
export async function savePendingPdfSourceSync(
  userId: string,
  items: PendingPdfSourceSyncItem[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = userId.trim();
  if (!id) return { ok: false, error: 'pending_pdf_user_required' };
  const durable = getDurableStorage();
  if (!durable) {
    return { ok: false, error: 'pending_pdf_durable_storage_required' };
  }
  const payload = JSON.stringify(items.filter(isValidPendingPdfSourceSyncItem));
  try {
    await durable.setItemDurable(keyForUser(id), payload);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'pending_pdf_metadata_save_failed',
    };
  }
}

export async function upsertPendingPdfSourceSync(
  userId: string,
  item: Omit<PendingPdfSourceSyncItem, 'updatedAt'>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nextItem: PendingPdfSourceSyncItem = { ...item, updatedAt: Date.now() };
  if (!isValidPendingPdfSourceSyncItem(nextItem)) {
    return { ok: false, error: 'pending_pdf_item_invalid' };
  }
  const existing = loadPendingPdfSourceSync(userId).filter(
    (row) => row.sourceRequestId !== item.sourceRequestId
  );
  existing.push(nextItem);
  return savePendingPdfSourceSync(userId, existing);
}

/**
 * Write PDF bytes then durable metadata. Only then is the queue committed.
 * On metadata failure or A→B mid-flight: delete the orphan file and return ok:false.
 */
export async function commitPendingPdfSourceSync(args: {
  userId: string;
  /** Live auth owner; must still equal userId before consolidating metadata. */
  liveUserId: () => string | null | undefined;
  item: Omit<PendingPdfSourceSyncItem, 'updatedAt' | 'localFileUri' | 'byteSize'>;
  bytes: Uint8Array;
}): Promise<{ ok: true; localFileUri: string } | { ok: false; error: string }> {
  const owner = args.userId.trim();
  if (!owner) return { ok: false, error: 'pending_pdf_user_required' };
  if (!args.bytes.length) return { ok: false, error: 'pending_pdf_empty_bytes' };

  const written = await writePendingPdfFile({
    userId: owner,
    sourceRequestId: args.item.sourceRequestId,
    bytes: args.bytes,
  });
  if (written.ok === false) {
    return { ok: false, error: written.error };
  }

  const live = args.liveUserId()?.trim() || '';
  if (live !== owner) {
    await removePendingPdfFile(written.uri);
    return { ok: false, error: 'pending_pdf_owner_switched' };
  }

  const saved = await upsertPendingPdfSourceSync(owner, {
    ...args.item,
    localFileUri: written.uri,
    byteSize: args.bytes.length,
  });
  if (saved.ok === false) {
    await removePendingPdfFile(written.uri);
    return { ok: false, error: saved.error };
  }

  const still = args.liveUserId()?.trim() || '';
  if (still !== owner) {
    // B must not keep A's pending: remove metadata under A and orphan file.
    await removePendingPdfSourceSync(owner, args.item.sourceRequestId);
    return { ok: false, error: 'pending_pdf_owner_switched' };
  }

  return { ok: true, localFileUri: written.uri };
}

export async function removePendingPdfSourceSync(
  userId: string,
  sourceRequestId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prev = loadPendingPdfSourceSync(userId);
  const removed = prev.filter((row) => row.sourceRequestId === sourceRequestId);
  const kept = prev.filter((row) => row.sourceRequestId !== sourceRequestId);
  const saved = await savePendingPdfSourceSync(userId, kept);
  if (saved.ok === false) {
    return saved;
  }
  for (const row of removed) {
    await removePendingPdfFile(row.localFileUri);
  }
  return { ok: true };
}

export async function removePendingPdfSourceSyncByMapId(
  userId: string,
  mapId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prev = loadPendingPdfSourceSync(userId);
  const removed = prev.filter((row) => row.mapId === mapId);
  const kept = prev.filter((row) => row.mapId !== mapId);
  const saved = await savePendingPdfSourceSync(userId, kept);
  if (saved.ok === false) {
    return saved;
  }
  for (const row of removed) {
    await removePendingPdfFile(row.localFileUri);
  }
  return { ok: true };
}

export async function clearPendingPdfSourceSyncForUser(userId: string): Promise<void> {
  const prev = loadPendingPdfSourceSync(userId);
  const durable = getDurableStorage();
  if (durable) {
    try {
      await durable.removeItemDurable(keyForUser(userId));
    } catch {
      /* still attempt file cleanup */
    }
  } else {
    try {
      getStorage().removeItem(keyForUser(userId));
    } catch {
      /* ignore */
    }
  }
  for (const row of prev) {
    await removePendingPdfFile(row.localFileUri);
  }
}

export function pendingPdfSourceSyncIndexByMapId(
  userId: string
): Record<string, PendingPdfSourceSyncItem> {
  const out: Record<string, PendingPdfSourceSyncItem> = {};
  for (const item of loadPendingPdfSourceSync(userId)) {
    out[item.mapId] = item;
  }
  return out;
}

export function getPendingPdfSourceSyncForMap(
  userId: string,
  mapId: string
): PendingPdfSourceSyncItem | null {
  const id = mapId.trim();
  if (!id) return null;
  return loadPendingPdfSourceSync(userId).find((row) => row.mapId === id) ?? null;
}

/**
 * Drop pending rows whose history entry already has cloud PDF meta.
 * Never runs under a different owner (caller must pass the live userId).
 */
export async function reconcilePendingPdfSourceSyncWithHistory(
  userId: string,
  entries: Array<{
    id: string;
    sourceMeta?: { kind?: string; persistStatus?: string; sourceRequestId?: string };
  }>
): Promise<PendingPdfSourceSyncItem[]> {
  const byMap = new Map(entries.map((e) => [e.id, e]));
  const kept: PendingPdfSourceSyncItem[] = [];
  const dropFiles: string[] = [];
  for (const item of loadPendingPdfSourceSync(userId)) {
    const entry = byMap.get(item.mapId);
    const meta = entry?.sourceMeta;
    if (
      meta &&
      meta.kind === 'pdf' &&
      meta.persistStatus === 'cloud' &&
      meta.sourceRequestId === item.sourceRequestId
    ) {
      dropFiles.push(item.localFileUri);
      continue;
    }
    kept.push(item);
  }
  await savePendingPdfSourceSync(userId, kept);
  for (const uri of dropFiles) {
    await removePendingPdfFile(uri);
  }
  return kept;
}
