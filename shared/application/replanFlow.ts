/**
 * Productive replan coordinator used by AppSessionContext.
 * Stages P2 without replacing P1 until cloud accepts (or guest consolidates).
 */

import type { ApplicationArtifactV1 } from './types';
import { applicationPlanDigest } from './planDigest';
import { toImmutableApplicationArtifact } from './immutableCore';
import {
  replanApplicationWithUserJwt,
  type PersistApplicationArgs,
  type PersistApplicationResult,
} from './persistApplication';
import { resolvePreviousPlanDigest, setActivePlanDigest } from './activePlanDigestStore';

export type StagedReplanProposal = {
  mapId: string;
  previousArtifact: ApplicationArtifactV1;
  proposedArtifact: ApplicationArtifactV1;
  previousDigest: string;
  proposedDigest: string;
  sourceId?: string;
  sourceVersionId?: string;
  started?: boolean;
  hasReview?: boolean;
};

export function applicationLooksStartedOrReviewed(artifact: ApplicationArtifactV1): boolean {
  return Boolean(
    artifact.plan.startedAt ||
      artifact.review ||
      artifact.plan.status === 'in_progress' ||
      artifact.plan.status === 'completed' ||
      artifact.plan.status === 'abandoned'
  );
}

export type ReplanCoordinatorResult =
  | {
      status: 'consolidated';
      artifact: ApplicationArtifactV1;
      planDigest: string;
      replaced?: boolean;
      guest?: boolean;
    }
  | {
      status: 'requires_confirmation';
      staged: StagedReplanProposal;
    }
  | {
      status: 'conflict';
      message: string;
      code: string;
      activePlanDigest?: string;
      staged: StagedReplanProposal;
    }
  | { status: 'auth_stale'; staged: StagedReplanProposal }
  | { status: 'pending_sync'; staged: StagedReplanProposal; error: string }
  | { status: 'aborted'; reason: 'owner_changed' | 'cancelled' };

export function buildStagedReplan(args: {
  mapId: string;
  previousArtifact: ApplicationArtifactV1;
  proposedArtifact: ApplicationArtifactV1;
  userId?: string | null;
  memoryDigest?: string | null;
  sourceId?: string;
  sourceVersionId?: string;
}): StagedReplanProposal | { error: string } {
  const previousCore = toImmutableApplicationArtifact(args.previousArtifact);
  const proposedCore = toImmutableApplicationArtifact(args.proposedArtifact);
  const proposedDigest = applicationPlanDigest(proposedCore);
  const localPrevDigest = applicationPlanDigest(previousCore);
  const previousDigest = resolvePreviousPlanDigest({
    userId: args.userId,
    mapId: args.mapId,
    memoryDigest: args.memoryDigest,
    localActiveArtifactDigest: localPrevDigest,
  });
  if (!previousDigest) {
    return { error: 'No hay digest activo para comparar el replan (CAS).' };
  }
  if (previousDigest === proposedDigest) {
    return { error: 'La nueva adaptación coincide con el plan activo; no hay replan.' };
  }
  return {
    mapId: args.mapId,
    previousArtifact: args.previousArtifact,
    proposedArtifact: proposedCore,
    previousDigest,
    proposedDigest,
    sourceId: args.sourceId,
    sourceVersionId: args.sourceVersionId,
    started: applicationLooksStartedOrReviewed(args.previousArtifact),
    hasReview: Boolean(args.previousArtifact.review),
  };
}

/**
 * Attempt cloud replan with CAS. Does not mutate local active plan.
 * Confirmation-required is a typed state — never treated as network retry.
 */
export async function attemptCloudReplan(args: {
  staged: StagedReplanProposal;
  auth: Pick<PersistApplicationArgs, 'accessToken' | 'supabaseUrl' | 'supabaseAnonKey'>;
  ownerId: string;
  confirmReplace: boolean;
  isCurrent?: () => boolean;
  persistReplan?: typeof replanApplicationWithUserJwt;
}): Promise<ReplanCoordinatorResult> {
  if (args.isCurrent && !args.isCurrent()) {
    return { status: 'aborted', reason: 'owner_changed' };
  }

  // Local gate: started/reviewed without confirm → dialog, no pending retry.
  if (
    !args.confirmReplace &&
    applicationLooksStartedOrReviewed(args.staged.previousArtifact)
  ) {
    return {
      status: 'requires_confirmation',
      staged: {
        ...args.staged,
        started: true,
        hasReview: Boolean(args.staged.previousArtifact.review),
      },
    };
  }

  const persist = args.persistReplan ?? replanApplicationWithUserJwt;
  const result: PersistApplicationResult = await persist({
    ...args.auth,
    ownerId: args.ownerId,
    mapId: args.staged.mapId,
    sourceId: args.staged.sourceId,
    sourceVersionId: args.staged.sourceVersionId,
    application: args.staged.proposedArtifact,
    previousDigest: args.staged.previousDigest,
    confirmReplace: args.confirmReplace,
    isCurrent: args.isCurrent,
  });

  if (args.isCurrent && !args.isCurrent()) {
    return { status: 'aborted', reason: 'owner_changed' };
  }

  if (result.ok === true) {
    setActivePlanDigest(args.ownerId, args.staged.mapId, result.planDigest || args.staged.proposedDigest);
    return {
      status: 'consolidated',
      artifact: args.staged.proposedArtifact,
      planDigest: result.planDigest || args.staged.proposedDigest,
      replaced: result.replaced,
    };
  }

  if (result.code === 'APPLICATION_AUTH_STALE') {
    return { status: 'auth_stale', staged: args.staged };
  }

  if (result.code === 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION') {
    return {
      status: 'requires_confirmation',
      staged: {
        ...args.staged,
        started: result.started,
        hasReview: result.hasReview,
      },
    };
  }

  if (result.code === 'APPLICATION_IDEMPOTENCY_CONFLICT') {
    return {
      status: 'conflict',
      code: result.code,
      message:
        'Otro dispositivo ya cambió el plan activo. Recarga o vuelve a adaptar desde el plan actual.',
      activePlanDigest: result.activePlanDigest,
      staged: args.staged,
    };
  }

  return {
    status: 'pending_sync',
    staged: args.staged,
    error: result.error || 'No se pudo sincronizar el replan.',
  };
}

export function consolidateGuestReplan(staged: StagedReplanProposal): ReplanCoordinatorResult {
  return {
    status: 'consolidated',
    artifact: staged.proposedArtifact,
    planDigest: staged.proposedDigest,
    guest: true,
  };
}
