export type { SourceSegment, EvidenceRef, EvidenceSupport } from './sourceSegments';
export {
  segmentSourceText,
  indexSegmentsById,
  collectUsedEvidence,
} from './sourceSegments';

export type {
  KnowledgeModel,
  KnowledgeConcept,
  SemanticRelation,
  KnowledgeComparison,
  KnowledgeSequence,
  CognitiveTaskResult,
  CognitiveTaskKind,
  RelationType,
  RelationModality,
} from './knowledgeModel';
export {
  CAUSAL_RELATION_TYPES,
  conceptById,
  allEvidenceRefs,
} from './knowledgeModel';

export type {
  VisualStrategy,
  SelectionReason,
  StrategySelection,
} from './visualStrategy';
export { SLICE_STRATEGIES, FIRST_LIBRARY_STRATEGIES } from './visualStrategy';

export type { StructuralBudget, RendererCapability } from './rendererCapabilities';
export { RENDERER_CAPABILITIES, getRendererCapability } from './rendererCapabilities';

export type { StrategyEligibility } from './eligibility';
export {
  evaluateEligibility,
  eligibleStrategies,
  rejectedReasons,
} from './eligibility';

export type { PrePlanScore, PostPlanScore } from './scoring';
export {
  scorePrePlan,
  rankPrePlan,
  scorePostPlan,
  postPlanTotal,
  hardGatePrePlan,
  hardGatePostPlan,
  buildCausalChainPlan,
} from './scoring';

export { buildGuidedReadingPlan } from './guidedReadingPlan';

export type {
  VisualizationPlan,
  PlanElement,
  PlanRelationship,
  PlanInteraction,
  InteractionPurpose,
  RenderSpec,
  CausalChainRenderSpec,
  GuidedReadingRenderSpec,
} from './visualizationPlan';

export { planToRenderSpec } from './planToRenderSpec';

export type { VerifierIssue, VerifierReport } from './verifiers';
export {
  verifyEvidenceIntegrity,
  verifySupportConsistency,
  verifyStructuralBudget,
  verifyCognitiveFit,
  knowledgeGroundingRatio,
} from './verifiers';

export type {
  PersistedVisualizationRun,
  VisualizationRunDebug,
  VisualizationStatus,
  RepairAction,
  FailureClass,
  RepairAttempt,
  PipelineTelemetry,
} from './types';
export {
  PIPELINE_VERSION,
  RENDERER_SPEC_VERSION,
  PROMPT_VERSION,
  REPAIR_POLICY,
} from './types';

export type {
  CompileVisualizationInput,
  CompileVisualizationResult,
} from './compileVisualizationRun';
export { compileVisualizationRun } from './compileVisualizationRun';

export {
  FIXTURE_SOURCE,
  FIXTURE_SEGMENTS,
  FIXTURE_CAUSAL_KNOWLEDGE,
  FIXTURE_CAUSAL_TASKS,
  FIXTURE_FLAT_KNOWLEDGE,
  FIXTURE_FLAT_TASKS,
  FIXTURE_BROKEN_EVIDENCE,
} from './fixtures/slice1';

/** Narrow persisted run for ActionMapData / mapData. */
export function normalizePersistedVisualizationRun(
  input: unknown
): import('./types').PersistedVisualizationRun | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as import('./types').PersistedVisualizationRun;
  if (raw.schemaVersion !== 2) return null;
  if (!raw.renderSpec || !raw.selection || !raw.runId) return null;
  const type = raw.renderSpec.type;
  if (type !== 'causal-chain' && type !== 'guided-reading') return null;
  return {
    schemaVersion: 2,
    pipelineVersion: String(raw.pipelineVersion || ''),
    rendererSpecVersion: String(raw.rendererSpecVersion || ''),
    runId: String(raw.runId),
    status:
      raw.status === 'degraded' || raw.status === 'failed' ? raw.status : 'complete',
    selection: raw.selection,
    renderSpec: raw.renderSpec,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    usedEvidence: Array.isArray(raw.usedEvidence)
      ? raw.usedEvidence
          .filter((s) => s && typeof s === 'object' && typeof s.id === 'string')
          .map((s) => ({
            id: String(s.id),
            text: String(s.text || ''),
            startOffset: s.startOffset,
            endOffset: s.endOffset,
            section: s.section,
          }))
      : [],
  };
}
