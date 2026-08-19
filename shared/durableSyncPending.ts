/**
 * Durable owner-scoped pending capture for ordered persist.
 * Does not read React state — safe during hydrate before setState flushes.
 */

import { getPendingEvidenceSyncForMap } from './pendingEvidenceSync';
import { getPendingPdfSourceSyncForMap } from './pendingPdfSourceSync';
import { getPendingProgressSyncForMap } from './pendingProgressSync';
import { getPendingSourceSyncForMap } from './pendingSourceSync';

export type DurableSyncPendingSnapshot = {
  sourcePending: boolean;
  evidencePending: boolean;
  progressPending: boolean;
};

/**
 * Read durable queues for one owner + map.
 * Source = pasted OR PDF pending. Evidence / progress = their owner queues.
 */
export function captureDurableSyncPending(
  ownerId: string,
  mapId: string
): DurableSyncPendingSnapshot {
  const owner = ownerId.trim();
  const map = mapId.trim();
  if (!owner || !map) {
    return {
      sourcePending: false,
      evidencePending: false,
      progressPending: false,
    };
  }
  return {
    sourcePending: Boolean(
      getPendingPdfSourceSyncForMap(owner, map) ||
        getPendingSourceSyncForMap(owner, map)
    ),
    evidencePending: Boolean(getPendingEvidenceSyncForMap(owner, map)),
    progressPending: Boolean(getPendingProgressSyncForMap(owner, map)),
  };
}

export function hasAnyDurableSyncPending(
  snap: DurableSyncPendingSnapshot
): boolean {
  return snap.sourcePending || snap.evidencePending || snap.progressPending;
}
