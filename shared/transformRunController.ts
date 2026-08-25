/**
 * Isolated transform-run controller (S03 reopen).
 * Same spirit as ActiveAuthController: immutable per-run identity + abort.
 *
 * Policy when identity changes mid-run (A → B): discard silently —
 * never consolidate A's result into B's UI/history/partition.
 *
 * Identity vs credentials:
 * - Matching uses stable `userId` (session identity), NOT credential epoch.
 * - Routine token refresh for the same user does NOT stale the run.
 * - Sign-out, guest↔auth, or A→B DOES stale the run.
 */

import type { ImmutableAuthSnapshot } from './cloudMutationExecutor';
import type { PastedTextOperationIds } from './pastedText';

export type TransformTextMode = 'ask' | 'source';

/** Auth captured at begin — epoch kept for diagnostics; matching uses userId only. */
export type TransformRunAuth = {
  userId: string;
  accessToken: string;
  /** Credential epoch at begin (diagnostic; not used for staleness). */
  epoch: number;
};

export type TransformRunSnapshot = {
  runId: number;
  mapId: string;
  sourceId?: string;
  sourceVersionId?: string;
  sourceRequestId?: string;
  textMode?: TransformTextMode;
  /** Captured auth at begin(); null for guest. */
  auth: TransformRunAuth | null;
};

export type BeginTransformRunInput = {
  mapId: string;
  sourceId?: string;
  sourceVersionId?: string;
  sourceRequestId?: string;
  textMode?: TransformTextMode;
  auth: ImmutableAuthSnapshot | null;
};

export function createTransformRunController() {
  let seq = 0;
  let active: {
    snapshot: TransformRunSnapshot;
    abort: AbortController;
  } | null = null;

  function bumpAbortPrevious() {
    if (active) {
      try {
        active.abort.abort();
      } catch {
        /* ignore */
      }
    }
  }

  return {
    get runId(): number | null {
      return active?.snapshot.runId ?? null;
    },
    get snapshot(): TransformRunSnapshot | null {
      return active ? { ...active.snapshot } : null;
    },
    get signal(): AbortSignal | null {
      return active?.abort.signal ?? null;
    },

    /**
     * Start a new run. Aborts any previous run first.
     * Must be called before the first await of the transform pipeline.
     */
    begin(input: BeginTransformRunInput): {
      snapshot: TransformRunSnapshot;
      signal: AbortSignal;
    } {
      bumpAbortPrevious();
      seq += 1;
      const abort = new AbortController();
      const snapshot: TransformRunSnapshot = {
        runId: seq,
        mapId: input.mapId,
        sourceId: input.sourceId,
        sourceVersionId: input.sourceVersionId,
        sourceRequestId: input.sourceRequestId,
        textMode: input.textMode,
        auth: input.auth
          ? {
              epoch: input.auth.epoch,
              userId: input.auth.userId,
              accessToken: input.auth.accessToken,
            }
          : null,
      };
      active = { snapshot, abort };
      return { snapshot: { ...snapshot }, signal: abort.signal };
    },

    isCurrent(runId: number): boolean {
      return active !== null && active.snapshot.runId === runId && !active.abort.signal.aborted;
    },

    /**
     * True while this run is active AND session identity still matches.
     * Compares userId only — token refresh (new epoch, same user) keeps the run.
     */
    isCurrentForAuth(
      runId: number,
      currentAuth: { userId: string; epoch?: number } | null
    ): boolean {
      if (!this.isCurrent(runId) || !active) return false;
      const snapAuth = active.snapshot.auth;
      if (snapAuth === null) {
        return currentAuth === null;
      }
      if (currentAuth === null) return false;
      return snapAuth.userId === currentAuth.userId;
    },

    cancel(): void {
      if (!active) return;
      try {
        active.abort.abort();
      } catch {
        /* ignore */
      }
    },

    /** Clear active pointer after settle (does not abort). */
    clearIf(runId: number): void {
      if (active?.snapshot.runId === runId) {
        active = null;
      }
    },
  };
}

export type TransformRunController = ReturnType<typeof createTransformRunController>;

export function operationIdsFromRun(
  snapshot: TransformRunSnapshot
): PastedTextOperationIds | null {
  if (
    !snapshot.sourceId ||
    !snapshot.sourceVersionId ||
    !snapshot.sourceRequestId ||
    !snapshot.mapId
  ) {
    return null;
  }
  return {
    mapId: snapshot.mapId,
    sourceId: snapshot.sourceId,
    sourceVersionId: snapshot.sourceVersionId,
    sourceRequestId: snapshot.sourceRequestId,
  };
}
