/**
 * Owner-scoped pending evidence-graph sync (S05).
 * Retries persistEvidenceWithUserJwt without re-running Gemini.
 */

import { getStorage } from './storage';
import { isUuidLike } from './pastedText';
import type { EvidenceArtifact } from './evidence/types';
import {
  persistEvidenceWithUserJwt,
  type PersistEvidenceArgs,
  type PersistEvidenceResult,
} from './evidence/persistEvidence';

export type PendingEvidenceSyncItem = {
  mapId: string;
  sourceId?: string;
  sourceVersionId?: string;
  contentHash?: string;
  updatedAt: number;
};

function keyForUser(userId: string): string {
  return `nucleo_pending_evidence_sync:user:${userId.trim()}`;
}

export function isValidPendingEvidenceSyncItem(
  item: unknown
): item is PendingEvidenceSyncItem {
  if (!item || typeof item !== 'object') return false;
  const row = item as PendingEvidenceSyncItem;
  return (
    typeof row.mapId === 'string' &&
    row.mapId.length > 0 &&
    (row.sourceId === undefined || isUuidLike(row.sourceId)) &&
    (row.sourceVersionId === undefined || isUuidLike(row.sourceVersionId)) &&
    (row.contentHash === undefined || typeof row.contentHash === 'string') &&
    typeof row.updatedAt === 'number'
  );
}

export function loadPendingEvidenceSync(userId: string): PendingEvidenceSyncItem[] {
  const id = userId.trim();
  if (!id) return [];
  try {
    const raw = getStorage().getItem(keyForUser(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPendingEvidenceSyncItem);
  } catch {
    return [];
  }
}

export function savePendingEvidenceSync(
  userId: string,
  items: PendingEvidenceSyncItem[]
): void {
  const id = userId.trim();
  if (!id) return;
  try {
    getStorage().setItem(
      keyForUser(id),
      JSON.stringify(items.filter(isValidPendingEvidenceSyncItem))
    );
  } catch {
    /* ignore */
  }
}

export function upsertPendingEvidenceSync(
  userId: string,
  item: Omit<PendingEvidenceSyncItem, 'updatedAt'>
): void {
  const nextItem: PendingEvidenceSyncItem = { ...item, updatedAt: Date.now() };
  if (!isValidPendingEvidenceSyncItem(nextItem)) return;
  const existing = loadPendingEvidenceSync(userId).filter((row) => row.mapId !== item.mapId);
  existing.push(nextItem);
  savePendingEvidenceSync(userId, existing);
}

export function removePendingEvidenceSync(userId: string, mapId: string): void {
  const id = userId.trim();
  if (!id || !mapId) return;
  savePendingEvidenceSync(
    id,
    loadPendingEvidenceSync(id).filter((row) => row.mapId !== mapId)
  );
}

export function getPendingEvidenceSyncForMap(
  userId: string,
  mapId: string
): PendingEvidenceSyncItem | null {
  return loadPendingEvidenceSync(userId).find((row) => row.mapId === mapId) ?? null;
}

export function clearPendingEvidenceSyncForUser(userId: string): void {
  try {
    getStorage().removeItem(keyForUser(userId));
  } catch {
    /* ignore */
  }
}

export function pendingEvidenceSyncIndexByMapId(
  userId: string
): Record<string, PendingEvidenceSyncItem> {
  const out: Record<string, PendingEvidenceSyncItem> = {};
  for (const item of loadPendingEvidenceSync(userId)) {
    out[item.mapId] = item;
  }
  return out;
}

/**
 * Drop orphaned pending (map deleted) and restore banner list.
 * Evidence is recovered from history session — never from a new Gemini call.
 */
export function reconcilePendingEvidenceSyncWithHistory(args: {
  userId: string;
  entries: Array<{
    id: string;
    sourceMeta?: { sourceId?: string; sourceVersionId?: string; contentHash?: string };
    session?: { data?: unknown };
  }>;
}): {
  pendingByMapId: Record<string, PendingEvidenceSyncItem>;
  entriesNeedingEvidenceBanner: string[];
} {
  const pending = loadPendingEvidenceSync(args.userId);
  const entryById = new Map(args.entries.map((e) => [e.id, e]));
  const kept: PendingEvidenceSyncItem[] = [];
  const entriesNeedingEvidenceBanner: string[] = [];

  for (const item of pending) {
    const entry = entryById.get(item.mapId);
    if (!entry) continue; // orphan map → drop
    const data = entry.session?.data as { evidence?: EvidenceArtifact } | undefined;
    if (!data?.evidence || data.evidence.status !== 'complete') continue;
    // Refresh source ids from entry when available (source sync may have completed).
    kept.push({
      ...item,
      sourceId: entry.sourceMeta?.sourceId || item.sourceId,
      sourceVersionId: entry.sourceMeta?.sourceVersionId || item.sourceVersionId,
      contentHash: entry.sourceMeta?.contentHash || item.contentHash,
      updatedAt: item.updatedAt,
    });
    entriesNeedingEvidenceBanner.push(item.mapId);
  }

  savePendingEvidenceSync(args.userId, kept);
  return {
    pendingByMapId: Object.fromEntries(kept.map((k) => [k.mapId, k])),
    entriesNeedingEvidenceBanner,
  };
}

export const EVIDENCE_SYNC_PENDING_MESSAGE = 'Sincronización de evidencia pendiente';

export type FlushEvidenceSyncArgs = {
  userId: string;
  mapId: string;
  /** Evidence recovered from maps.session / history — never regenerated. */
  evidence: EvidenceArtifact;
  sourceId?: string;
  sourceVersionId?: string;
  contentHash?: string;
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  isCurrent: () => boolean;
};

/**
 * Retry one pending evidence sync. Removes pending only after complete persist.
 */
export async function flushPendingEvidenceSync(
  args: FlushEvidenceSyncArgs
): Promise<PersistEvidenceResult> {
  if (!args.isCurrent()) {
    return {
      ok: false,
      status: 409,
      error: 'Auth snapshot stale',
      code: 'EVIDENCE_AUTH_STALE',
    };
  }

  const persistArgs: PersistEvidenceArgs = {
    accessToken: args.accessToken,
    supabaseUrl: args.supabaseUrl,
    supabaseAnonKey: args.supabaseAnonKey,
    ownerId: args.userId,
    mapId: args.mapId,
    sourceId: args.sourceId,
    sourceVersionId: args.sourceVersionId,
    evidence: args.evidence,
    contentHash: args.contentHash,
    isCurrent: args.isCurrent,
  };

  const result = await persistEvidenceWithUserJwt(persistArgs);
  if (result.ok) {
    removePendingEvidenceSync(args.userId, args.mapId);
  }
  return result;
}
