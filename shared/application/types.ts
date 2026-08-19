/**
 * S06 Application — runtime contracts (strict, versioned).
 *
 * Distinctions (must stay visible in UI, not only in metadata):
 * - sourceBasis → what the source affirms or recommends
 * - inference → Núcleo transfer reasoning
 * - adaptation → change proposed for this user's context
 */

import type { ClaimPresentationStatus } from '../evidence/types';

export type ApplicationPlanStatus =
  | 'needs_context'
  | 'provisional'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'abstained';

export type RelevanceLevel = 'high' | 'medium' | 'low';
export type EffortLevel = 'low' | 'medium' | 'high';
export type ReversibilityLevel = 'high' | 'medium' | 'low';
export type AdaptationRisk =
  | 'low'
  | 'moderate'
  | 'high_medical'
  | 'high_psychological'
  | 'high_legal'
  | 'high_financial'
  | 'high_physical';

export type ApplicationContextV1 = {
  /** Sought outcome — user-authored; never invent. */
  goal?: string;
  /** Relevant situation — user-authored. */
  situation?: string;
  /** Main constraint — user-authored. */
  constraint?: string;
  /** When / horizon for the action — user-authored. */
  horizon?: string;
  /** Optional extra constraints. */
  optionalConstraints?: string[];
};

export type ApplicationCandidateV1 = {
  id: string;
  claimId: string;
  sourceVersionId?: string;
  evidenceLinkIds: string[];
  epistemicStatus: ClaimPresentationStatus;
  relevance: RelevanceLevel;
  relevanceReason: string;
  effort: EffortLevel;
  reversibility: ReversibilityLevel;
  risksOrLimits: string[];
  /** Short label derived from claim text — not a free model title as ID. */
  label: string;
  claimText: string;
};

export type ApplicationAssumptionV1 = {
  id: string;
  text: string;
  /** True when Núcleo invented a reversible default because context was thin. */
  editable: boolean;
  source: 'user' | 'nucleo_default';
};

export type ApplicationActionV1 = {
  id: string;
  /** Must start with a verb. */
  verbLedInstruction: string;
  whenOrTrigger: string;
  durationOrScope: string;
  obstacle: string;
  mitigation: string;
  successCriterion: string;
  stopOrChangeCriterion: string;
};

export type ApplicationReviewOutcome =
  | 'worked'
  | 'partial'
  | 'did_not_work'
  | 'abandoned';

export type ApplicationReviewV1 = {
  id: string;
  outcome: ApplicationReviewOutcome;
  /** Private user note — never telemetry. */
  privateNote?: string;
  failedAssumptionId?: string;
  wantsAdjust: boolean;
  wantsRepeat: boolean;
  reviewedAt: string;
};

export type ApplicationPlanV1 = {
  id: string;
  status: ApplicationPlanStatus;
  selectedCandidateId: string | null;
  sourceBasis: string;
  inference: string;
  adaptation: string;
  assumptions: ApplicationAssumptionV1[];
  action: ApplicationActionV1 | null;
  reviewTrigger: string;
  reviewQuestions: string[];
  risk: AdaptationRisk;
  abstentionReason?: string;
  needsContextPrompt?: string;
  /** Chunk ids used for sourceBasis viewing — not world-truth. */
  sourceChunkIds: string[];
  /** S06 execution — not S07 progress system. */
  startedAt?: string;
};

export type ApplicationArtifactStatus =
  | 'complete'
  | 'needs_context'
  | 'provisional'
  | 'abstained'
  | 'invalid'
  | 'cancelled';

export type ApplicationArtifactV1 = {
  schemaVersion: string;
  promptVersion: string;
  compilerVersion: string;
  policyVersion: string;
  modelVersion: string;
  modelRoute: string;
  status: ApplicationArtifactStatus;
  contentHash: string;
  sourceId?: string;
  sourceVersionId?: string;
  depth: string;
  contextCanonicalHash: string;
  /** Digests/pins that must invalidate cache when S04/S05 change. */
  understandingSchemaVersion?: string;
  understandingPromptVersion?: string;
  understandingCompilerVersion?: string;
  evidenceSchemaVersion?: string;
  evidencePromptVersion?: string;
  evidenceVerifierVersion?: string;
  evidenceCompilerVersion?: string;
  evidenceDigest?: string;
  context: ApplicationContextV1;
  candidates: ApplicationCandidateV1[];
  plan: ApplicationPlanV1;
  review: ApplicationReviewV1 | null;
  createdAt: string;
};

export type ApplicationEngineErrorCode =
  | 'APPLICATION_CANCELLED'
  | 'APPLICATION_INSUFFICIENT_SOURCE'
  | 'APPLICATION_NO_SAFE_BASE'
  | 'APPLICATION_NEEDS_CONTEXT'
  | 'APPLICATION_INVALID_PLAN'
  | 'APPLICATION_REPAIR_FAILED'
  | 'APPLICATION_PROVIDER_ERROR'
  | 'APPLICATION_COMPILE_FAILED'
  | 'APPLICATION_GENERIC_ADVICE'
  | 'APPLICATION_HIGH_RISK_ABSTAIN'
  | 'APPLICATION_POLICY_REJECT';

export type ApplicationTelemetryEvent = {
  schemaVersion: string;
  promptVersion: string;
  compilerVersion: string;
  policyVersion: string;
  modelVersion: string;
  stage: string;
  durationMs: number;
  depth: string;
  intent: 'apply';
  validationFailed?: boolean;
  repairUsed?: boolean;
  cancelled?: boolean;
  cacheHit?: boolean;
  errorCode?: string;
  /** Never include personal context text. */
  contextHashPresent: boolean;
};
