import type { SourceSegment } from './sourceSegments';
import type { StrategySelection, VisualStrategy } from './visualStrategy';
import type { RenderSpec } from './visualizationPlan';
import type { KnowledgeModel, CognitiveTaskResult } from './knowledgeModel';
import type { VerifierReport } from './verifiers';
import type { PrePlanScore, PostPlanScore } from './scoring';

export type VisualizationStatus = 'complete' | 'degraded' | 'failed';

/** What is stored on ActionMapData / SavedSession — keep small. */
export type PersistedVisualizationRun = {
  schemaVersion: 2;
  pipelineVersion: string;
  rendererSpecVersion: string;
  runId: string;
  status: VisualizationStatus;
  selection: StrategySelection;
  renderSpec: RenderSpec;
  warnings: string[];
  usedEvidence: SourceSegment[];
};

/** Server/DEV only — never persist into MapRecord history. */
export type VisualizationRunDebug = {
  knowledge: KnowledgeModel;
  tasks: CognitiveTaskResult;
  candidates: Array<{
    strategy: VisualStrategy;
    prePlan?: PrePlanScore;
    postPlan?: PostPlanScore;
    total?: number;
  }>;
  verifierReports: VerifierReport[];
  repairHistory: RepairAttempt[];
  telemetry: PipelineTelemetry[];
};

export type RepairAction =
  | 'retry-knowledge'
  | 'repair-plan'
  | 'select-next-candidate'
  | 'prune-secondary-elements'
  | 'simplify-interactions'
  | 'use-guided-reading'
  | 'runtime-v1-fallback';

export type FailureClass = 'knowledge' | 'plan' | 'cognitive' | 'structural';

export type RepairAttempt = {
  at: string;
  failureClass: FailureClass;
  action: RepairAction;
  detail?: string;
};

export type PipelineTelemetry = {
  stage: string;
  durationMs: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  retries: number;
  result: 'pass' | 'fail' | 'fallback';
};

export const PIPELINE_VERSION = 'visualize-v2.0.0-slice1';
export const RENDERER_SPEC_VERSION = 'render-spec-1';
export const PROMPT_VERSION = 'viz-prompts-slice1';

export const REPAIR_POLICY: Record<FailureClass, RepairAction[]> = {
  knowledge: ['retry-knowledge', 'runtime-v1-fallback'],
  plan: ['repair-plan', 'select-next-candidate', 'use-guided-reading'],
  cognitive: ['select-next-candidate', 'use-guided-reading'],
  structural: [
    'prune-secondary-elements',
    'simplify-interactions',
    'select-next-candidate',
    'use-guided-reading',
  ],
};
