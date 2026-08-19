/**
 * Typed results for ordered persist orchestration (source → evidence → progress).
 */

export type PersistStepKind = 'source' | 'evidence' | 'progress' | 'application' | 'ordered';

export type PersistStepStatus =
  | 'success'
  | 'not_pending'
  | 'blocked'
  | 'failed'
  | 'stale'
  | 'cancelled'
  | 'busy';

export type PersistStepResult = {
  status: PersistStepStatus;
  kind: PersistStepKind;
  ownerId: string;
  mapId: string;
  /** Machine code — never tokens/PII. */
  code?: string | null;
};

export type SyncFailureRecord = {
  ownerId: string;
  mapId: string;
  kind: Exclude<PersistStepKind, 'ordered'>;
  code: string;
};

/** True when source is cloud-confirmed / not in durable queue. */
export function sourceAllowsEvidence(result: PersistStepResult): boolean {
  return result.status === 'success' || result.status === 'not_pending';
}

/** Stop the ordered chain — do not run later steps. */
export function shouldStopAfterStep(result: PersistStepResult): boolean {
  return (
    result.status === 'failed' ||
    result.status === 'stale' ||
    result.status === 'cancelled' ||
    result.status === 'busy' ||
    result.status === 'blocked'
  );
}

/**
 * Whether this result should become the DEV/actionable failure code.
 * EVIDENCE_WAITING_SOURCE is coordination state, not a new root cause.
 */
export function isActionablePersistFailure(result: PersistStepResult): boolean {
  if (result.status !== 'failed' && result.status !== 'stale') return false;
  if (result.code === 'EVIDENCE_WAITING_SOURCE') return false;
  return Boolean(result.code);
}

export function toSyncFailureRecord(
  result: PersistStepResult
): SyncFailureRecord | null {
  if (!isActionablePersistFailure(result) || !result.code) return null;
  if (result.kind === 'ordered') return null;
  return {
    ownerId: result.ownerId,
    mapId: result.mapId,
    kind: result.kind,
    code: result.code,
  };
}

export type SyncSavingTarget = {
  ownerId: string;
  mapId: string;
};

/** Active-map saving flags — never leak map A's in-flight op onto map B. */
export function resolveActiveSyncSaving(args: {
  saving: SyncSavingTarget | null;
  ownerId: string | null | undefined;
  mapId: string | null | undefined;
}): boolean {
  if (!args.saving || !args.ownerId || !args.mapId) return false;
  return args.saving.ownerId === args.ownerId && args.saving.mapId === args.mapId;
}

/** Active-map DEV panel: only show failure for matching owner + map. */
export function resolveActiveSyncFailureCode(args: {
  failure: SyncFailureRecord | null;
  ownerId: string | null | undefined;
  mapId: string | null | undefined;
}): string | null {
  if (!args.failure || !args.ownerId || !args.mapId) return null;
  if (args.failure.ownerId !== args.ownerId) return null;
  if (args.failure.mapId !== args.mapId) return null;
  return args.failure.code;
}
