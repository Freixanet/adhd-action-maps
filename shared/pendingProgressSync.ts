import type { HistoryEntry } from './history';
import { getStorage } from './storage';

export const PROGRESS_SYNC_PENDING_MESSAGE =
  'Avance guardado en este dispositivo. Se sincronizará cuando vuelva la conexión.';

export type PendingProgressSyncItem = {
  mapId: string;
  entryUpdatedAt: number;
  queuedAt: number;
};

function keyFor(userId: string): string {
  return `nucleo_pending_progress_sync:user:${userId.trim()}`;
}

function validItem(value: unknown): value is PendingProgressSyncItem {
  const item = value as PendingProgressSyncItem;
  return Boolean(
    item &&
      typeof item.mapId === 'string' &&
      item.mapId.trim() &&
      Number.isFinite(item.entryUpdatedAt) &&
      item.entryUpdatedAt >= 0 &&
      Number.isFinite(item.queuedAt) &&
      item.queuedAt >= 0
  );
}

export function loadPendingProgressSync(userId: string): PendingProgressSyncItem[] {
  if (!userId.trim()) return [];
  try {
    const raw = getStorage().getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(validItem) : [];
  } catch {
    return [];
  }
}

function save(userId: string, items: PendingProgressSyncItem[]): void {
  try {
    if (!items.length) {
      getStorage().removeItem(keyFor(userId));
      return;
    }
    getStorage().setItem(keyFor(userId), JSON.stringify(items));
  } catch {
    // The history itself remains the durable local source when queue storage is full.
  }
}

export function upsertPendingProgressSync(
  userId: string,
  entry: Pick<HistoryEntry, 'id' | 'updatedAt'>
): void {
  if (!userId.trim() || !entry.id.trim()) return;
  const current = loadPendingProgressSync(userId);
  const next: PendingProgressSyncItem = {
    mapId: entry.id,
    entryUpdatedAt: entry.updatedAt,
    queuedAt: Date.now(),
  };
  const without = current.filter((item) => item.mapId !== entry.id);
  save(userId, [...without, next]);
}

export function removePendingProgressSync(userId: string, mapId: string): void {
  if (!userId.trim() || !mapId.trim()) return;
  save(
    userId,
    loadPendingProgressSync(userId).filter((item) => item.mapId !== mapId)
  );
}

export function clearPendingProgressSyncForUser(userId: string): void {
  if (!userId.trim()) return;
  try {
    getStorage().removeItem(keyFor(userId));
  } catch {
    // Best effort during account deletion.
  }
}

export function pendingProgressSyncIndex(
  userId: string
): Record<string, PendingProgressSyncItem> {
  return Object.fromEntries(
    loadPendingProgressSync(userId).map((item) => [item.mapId, item])
  );
}

export function getPendingProgressSyncForMap(
  userId: string,
  mapId: string
): PendingProgressSyncItem | null {
  const id = mapId.trim();
  if (!userId.trim() || !id) return null;
  return loadPendingProgressSync(userId).find((item) => item.mapId === id) ?? null;
}

export async function flushPendingProgressSync(args: {
  userId: string;
  /** When set, only flush this map — never the whole owner queue. */
  mapId?: string;
  getEntry: (mapId: string) => HistoryEntry | null;
  push: (entry: HistoryEntry) => Promise<void>;
  isCurrent: () => boolean;
}): Promise<{ synced: string[]; failed: string[]; stale: boolean }> {
  const pending = loadPendingProgressSync(args.userId).filter(
    (item) => !args.mapId || item.mapId === args.mapId
  );
  const synced: string[] = [];
  const failed: string[] = [];

  for (const item of pending) {
    if (!args.isCurrent()) return { synced, failed, stale: true };
    const entry = args.getEntry(item.mapId);
    if (!entry) {
      removePendingProgressSync(args.userId, item.mapId);
      continue;
    }
    // A newer local entry supersedes the queued timestamp; always send the
    // newest complete session rather than reconstructing a stale snapshot.
    try {
      await args.push(entry);
      if (!args.isCurrent()) return { synced, failed, stale: true };
      removePendingProgressSync(args.userId, item.mapId);
      synced.push(item.mapId);
    } catch {
      failed.push(item.mapId);
    }
  }

  return { synced, failed, stale: false };
}
