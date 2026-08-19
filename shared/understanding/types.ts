/**
 * S04 Understanding Engine — runtime contracts (strict, versioned).
 */

import type { MapDepth, MapIntent } from '../contracts';

export type SourceGenre =
  | 'explanatory'
  | 'argumentative'
  | 'narrative'
  | 'procedural'
  | 'reference'
  | 'mixed'
  | 'unknown';

export type DiscourseStructure =
  | 'causal'
  | 'conceptual'
  | 'comparative'
  | 'chronological'
  | 'problem_solution'
  | 'procedural'
  | 'mixed'
  | 'unknown';

export type ScopeKnown = 'complete' | 'partial' | 'unknown';

export type UnitRole =
  | 'thesis'
  | 'concept'
  | 'cause'
  | 'mechanism'
  | 'relation'
  | 'evidence_described'
  | 'example'
  | 'counterargument'
  | 'caution'
  | 'limitation'
  | 'synthesis';

/** Citation to a supplied chunk — never verified in S04 (S05). */
export type PendingSegmentRef = {
  chunkId: string;
  status: 'pending';
};

export type UnderstandingClassification = {
  genre: SourceGenre;
  discourseStructure: DiscourseStructure;
  language: string;
  scopeKnown: ScopeKnown;
  /** Free-text uncertainties; never invent numeric confidence. */
  uncertainties: string[];
};

export type UnderstandingPlan = {
  centralQuestion: string;
  /** Thesis or purpose; use 'unknown' when the source does not state one. */
  thesisOrPurpose: string | 'unknown';
  /** Ordered unit intents the model must cover (titles or role hints). */
  unitOrder: string[];
  relationsToPreserve: Array<{ from: string; to: string; kind: string }>;
  /** Cautions / limits / objections that must not be dropped. */
  mustKeep: string[];
  excludedNoise: Array<{ item: string; reason: string }>;
};

/** One essential idea for «En 60 segundos»: short title + two-line subtitle. */
export type EssentialIdeaItem = {
  title: string;
  desc: string;
};

export type UnderstandingEssential = {
  nuclearIdea: string;
  /** Exactly 3 by default; 4 only when a fourth idea is indispensable. Never >4. */
  essentialIdeas: EssentialIdeaItem[];
  limitsOrConditions: string[];
  /** Explicit non-claims: what the source does not affirm. */
  doesNotClaim: string[];
  /** Compact synthesis for Layer0.what / coreIdea. */
  layer0Synthesis: string;
  /** Why it matters; verb-led for Layer0.why. */
  layer0Why: string;
  /** Three checkable next actions for Layer0. */
  layer0Actions: [string, string, string];
};

export type UnderstandingUnit = {
  id: string;
  title: string;
  role: UnitRole;
  explanation: string;
  relations: Array<{ id?: string; toUnitId: string; kind: string }>;
  examples: string[];
  cautions: string[];
  segmentRefs: PendingSegmentRef[];
  /** True when the source cannot fill this unit completely. */
  incomplete: boolean;
  incompleteReason?: string;
};

export type UnderstandingClosure = {
  finalSynthesis: string;
  mainLearnings: string[];
  openQuestions: string[];
  reviewPrompt: string;
  comprehensionLimits: string[];
};

export type UnderstandingBlueprint = {
  classification: UnderstandingClassification;
  plan: UnderstandingPlan;
  essential: UnderstandingEssential;
};

export type UnderstandingArtifactStatus =
  | 'complete'
  | 'essential_only'
  | 'invalid'
  | 'cancelled';

export type UnderstandingArtifact = {
  schemaVersion: string;
  promptVersion: string;
  compilerVersion: string;
  modelVersion: string;
  intent: 'understand';
  depth: MapDepth;
  status: UnderstandingArtifactStatus;
  sourceId?: string;
  sourceVersionId?: string;
  contentHash?: string;
  blueprint: UnderstandingBlueprint;
  units: UnderstandingUnit[];
  closure: UnderstandingClosure | null;
};

export type UnderstandingEngineErrorCode =
  | 'UNDERSTAND_INVALID_BLUEPRINT'
  | 'UNDERSTAND_INVALID_UNITS'
  | 'UNDERSTAND_INVALID_CLOSURE'
  | 'UNDERSTAND_REPAIR_FAILED'
  | 'UNDERSTAND_CANCELLED'
  | 'UNDERSTAND_INSUFFICIENT_SOURCE'
  | 'UNDERSTAND_HALLUCINATED_CHUNK'
  | 'UNDERSTAND_COMPILE_FAILED';

export type UnderstandingEngineError = {
  ok: false;
  code: UnderstandingEngineErrorCode;
  message: string;
  /** Valid essential may still be returned when units fail after essential_ready. */
  essentialOnly?: {
    blueprint: UnderstandingBlueprint;
    partialArtifact: UnderstandingArtifact;
  };
};

export type UnderstandingEngineOk = {
  ok: true;
  artifact: UnderstandingArtifact;
  repaired: boolean;
  cacheHit: boolean;
  timingsMs: {
    blueprint: number;
    units: number;
    total: number;
    essentialReadyAt?: number;
  };
};

export type UnderstandingEngineResult = UnderstandingEngineOk | UnderstandingEngineError;

export type UnderstandingTelemetryEvent = {
  schemaVersion: string;
  promptVersion: string;
  modelVersion: string;
  stage: 'blueprint' | 'units' | 'repair' | 'compile' | 'cache';
  durationMs: number;
  unitCount?: number;
  validationFailed?: boolean;
  repairUsed?: boolean;
  cancelled?: boolean;
  cacheHit?: boolean;
  errorCode?: UnderstandingEngineErrorCode;
  depth: MapDepth;
  intent: MapIntent;
};
