/**
 * Owner-scoped pending source-sync queue (S03).
 * Keys never cross users; purge integrates with removeHistoryOwner.
 */

import { getStorage } from './storage';
import { isUuidLike, type PastedTextOperationIds, type PastedTextPersistStatus } from './pastedText';

export type PendingSourceSyncItem = {
  mapId: string;
  sourceId: string;
  sourceVersionId: string;
  sourceRequestId: string;
  /** Canonical text needed to re-segment without Gemini. */
  canonicalText: string;
  contentHash: string;
  title?: string;
  collectionId?: string;
  updatedAt: number;
};

function keyForUser(userId: string): string {
  return `nucleo_pending_source_sync:user:${userId.trim()}`;
}

export function isValidPendingSourceSyncItem(item: unknown): item is PendingSourceSyncItem {
  if (!item || typeof item !== 'object') return false;
  const row = item as PendingSourceSyncItem;
  return (
    isUuidLike(row.mapId) &&
    isUuidLike(row.sourceId) &&
    isUuidLike(row.sourceVersionId) &&
    isUuidLike(row.sourceRequestId) &&
    typeof row.canonicalText === 'string' &&
    row.canonicalText.length > 0 &&
    typeof row.contentHash === 'string' &&
    row.contentHash.length > 0 &&
    (row.title === undefined || typeof row.title === 'string') &&
    (row.collectionId === undefined || isUuidLike(row.collectionId)) &&
    typeof row.updatedAt === 'number'
  );
}

export function loadPendingSourceSync(userId: string): PendingSourceSyncItem[] {
  const id = userId.trim();
  if (!id) return [];
  try {
    const raw = getStorage().getItem(keyForUser(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPendingSourceSyncItem);
  } catch {
    return [];
  }
}

export function savePendingSourceSync(userId: string, items: PendingSourceSyncItem[]): void {
  const id = userId.trim();
  if (!id) return;
  try {
    getStorage().setItem(keyForUser(id), JSON.stringify(items.filter(isValidPendingSourceSyncItem)));
  } catch {
    /* ignore */
  }
}

export function upsertPendingSourceSync(
  userId: string,
  item: Omit<PendingSourceSyncItem, 'updatedAt'>
): void {
  const nextItem: PendingSourceSyncItem = { ...item, updatedAt: Date.now() };
  if (!isValidPendingSourceSyncItem(nextItem)) return;
  const existing = loadPendingSourceSync(userId).filter(
    (row) => row.sourceRequestId !== item.sourceRequestId
  );
  existing.push(nextItem);
  savePendingSourceSync(userId, existing);
}

export function removePendingSourceSync(
  userId: string,
  sourceRequestId: string
): void {
  const next = loadPendingSourceSync(userId).filter(
    (row) => row.sourceRequestId !== sourceRequestId
  );
  savePendingSourceSync(userId, next);
}

export function removePendingSourceSyncByMapId(userId: string, mapId: string): void {
  const next = loadPendingSourceSync(userId).filter((row) => row.mapId !== mapId);
  savePendingSourceSync(userId, next);
}

export function getPendingSourceSyncForMap(
  userId: string,
  mapId: string
): PendingSourceSyncItem | null {
  return loadPendingSourceSync(userId).find((row) => row.mapId === mapId) ?? null;
}

export function clearPendingSourceSyncForUser(userId: string): void {
  try {
    getStorage().removeItem(keyForUser(userId));
  } catch {
    /* ignore */
  }
}

/** Owner-scoped index mapId → pending item (for UI without global boolean). */
export function pendingSourceSyncIndexByMapId(
  userId: string
): Record<string, PendingSourceSyncItem> {
  const out: Record<string, PendingSourceSyncItem> = {};
  for (const item of loadPendingSourceSync(userId)) {
    out[item.mapId] = item;
  }
  return out;
}

export function pendingItemFromOperation(args: {
  ids: PastedTextOperationIds;
  canonicalText: string;
  contentHash: string;
  title?: string;
  collectionId?: string;
}): Omit<PendingSourceSyncItem, 'updatedAt'> {
  return {
    mapId: args.ids.mapId,
    sourceId: args.ids.sourceId,
    sourceVersionId: args.ids.sourceVersionId,
    sourceRequestId: args.ids.sourceRequestId,
    canonicalText: args.canonicalText,
    contentHash: args.contentHash,
    title: args.title,
    collectionId: args.collectionId,
  };
}

export type SourceMetaPersistPatch = {
  persistStatus: PastedTextPersistStatus;
};

/**
 * Reconcile pending queue with history entries that carry sourceMeta.
 * Drops orphaned pending without a matching map entry; restores sync_failed on entries.
 */
export function reconcilePendingSourceSyncWithHistory(args: {
  userId: string;
  entries: Array<{
    id: string;
    sourceMeta?: {
      sourceRequestId?: string;
      persistStatus?: string;
    };
  }>;
}): {
  pendingByMapId: Record<string, PendingSourceSyncItem>;
  entriesNeedingSyncBanner: string[];
} {
  const pending = loadPendingSourceSync(args.userId);
  const entryById = new Map(args.entries.map((e) => [e.id, e]));
  const kept: PendingSourceSyncItem[] = [];
  const entriesNeedingSyncBanner: string[] = [];

  for (const item of pending) {
    const entry = entryById.get(item.mapId);
    if (!entry) continue;
    kept.push(item);
    entriesNeedingSyncBanner.push(item.mapId);
  }

  // Also surface entries already marked sync_failed in sourceMeta even if pending was lost.
  for (const entry of args.entries) {
    if (
      entry.sourceMeta?.persistStatus === 'sync_failed' &&
      !entriesNeedingSyncBanner.includes(entry.id)
    ) {
      entriesNeedingSyncBanner.push(entry.id);
    }
  }

  savePendingSourceSync(args.userId, kept);
  const pendingByMapId: Record<string, PendingSourceSyncItem> = {};
  for (const item of kept) {
    pendingByMapId[item.mapId] = item;
  }
  return { pendingByMapId, entriesNeedingSyncBanner };
}
