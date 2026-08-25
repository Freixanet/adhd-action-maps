/**
 * Owner-scoped pending application REVIEW sync (separate from plan pending).
 * Retries persistApplicationReviewWithUserJwt without Gemini.
 */

import { getStorage } from './storage';
import { isUuidLike } from './pastedText';
import type { ApplicationArtifactV1, ApplicationReviewV1 } from './application/types';
import {
  persistApplicationReviewWithUserJwt,
  type PersistApplicationArgs,
  type PersistApplicationResult,
} from './application/persistApplication';
import { applicationPlanDigest } from './application/planDigest';

export type PendingApplicationReviewSyncItem = {
  mapId: string;
  planDigest: string;
  review: ApplicationReviewV1;
  sourceId?: string;
  sourceVersionId?: string;
  updatedAt: number;
};

function keyForUser(userId: string): string {
  return `nucleo_pending_application_review_sync:user:${userId.trim()}`;
}

export function isValidPendingApplicationReviewSyncItem(
  item: unknown
): item is PendingApplicationReviewSyncItem {
  if (!item || typeof item !== 'object') return false;
  const row = item as PendingApplicationReviewSyncItem;
  return (
    typeof row.mapId === 'string' &&
    row.mapId.length > 0 &&
    typeof row.planDigest === 'string' &&
    row.planDigest.length > 0 &&
    row.review != null &&
    typeof row.review === 'object' &&
    typeof (row.review as ApplicationReviewV1).id === 'string' &&
    typeof row.updatedAt === 'number' &&
    (row.sourceId === undefined || isUuidLike(row.sourceId)) &&
    (row.sourceVersionId === undefined || isUuidLike(row.sourceVersionId))
  );
}

export function loadPendingApplicationReviewSync(
  userId: string
): PendingApplicationReviewSyncItem[] {
  const id = userId.trim();
  if (!id) return [];
  try {
    const raw = getStorage().getItem(keyForUser(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPendingApplicationReviewSyncItem);
  } catch {
    return [];
  }
}

export function savePendingApplicationReviewSync(
  userId: string,
  items: PendingApplicationReviewSyncItem[]
): void {
  const id = userId.trim();
  if (!id) return;
  try {
    getStorage().setItem(
      keyForUser(id),
      JSON.stringify(items.filter(isValidPendingApplicationReviewSyncItem))
    );
  } catch {
    /* ignore */
  }
}

export function upsertPendingApplicationReviewSync(
  userId: string,
  item: Omit<PendingApplicationReviewSyncItem, 'updatedAt'>
): void {
  const nextItem: PendingApplicationReviewSyncItem = { ...item, updatedAt: Date.now() };
  if (!isValidPendingApplicationReviewSyncItem(nextItem)) return;
  const existing = loadPendingApplicationReviewSync(userId).filter(
    (row) => row.mapId !== item.mapId || row.review.id !== item.review.id
  );
  existing.push(nextItem);
  savePendingApplicationReviewSync(userId, existing);
}

export function removePendingApplicationReviewSync(
  userId: string,
  mapId: string,
  reviewId?: string
): void {
  const id = userId.trim();
  if (!id || !mapId) return;
  savePendingApplicationReviewSync(
    id,
    loadPendingApplicationReviewSync(id).filter((row) => {
      if (row.mapId !== mapId) return true;
      if (reviewId && row.review.id !== reviewId) return true;
      return false;
    })
  );
}

export function clearPendingApplicationReviewSyncForUser(userId: string): void {
  try {
    getStorage().removeItem(keyForUser(userId.trim()));
  } catch {
    /* ignore */
  }
}

export async function flushPendingApplicationReviewSync(
  userId: string,
  auth: Pick<PersistApplicationArgs, 'accessToken' | 'supabaseUrl' | 'supabaseAnonKey'>,
  deps: {
    getApplicationForMap: (mapId: string) => ApplicationArtifactV1 | null;
    persist?: typeof persistApplicationReviewWithUserJwt;
    isCurrent?: () => boolean;
  }
): Promise<{ flushed: string[]; failed: string[] }> {
  const persist = deps.persist ?? persistApplicationReviewWithUserJwt;
  const pending = loadPendingApplicationReviewSync(userId);
  const flushed: string[] = [];
  const failed: string[] = [];

  for (const item of pending) {
    if (deps.isCurrent && !deps.isCurrent()) break;
    const application = deps.getApplicationForMap(item.mapId);
    if (!application?.review) {
      removePendingApplicationReviewSync(userId, item.mapId, item.review.id);
      continue;
    }
    const digest = item.planDigest || applicationPlanDigest(application);
    const result: PersistApplicationResult = await persist({
      ...auth,
      ownerId: userId,
      mapId: item.mapId,
      sourceId: item.sourceId,
      sourceVersionId: item.sourceVersionId,
      application,
      planDigest: digest,
      review: application.review,
      isCurrent: deps.isCurrent,
    });
    if (result.ok) {
      removePendingApplicationReviewSync(userId, item.mapId, item.review.id);
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

export const APPLICATION_REVIEW_SYNC_PENDING_MESSAGE =
  'Revisión pendiente de sincronizar';
