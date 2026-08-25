/**
 * S05 Evidence — runtime contracts.
 *
 * Distinctions (do not conflate):
 * - chunkId present → addressing (can open a fragment if citedChunks has text)
 * - Citation → opens exact ingest text
 * - EvidenceLink → claim ↔ segment relation after verification
 * - verified → "this source supports this representation" (NOT external world-truth)
 */

import type { EpistemicStatus, EvidenceRelation, VerifierStatus } from '../domainContracts/types';

export type {
  EpistemicStatus,
  EvidenceRelation,
  VerifierStatus,
} from '../domainContracts/types';

export type ClaimType =
  | 'thesis'
  | 'factual'
  | 'numeric'
  | 'causal'
  | 'comparative'
  | 'definition'
  | 'recommendation'
  | 'interpretation'
  | 'limitation'
  | 'example';

export type ClaimCriticality = 'critical' | 'important' | 'auxiliary';

/** Presentation after policy — never leave critical claims as pending. */
export type ClaimPresentationStatus =
  | 'verified'
  | 'qualified'
  | 'contradicted'
  | 'degraded'
  | 'insufficient'
  | 'inference'
  | 'pending';

export type AbstentionReasonCode =
  | 'NO_ANCHOR'
  | 'NO_ENTAILMENT'
  | 'NUMERIC_MISMATCH'
  | 'NAME_MISMATCH'
  | 'DATE_MISMATCH'
  | 'UNIT_MISMATCH'
  | 'SIGN_MISMATCH'
  | 'NEGATION_INVERTED'
  | 'MODALITY_UPGRADED'
  | 'CAUSALITY_UPGRADED'
  | 'QUALIFIER_DROPPED'
  | 'CONTRADICTORY_CHUNKS'
  | 'INSUFFICIENT_CONTEXT'
  | 'HALLUCINATED_CHUNK'
  | 'CROSS_VERSION_CHUNK'
  | 'PROVIDER_ERROR'
  | 'PARTIAL_SOURCE'
  | 'INJECTION_IGNORED'
  | 'INFERENCE_NOT_SOURCE';

export type CheckCode =
  | 'NUMERIC_OK'
  | 'NUMERIC_FAIL'
  | 'PERCENT_OK'
  | 'PERCENT_FAIL'
  | 'SIGN_OK'
  | 'SIGN_FAIL'
  | 'RANGE_OK'
  | 'RANGE_FAIL'
  | 'CURRENCY_OK'
  | 'CURRENCY_FAIL'
  | 'UNIT_OK'
  | 'UNIT_FAIL'
  | 'DATE_OK'
  | 'DATE_FAIL'
  | 'NAME_OK'
  | 'NAME_FAIL'
  | 'NEGATION_OK'
  | 'NEGATION_FAIL'
  | 'QUANTIFIER_OK'
  | 'QUANTIFIER_FAIL'
  | 'MODALITY_OK'
  | 'MODALITY_FAIL'
  | 'CAUSALITY_OK'
  | 'CAUSALITY_FAIL'
  | 'ENTAILMENT_SUPPORTS'
  | 'ENTAILMENT_QUALIFIES'
  | 'ENTAILMENT_CONTRADICTS'
  | 'ENTAILMENT_INSUFFICIENT'
  | 'ENTAILMENT_ERROR';

export type ContentClaim = {
  id: string;
  unitId?: string;
  text: string;
  claimType: ClaimType;
  criticality: ClaimCriticality;
  epistemicStatus: EpistemicStatus;
  presentationStatus: ClaimPresentationStatus;
  evidenceLinkIds: string[];
  abstentionCodes: AbstentionReasonCode[];
  /** Slot key used for stable id (not free-form model text). */
  slotKey: string;
  /** Optional presentation rewrite after qualification/degradation. */
  presentationText?: string;
  /**
   * Stable structural bindings to map surfaces (slot/index/id).
   * applyEvidenceToMap uses these — not exact claim.text search/replace.
   */
  surfaces?: ClaimSurfaceBinding[];
};

