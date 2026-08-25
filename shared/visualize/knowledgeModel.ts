import type { EvidenceRef, SourceSegment } from './sourceSegments';

export type RelationType =
  | 'causes'
  | 'increases'
  | 'decreases'
  | 'enables'
  | 'prevents'
  | 'precedes'
  | 'contrasts-with'
  | 'contains'
  | 'correlates-with';

export type RelationModality = 'asserted' | 'possible' | 'probable' | 'conditional';

export type KnowledgeConcept = {
  id: string;
  label: string;
  summary?: string;
  evidence: EvidenceRef[];
};

export type SemanticRelation = {
  id: string;
  from: string;
  to: string;
  type: RelationType;
  modality: RelationModality;
  label?: string;
  evidence: EvidenceRef[];
  confidence: number;
};

export type KnowledgeComparison = {
  id: string;
  entities: string[];
  dimensions: string[];
  evidence: EvidenceRef[];
};

export type KnowledgeSequence = {
  id: string;
  steps: string[];
  evidence: EvidenceRef[];
};

export type KnowledgeModel = {
  thesis: string;
  thesisEvidence: EvidenceRef[];
  concepts: KnowledgeConcept[];
  relations: SemanticRelation[];
  sequences: KnowledgeSequence[];
  comparisons: KnowledgeComparison[];
  uncertainties: string[];
  /** Segment catalog for this run — not the full original source. */
  segments: SourceSegment[];
};

export type CognitiveTaskKind =
  | 'understand-causality'
  | 'compare-regimes'
  | 'follow-process'
  | 'explore-branching'
  | 'absorb-overview';

export type CognitiveTaskResult = {
  primary: CognitiveTaskKind;
  secondary: CognitiveTaskKind[];
  rationale: string;
};

export const CAUSAL_RELATION_TYPES: ReadonlySet<RelationType> = new Set([
  'causes',
  'increases',
  'decreases',
  'enables',
  'prevents',
]);

export function conceptById(model: KnowledgeModel): Map<string, KnowledgeConcept> {
  return new Map(model.concepts.map((c) => [c.id, c]));
}

export function allEvidenceRefs(model: KnowledgeModel): EvidenceRef[] {
  const refs: EvidenceRef[] = [...model.thesisEvidence];
  for (const c of model.concepts) refs.push(...c.evidence);
  for (const r of model.relations) refs.push(...r.evidence);
  for (const s of model.sequences) refs.push(...s.evidence);
  for (const c of model.comparisons) refs.push(...c.evidence);
  return refs;
}
