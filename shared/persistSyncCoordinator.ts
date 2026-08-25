/**
 * Ordered persist coordinator: source → evidence → progress.
 * Testable extraction — AppSessionContext supplies step runners.
 */

import { PersistRetryGate } from './persistRetryGate';
import {
  isActionablePersistFailure,
  sourceAllowsEvidence,
  shouldStopAfterStep,
  type PersistStepResult,
} from './persistStepResult';
import { orderedSyncRetryPlan } from './syncNotice';

export type OrderedPersistMode = 'auto' | 'manual';

export type OrderedPersistDeps = {
  ownerId: string;
  mapId: string;
  gate: PersistRetryGate;
  mode: OrderedPersistMode;
  sourcePending: boolean;
  evidencePending: boolean;
  progressPending: boolean;
  persistSource: () => Promise<PersistStepResult>;
  persistEvidence: () => Promise<PersistStepResult>;
  persistProgress: () => Promise<PersistStepResult>;
};

export type OrderedPersistOutcome = {
  ran: boolean;
  steps: PersistStepResult[];
  /** First failed/stale step with an actionable code (never EVIDENCE_WAITING_SOURCE alone). */
  firstActionableFailure: PersistStepResult | null;
};

function busyResult(
  ownerId: string,
  mapId: string
): PersistStepResult {
  return {
    status: 'busy',
    kind: 'ordered',
    ownerId,
    mapId,
    code: 'ORDERED_BUSY',
  };
}

/**
 * Run source → evidence → progress for one owner+map.
 * Evidence runs only after source success/not_pending.
 * Progress runs only after prior required steps finished successfully.
 */
export async function runOrderedPersistSync(
  deps: OrderedPersistDeps
): Promise<OrderedPersistOutcome> {
  const begin =
    deps.mode === 'auto'
      ? deps.gate.tryBeginAuto.bind(deps.gate)
      : deps.gate.tryBeginManual.bind(deps.gate);

  if (!begin(deps.ownerId, deps.mapId, 'ordered')) {
    return {
      ran: false,
      steps: [busyResult(deps.ownerId, deps.mapId)],
      firstActionableFailure: null,
    };
  }

  const steps: PersistStepResult[] = [];
  let firstActionableFailure: PersistStepResult | null = null;
  let sourceConfirmed = !deps.sourcePending;
  let evidenceSettled = !deps.evidencePending;

  try {
    const plan = orderedSyncRetryPlan({
      sourcePending: deps.sourcePending,
      evidencePending: deps.evidencePending,
      progressPending: deps.progressPending,
    });

    for (const kind of plan) {
      if (kind === 'source') {
        const result = await deps.persistSource();
        steps.push(result);
        if (sourceAllowsEvidence(result)) {
          sourceConfirmed = true;
          continue;
        }
        if (isActionablePersistFailure(result)) {
          firstActionableFailure = firstActionableFailure ?? result;
        }
        // failed / stale / cancelled / busy / blocked — stop before evidence
        break;
      }

      if (kind === 'evidence') {
        if (!sourceConfirmed) {
          // Do not invoke evidence; do not promote WAITING_SOURCE over a source failure.
          steps.push({
            status: 'blocked',
            kind: 'evidence',
            ownerId: deps.ownerId,
            mapId: deps.mapId,
            code: 'EVIDENCE_WAITING_SOURCE',
          });
          break;
        }
        const result = await deps.persistEvidence();
        steps.push(result);
        if (result.status === 'success' || result.status === 'not_pending') {
          evidenceSettled = true;
          continue;
        }
        if (
          result.status === 'blocked' &&
          result.code === 'EVIDENCE_WAITING_SOURCE'
        ) {
          // Coordination — not a root-cause replacement for SOURCE/PDF codes.
          break;
        }
        if (isActionablePersistFailure(result)) {
          firstActionableFailure = firstActionableFailure ?? result;
        }
        if (shouldStopAfterStep(result)) break;
        continue;
      }

      if (kind === 'progress') {
        if (!sourceConfirmed || (deps.evidencePending && !evidenceSettled)) {
          steps.push({
            status: 'blocked',
            kind: 'progress',
            ownerId: deps.ownerId,
            mapId: deps.mapId,
            code: 'PROGRESS_WAITING_PRIOR',
          });
          break;
        }
        const result = await deps.persistProgress();
        steps.push(result);
        if (isActionablePersistFailure(result)) {
          firstActionableFailure = firstActionableFailure ?? result;
        }
        if (shouldStopAfterStep(result)) break;
      }
    }

    return { ran: true, steps, firstActionableFailure };
  } finally {
    deps.gate.end(deps.ownerId, deps.mapId, 'ordered');
  }
}
