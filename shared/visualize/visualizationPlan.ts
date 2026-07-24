import type { EvidenceRef } from './sourceSegments';
import type { RelationType } from './knowledgeModel';
import type { VisualStrategy } from './visualStrategy';

export type PlanElementRole = 'primary' | 'secondary';

export type PlanElement = {
  id: string;
  label: string;
  description?: string;
  role: PlanElementRole;
  conceptId?: string;
  visible?: boolean;
  evidence?: EvidenceRef[];
};

export type PlanRelationship = {
  id: string;
  from: string;
  to: string;
  semanticType: RelationType;
  label: string;
  evidence: EvidenceRef[];
};

export type InteractionPurpose =
  | 'compare-state'
  | 'reveal-branch'
  | 'step-through'
  | 'inspect-detail';

export type PlanInteraction = {
  id: string;
  purpose: InteractionPurpose;
  label: string;
  targets: string[];
};

export type VisualizationPlan = {
  strategy: VisualStrategy;
  title: string;
  expectedInsight: string;
  elements: PlanElement[];
  relationships: PlanRelationship[];
  interactions?: PlanInteraction[];
  readingOrder: string[];
  assumptions: string[];
  excludedDetails: string[];
};

export type RenderSpecBase = {
  type: VisualStrategy;
  title: string;
  insight: string;
  warnings?: string[];
};

export type CausalChainRenderSpec = RenderSpecBase & {
  type: 'causal-chain';
  steps: Array<{
    id: string;
    label: string;
    detail?: string;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    label: string;
    semanticType: RelationType;
  }>;
};

export type GuidedReadingRenderSpec = RenderSpecBase & {
  type: 'guided-reading';
  nucleus: { id: string; label: string; detail?: string };
  ideas: Array<{ id: string; label: string; detail?: string }>;
  example?: { id: string; label: string; detail?: string };
  check?: { id: string; prompt: string };
};

/** Slice 1; extend as other renderers ship. */
export type RenderSpec = CausalChainRenderSpec | GuidedReadingRenderSpec;
