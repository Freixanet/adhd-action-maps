/**
 * Canonical digest for application plan persistence (server recomputes conceptually;
 * client sends digest derived from validated artifact for idempotency key).
 */

import { sha256Hex } from '../sha256Hex';
import type { ApplicationArtifactV1 } from './types';

/**
 * Digest of the immutable plan core.
 * Excludes execution overlays (status transitions, startedAt) and review
 * so a review/start cannot break exact retry of the original plan persist.
 */
export function applicationPlanDigest(artifact: ApplicationArtifactV1): string {
  const plan = artifact.plan;
  const canon = [
    artifact.schemaVersion,
    artifact.promptVersion,
    artifact.compilerVersion,
    artifact.policyVersion,
    artifact.modelRoute,
    artifact.contentHash,
    artifact.contextCanonicalHash,
    artifact.evidenceDigest ?? '',
    artifact.sourceId ?? '',
    artifact.sourceVersionId ?? '',
    artifact.depth,
    plan.id,
    plan.selectedCandidateId ?? '',
    plan.sourceBasis,
    plan.inference,
    plan.adaptation,
    plan.risk,
    plan.reviewTrigger,
    JSON.stringify(plan.reviewQuestions),
    JSON.stringify(plan.assumptions),
    JSON.stringify(plan.action),
    JSON.stringify(plan.sourceChunkIds),
  ].join('\u0001');
  return sha256Hex(canon);
}
