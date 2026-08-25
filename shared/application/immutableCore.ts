/**
 * Strip execution/review overlays so persist_application_plan only sees the immutable core.
 */

import type { ApplicationArtifactV1, ApplicationPlanStatus } from './types';
import { validateApplicationArtifact } from './validate';

export function immutablePlanStatusFromArtifact(
  artifact: ApplicationArtifactV1
): ApplicationPlanStatus {
  const s = artifact.plan.status;
  if (
    s === 'needs_context' ||
    s === 'abstained' ||
    s === 'provisional' ||
    s === 'ready'
  ) {
    return s;
  }
  // Overlays: recover compile-time status from artifact.status
  if (artifact.status === 'provisional') return 'provisional';
  if (artifact.status === 'needs_context') return 'needs_context';
  if (artifact.status === 'abstained') return 'abstained';
  return 'ready';
}

/**
 * Immutable plan core for RPC persist/replan — no startedAt, no review, no execution status.
 */
export function toImmutableApplicationArtifact(
  artifact: ApplicationArtifactV1
): ApplicationArtifactV1 {
  const planStatus = immutablePlanStatusFromArtifact(artifact);
  const artifactStatus =
    planStatus === 'provisional'
      ? ('provisional' as const)
      : planStatus === 'needs_context'
        ? ('needs_context' as const)
        : planStatus === 'abstained'
          ? ('abstained' as const)
          : ('complete' as const);

  const next: ApplicationArtifactV1 = {
    ...artifact,
    status: artifactStatus,
    plan: {
      ...artifact.plan,
      status: planStatus,
      startedAt: undefined,
    },
    review: null,
  };
  const validated = validateApplicationArtifact(next);
  return validated.ok ? validated.value : next;
}

export function applicationHasExecutionOverlay(artifact: ApplicationArtifactV1): boolean {
  return Boolean(artifact.plan.startedAt) || artifact.plan.status === 'in_progress';
}

export function applicationHasReviewOverlay(artifact: ApplicationArtifactV1): boolean {
  return artifact.review != null;
}