/** Where a claim decision must rewrite the compiled map. */
export type ClaimSurfaceBinding =
  | { kind: 'title' }
  | { kind: 'coreIdea' }
  | { kind: 'coreSupport' }
  | { kind: 'layer0.what' }
  | { kind: 'layer0.why' }
  | { kind: 'layer0.action'; index: number }
  | { kind: 'tldr'; index: number }
  | { kind: 'step.prose'; unitId: string; sentenceIndex: number }
  | { kind: 'step.caution'; unitId: string; index: number }
  | { kind: 'step.example'; unitId: string; index: number }
  /** @deprecated Prefer callout + comparison relationId bindings. */
  | { kind: 'step.relation'; unitId: string; toUnitId: string; relKind: string }
  /** Conexión callout keyed by stable compile relationId. */
  | { kind: 'step.relation.callout'; unitId: string; relationId: string }
  /** Comparison table row keyed by the same relationId. */
  | { kind: 'step.relation.comparison'; unitId: string; relationId: string }
  | { kind: 'knowledge'; unitId: string; sentenceIndex: number }
  | { kind: 'closure.summary'; sentenceIndex: number }
  | { kind: 'closure.takeaway'; index: number }
  | { kind: 'coverage.limit'; index: number };

export type EvidenceLinkV1 = {
  id: string;
  contentNodeId: string;
  /** Internal segment id when known; may equal chunkId for pasted text. */
  segmentId: string;
  chunkId: string;
  relation: EvidenceRelation;
  verifierStatus: VerifierStatus;
  epistemicStatus: EpistemicStatus;
  /** Always null until real calibration exists. */
  confidence: null;
  verifierVersion: string;
  checkCodes: CheckCode[];
  abstentionCodes: AbstentionReasonCode[];
};

export type EntailmentDecision =
  | 'supports'
  | 'contradicts'
  | 'qualifies'
  | 'insufficient';

export type EvidenceAssessment = {
  claimId: string;
  allowedChunkIdsUsed: string[];
  entailment: EntailmentDecision | null;
  contradiction: boolean;
  qualifierPreservation: boolean | null;
  negationPreservation: boolean | null;
  numericOk: boolean | null;
  nameOk: boolean | null;
  dateOk: boolean | null;
  unitOk: boolean | null;
  relation: EvidenceRelation | null;
  verifierStatus: VerifierStatus;
  epistemicStatus: EpistemicStatus;
  abstentionCodes: AbstentionReasonCode[];
  checkCodes: CheckCode[];
  schemaVersion: string;
  promptVersion: string;
  verifierVersion: string;
  modelVersion: string;
  modelRoute: string;
};

export type EvidenceCoverage = {
  criticalTotal: number;
  verified: number;
  qualified: number;
  contradicted: number;
  degraded: number;
  uncertain: number;
  unanchored: number;
  inference: number;
  /** Exact derived counts only — never invented percentages. */
  summaryLines: string[];
};

export type SourceCoverageHonest = {
  textual: number | null;
  extractionConfidence: number | null;
  isComplete: boolean | null;
  limitations: Array<{ code: string; detail: string }>;
};

export type EvidenceArtifact = {
  schemaVersion: string;
  promptVersion: string;
  verifierVersion: string;
  compilerVersion: string;
  modelVersion: string;
  modelRoute: string;
  status: 'complete' | 'partial' | 'failed';
  claims: ContentClaim[];
  links: EvidenceLinkV1[];
  assessments: EvidenceAssessment[];
  evidenceCoverage: EvidenceCoverage;
  sourceCoverage: SourceCoverageHonest;
};

export type EvidenceEngineErrorCode =
  | 'EVIDENCE_EXTRACT_FAILED'
  | 'EVIDENCE_VERIFY_FAILED'
  | 'EVIDENCE_CRITICAL_PENDING'
  | 'EVIDENCE_CANCELLED'
  | 'EVIDENCE_HALLUCINATED_CHUNK';
