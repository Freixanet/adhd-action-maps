/**
 * Coordination used by AppSessionContext for S06 cloud sync.
 * Tests must exercise this module — not only pure helpers.
 */

import type { ApplicationArtifactV1, ApplicationReviewV1 } from './types';
import { applicationPlanDigest } from './planDigest';
import {
  toImmutableApplicationArtifact,
  applicationHasExecutionOverlay,
  applicationHasReviewOverlay,
} from './immutableCore';
import {
  persistApplicationExecutionWithUserJwt,
  persistApplicationReviewWithUserJwt,
  persistApplicationWithUserJwt,
  replanApplicationWithUserJwt,
  type PersistApplicationArgs,
  type PersistApplicationResult,
} from './persistApplication';
import {
  pendingApplicationBannerMessage,
  removePendingApplicationOp,
  upsertPendingApplicationOp,
  type PendingApplicationOpKind,
} from '../pendingApplicationOps';

export type SyncApplicationCloudArgs = PersistApplicationArgs & {
  /** Digest of previously persisted active plan, if known. */
  previousPlanDigest?: string | null;
  /** When replan hits a started/reviewed plan, caller may set true after UI confirm. */
  confirmReplace?: boolean;
  onPending?: (kind: PendingApplicationOpKind, message: string) => void;
  onClearPending?: (kind: PendingApplicationOpKind) => void;
  /** Test/overrides — production uses module JWT helpers. */
  persistPlan?: typeof persistApplicationWithUserJwt;
  persistReplan?: typeof replanApplicationWithUserJwt;
  persistExecution?: typeof persistApplicationExecutionWithUserJwt;
  persistReview?: typeof persistApplicationReviewWithUserJwt;
};

export type SyncApplicationCloudResult = {
  plan: PersistApplicationResult | null;
  execution: PersistApplicationResult | null;
  review: PersistApplicationResult | null;
  /** True when syncCloudEntry must not leave a false plan pending after start/review. */
  usedCorrectRpcs: true;
};

/**
 * Persist overlays via their RPCs. Plan RPC only receives immutable core.
 * Never presents start/review overlays as a new plan.
 */
export async function syncApplicationCloudState(
  args: SyncApplicationCloudArgs
): Promise<SyncApplicationCloudResult> {
  const persistPlan = args.persistPlan ?? persistApplicationWithUserJwt;
  const persistReplan = args.persistReplan ?? replanApplicationWithUserJwt;
  const persistExecution = args.persistExecution ?? persistApplicationExecutionWithUserJwt;
  const persistReview = args.persistReview ?? persistApplicationReviewWithUserJwt;

  const core = toImmutableApplicationArtifact(args.application);
  const digest = applicationPlanDigest(core);
  const previous = args.previousPlanDigest ?? null;

  let planResult: PersistApplicationResult | null = null;

  if (previous && previous !== digest) {
    planResult = await persistReplan({
      ...args,
      application: core,
      previousDigest: previous,
      confirmReplace: args.confirmReplace,
    });
    if (planResult.ok === false) {
      if (planResult.code !== 'APPLICATION_AUTH_STALE') {
        upsertPendingApplicationOp(args.ownerId, {
          kind: 'replan',
          mapId: args.mapId,
          planDigest: digest,
          previousDigest: previous,
          confirmReplace: args.confirmReplace,
          awaitingConfirmation:
            planResult.code === 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION',
          immutableArtifact: core,
          sourceId: args.sourceId,
          sourceVersionId: args.sourceVersionId,
          contentHash: core.contentHash,
        });
        if (planResult.code !== 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION') {
          args.onPending?.('replan', pendingApplicationBannerMessage('replan'));
        }
      }
      return { plan: planResult, execution: null, review: null, usedCorrectRpcs: true };
    }
    removePendingApplicationOp(args.ownerId, 'replan', args.mapId, { planDigest: digest });
    args.onClearPending?.('replan');
  } else {
    planResult = await persistPlan({
      ...args,
      application: core,
    });
    if (planResult.ok === false) {
      if (
        planResult.code === 'APPLICATION_IDEMPOTENCY_CONFLICT' &&
        previous === null
      ) {
        // Active plan exists with different digest — escalate to replan path pending.
        upsertPendingApplicationOp(args.ownerId, {
          kind: 'replan',
          mapId: args.mapId,
          planDigest: digest,
          sourceId: args.sourceId,
          sourceVersionId: args.sourceVersionId,
          contentHash: core.contentHash,
        });
        args.onPending?.('replan', pendingApplicationBannerMessage('replan'));
      } else if (planResult.code !== 'APPLICATION_AUTH_STALE') {
        upsertPendingApplicationOp(args.ownerId, {
          kind: 'plan',
          mapId: args.mapId,
          planDigest: digest,
          sourceId: args.sourceId,
          sourceVersionId: args.sourceVersionId,
          contentHash: core.contentHash,
        });
        args.onPending?.('plan', pendingApplicationBannerMessage('plan'));
      }
      return { plan: planResult, execution: null, review: null, usedCorrectRpcs: true };
    }
    removePendingApplicationOp(args.ownerId, 'plan', args.mapId, { planDigest: digest });
    args.onClearPending?.('plan');
  }

  let executionResult: PersistApplicationResult | null = null;
  if (applicationHasExecutionOverlay(args.application) && args.application.plan.startedAt) {
    executionResult = await persistExecution({
      ...args,
      application: core,
      planDigest: digest,
      startedAt: args.application.plan.startedAt,
    });
    if (executionResult.ok === false) {
      if (executionResult.code !== 'APPLICATION_AUTH_STALE') {
        upsertPendingApplicationOp(args.ownerId, {
          kind: 'execution',
          mapId: args.mapId,
          planDigest: digest,
          startedAt: args.application.plan.startedAt,
          sourceId: args.sourceId,
          sourceVersionId: args.sourceVersionId,
          contentHash: core.contentHash,
        });
        args.onPending?.(
          'execution',
          pendingApplicationBannerMessage('execution')
        );
      }
    } else {
      removePendingApplicationOp(args.ownerId, 'execution', args.mapId, {
        startedAt: args.application.plan.startedAt,
        planDigest: digest,
      });
      args.onClearPending?.('execution');
    }
  }

  let reviewResult: PersistApplicationResult | null = null;
  if (applicationHasReviewOverlay(args.application) && args.application.review) {
    const review: ApplicationReviewV1 = args.application.review;
    reviewResult = await persistReview({
      ...args,
      application: core,
      planDigest: digest,
      review,
    });
    if (reviewResult.ok === false) {
      if (reviewResult.code !== 'APPLICATION_AUTH_STALE') {
        upsertPendingApplicationOp(args.ownerId, {
          kind: 'review',
          mapId: args.mapId,
          planDigest: digest,
          review,
          sourceId: args.sourceId,
          sourceVersionId: args.sourceVersionId,
          contentHash: core.contentHash,
        });
        args.onPending?.('review', pendingApplicationBannerMessage('review'));
      }
    } else {
      removePendingApplicationOp(args.ownerId, 'review', args.mapId, {
        reviewId: review.id,
        planDigest: digest,
      });
      args.onClearPending?.('review');
    }
  }

  return {
    plan: planResult,
    execution: executionResult,
    review: reviewResult,
    usedCorrectRpcs: true,
  };
}
