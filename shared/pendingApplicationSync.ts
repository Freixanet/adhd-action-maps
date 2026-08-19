/**
 * Owner-scoped pending application-plan sync (S06).
 * Retries persistApplicationWithUserJwt without re-running Gemini.
 */

import { getStorage } from './storage';
import { isUuidLike } from './pastedText';
import type { ApplicationArtifactV1 } from './application/types';
import {
  persistApplicationWithUserJwt,
  type PersistApplicationArgs,
  type PersistApplicationResult,
} from './application/persistApplication';

export type PendingApplicationSyncItem = {
  mapId: string;
  sourceId?: string;
  sourceVersionId?: string;
  contentHash?: string;
  updatedAt: number;
};

function keyForUser(userId: string): string {
  return `nucleo_pending_application_sync:user:${userId.trim()}`;
}

export function isValidPendingApplicationSyncItem(
  item: unknown
): item is PendingApplicationSyncItem {
  if (!item || typeof item !== 'object') return false;
  const row = item as PendingApplicationSyncItem;
  return (
    typeof row.mapId === 'string' &&
    row.mapId.length > 0 &&
    (row.sourceId === undefined || isUuidLike(row.sourceId)) &&
    (row.sourceVersionId === undefined || isUuidLike(row.sourceVersionId)) &&
    (row.contentHash === undefined || typeof row.contentHash === 'string') &&
    typeof row.updatedAt === 'number'
  );
}

export function loadPendingApplicationSync(userId: string): PendingApplicationSyncItem[] {
  const id = userId.trim();
  if (!id) return [];
  try {
    const raw = getStorage().getItem(keyForUser(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPendingApplicationSyncItem);
  } catch {
    return [];
  }
}

export function savePendingApplicationSync(
  userId: string,
  items: PendingApplicationSyncItem[]
): void {
  const id = userId.trim();
  if (!id) return;
  try {
    getStorage().setItem(
      keyForUser(id),
      JSON.stringify(items.filter(isValidPendingApplicationSyncItem))
    );
  } catch {
    /* ignore */
  }
}

export function upsertPendingApplicationSync(
  userId: string,
  item: Omit<PendingApplicationSyncItem, 'updatedAt'>
): void {
  const nextItem: PendingApplicationSyncItem = { ...item, updatedAt: Date.now() };
  if (!isValidPendingApplicationSyncItem(nextItem)) return;
  const existing = loadPendingApplicationSync(userId).filter((row) => row.mapId !== item.mapId);
  existing.push(nextItem);
  savePendingApplicationSync(userId, existing);
}

export function removePendingApplicationSync(userId: string, mapId: string): void {
  const id = userId.trim();
  if (!id || !mapId) return;
  savePendingApplicationSync(
    id,
    loadPendingApplicationSync(id).filter((row) => row.mapId !== mapId)
  );
}

export function clearPendingApplicationSyncForUser(userId: string): void {
  try {
    getStorage().removeItem(keyForUser(userId.trim()));
  } catch {
    /* ignore */
  }
}

export type FlushApplicationSyncDeps = {
  getApplicationForMap: (mapId: string) => ApplicationArtifactV1 | null;
  persist?: typeof persistApplicationWithUserJwt;
  isCurrent?: () => boolean;
};

export async function flushPendingApplicationSync(
  userId: string,
  auth: Pick<PersistApplicationArgs, 'accessToken' | 'supabaseUrl' | 'supabaseAnonKey'>,
  deps: FlushApplicationSyncDeps
): Promise<{ flushed: string[]; failed: string[] }> {
  const persist = deps.persist ?? persistApplicationWithUserJwt;
  const pending = loadPendingApplicationSync(userId);
  const flushed: string[] = [];
  const failed: string[] = [];

  for (const item of pending) {
    if (deps.isCurrent && !deps.isCurrent()) break;
    const application = deps.getApplicationForMap(item.mapId);
    if (!application) {
      removePendingApplicationSync(userId, item.mapId);
      continue;
    }
    const result: PersistApplicationResult = await persist({
      ...auth,
      ownerId: userId,
      mapId: item.mapId,
      sourceId: item.sourceId,
      sourceVersionId: item.sourceVersionId,
      application,
      isCurrent: deps.isCurrent,
    });
    if (result.ok) {
      removePendingApplicationSync(userId, item.mapId);
      flushed.push(item.mapId);
    } else if (result.ok === false && result.code === 'APPLICATION_AUTH_STALE') {
      failed.push(item.mapId);
      break;
    } else {
      failed.push(item.mapId);
    }
  }
  return { flushed, failed };
}

export const APPLICATION_SYNC_PENDING_MESSAGE =
  'Sincronización del plan de aplicación pendiente';

