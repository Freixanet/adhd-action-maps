/**
 * Attach a user review to an application artifact without rewriting source/evidence.
 */

import { stableReviewId } from './ids';
import type {
  ApplicationArtifactV1,
  ApplicationReviewOutcome,
  ApplicationReviewV1,
} from './types';
import { validateApplicationArtifact } from './validate';

export function buildApplicationReview(args: {
  artifact: ApplicationArtifactV1;
  outcome: ApplicationReviewOutcome;
  privateNote?: string;
  failedAssumptionId?: string;
  wantsAdjust?: boolean;
  wantsRepeat?: boolean;
  reviewedAt?: string;
}): ApplicationReviewV1 {
  const reviewedAt = args.reviewedAt ?? new Date().toISOString();
  return {
    id: stableReviewId(
      `${args.artifact.plan.id}|${args.artifact.contextCanonicalHash}`,
      reviewedAt
    ),
    outcome: args.outcome,
    privateNote: args.privateNote?.trim().slice(0, 1000) || undefined,
    failedAssumptionId: args.failedAssumptionId,
    wantsAdjust: Boolean(args.wantsAdjust),
    wantsRepeat: Boolean(args.wantsRepeat),
    reviewedAt,
  };
}

export function attachApplicationReview(
  artifact: ApplicationArtifactV1,
  review: ApplicationReviewV1
): ApplicationArtifactV1 | null {
  const nextStatus =
    review.outcome === 'abandoned'
      ? ('complete' as const)
      : artifact.status === 'provisional'
        ? ('provisional' as const)
        : ('complete' as const);
  const planStatus =
    review.outcome === 'abandoned'
      ? ('abandoned' as const)
      : ('completed' as const);
  const next: ApplicationArtifactV1 = {
    ...artifact,
    status: nextStatus,
    plan: { ...artifact.plan, status: planStatus },
    review,
  };
  const validated = validateApplicationArtifact(next);
  return validated.ok ? validated.value : null;
}
