import type { EvidenceRef, SourceSegment } from './sourceSegments';
import { indexSegmentsById } from './sourceSegments';
import {
  allEvidenceRefs,
  type KnowledgeModel,
  type RelationModality,
  type SemanticRelation,
} from './knowledgeModel';
import type { StructuralBudget } from './rendererCapabilities';
import type { VisualizationPlan } from './visualizationPlan';

export type VerifierIssue = {
  code: string;
  message: string;
  path?: string;
};

export type VerifierReport = {
  name: string;
  pass: boolean;
  issues: VerifierIssue[];
};

function offsetsValid(seg: SourceSegment, sourceLength?: number): boolean {
  if (seg.startOffset == null && seg.endOffset == null) return true;
  if (seg.startOffset == null || seg.endOffset == null) return false;
  if (seg.startOffset < 0 || seg.endOffset <= seg.startOffset) return false;
  if (sourceLength != null && seg.endOffset > sourceLength) return false;
  return true;
}

/** Deterministic: IDs, offsets, non-empty fragments, evidence present. Not entailment. */
export function verifyEvidenceIntegrity(
  model: KnowledgeModel,
  options?: { sourceLength?: number }
): VerifierReport {
  const issues: VerifierIssue[] = [];
  const byId = indexSegmentsById(model.segments);

  for (const seg of model.segments) {
    if (!seg.id || !seg.text.trim()) {
      issues.push({
        code: 'empty-segment',
        message: `Segmento vacío o sin id: ${seg.id || '(missing)'}`,
        path: seg.id,
      });
    }
    if (!offsetsValid(seg, options?.sourceLength)) {
      issues.push({
        code: 'invalid-offsets',
        message: `Offsets inválidos en ${seg.id}`,
        path: seg.id,
      });
    }
  }

  const checkRefs = (refs: EvidenceRef[], path: string) => {
    if (refs.length === 0) {
      issues.push({
        code: 'missing-evidence',
        message: `Falta evidencia en ${path}`,
        path,
      });
      return;
    }
    for (const ref of refs) {
      const seg = byId.get(ref.segmentId);
      if (!seg) {
        issues.push({
          code: 'unknown-segment',
          message: `segmentId inexistente: ${ref.segmentId}`,
          path,
        });
      } else if (!seg.text.trim()) {
        issues.push({
          code: 'empty-cited-segment',
          message: `Segmento citado vacío: ${ref.segmentId}`,
          path,
        });
      }
    }
  };

  checkRefs(model.thesisEvidence, 'thesis');
  for (const c of model.concepts) checkRefs(c.evidence, `concept:${c.id}`);
  for (const r of model.relations) checkRefs(r.evidence, `relation:${r.id}`);
  for (const s of model.sequences) checkRefs(s.evidence, `sequence:${s.id}`);
  for (const c of model.comparisons) checkRefs(c.evidence, `comparison:${c.id}`);

  return { name: 'EvidenceIntegrityVerifier', pass: issues.length === 0, issues };
}

function modalityAllowsSupport(
  modality: RelationModality,
  support: EvidenceRef['support']
): boolean {
  if (support === 'contradicted') return false;
  if (modality === 'asserted' && support === 'inferred') return false;
  return true;
}

/**
 * Modality / graph invariants. Does NOT claim full textual entailment.
 * v2 verifies integrity + consistency, not that a paragraph entails a claim.
 */
export function verifySupportConsistency(model: KnowledgeModel): VerifierReport {
  const issues: VerifierIssue[] = [];
  const conceptIds = new Set(model.concepts.map((c) => c.id));

  for (const r of model.relations) {
    if (!conceptIds.has(r.from) || !conceptIds.has(r.to)) {
      issues.push({
        code: 'dangling-relation',
        message: `Relación ${r.id} apunta a conceptos inexistentes`,
        path: r.id,
      });
    }
    for (const ref of r.evidence) {
      if (!modalityAllowsSupport(r.modality, ref.support)) {
        issues.push({
          code: 'modality-support-mismatch',
          message: `Relación ${r.id} (${r.modality}) no puede usar support=${ref.support}`,
          path: r.id,
        });
      }
      if (ref.support === 'contradicted') {
        issues.push({
          code: 'contradicted-as-support',
          message: `Relación ${r.id} no puede sustentarse en evidencia contradicted`,
          path: r.id,
        });
      }
    }
  }

  // Internal contradictions: A causes B asserted AND A prevents B asserted
  const key = (r: SemanticRelation) => `${r.from}|${r.to}`;
  const byPair = new Map<string, SemanticRelation[]>();
  for (const r of model.relations) {
    const k = key(r);
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k)!.push(r);
  }
  for (const [pair, list] of byPair) {
    const types = new Set(list.filter((r) => r.modality === 'asserted').map((r) => r.type));
    if (types.has('causes') && types.has('prevents')) {
      issues.push({
        code: 'internal-contradiction',
        message: `Contradicción asserted causes/prevents en ${pair}`,
        path: pair,
      });
    }
    if (types.has('increases') && types.has('decreases')) {
      issues.push({
        code: 'internal-contradiction',
        message: `Contradicción asserted increases/decreases en ${pair}`,
        path: pair,
      });
    }
  }

  return { name: 'SupportConsistencyVerifier', pass: issues.length === 0, issues };
}

export function knowledgeGroundingRatio(model: KnowledgeModel): number {
  const refs = allEvidenceRefs(model);
  if (refs.length === 0) return 0;
  const byId = indexSegmentsById(model.segments);
  const grounded = refs.filter((r) => {
    const seg = byId.get(r.segmentId);
    return Boolean(seg?.text.trim()) && r.support !== 'contradicted';
  }).length;
  return grounded / refs.length;
}

export function verifyStructuralBudget(
  plan: VisualizationPlan,
  budget: StructuralBudget
): VerifierReport {
  const issues: VerifierIssue[] = [];
  const primary = plan.elements.filter((e) => e.role === 'primary');
  const secondary = plan.elements.filter((e) => e.role === 'secondary');

  if (primary.length > budget.maxPrimaryElements) {
    issues.push({
      code: 'max-primary',
      message: `Demasiados elementos primarios (${primary.length} > ${budget.maxPrimaryElements})`,
    });
  }
  if (secondary.length > budget.maxSecondaryElements) {
    issues.push({
      code: 'max-secondary',
      message: `Demasiados elementos secundarios (${secondary.length} > ${budget.maxSecondaryElements})`,
    });
  }
  if (plan.title.length > budget.maxTitleChars) {
    issues.push({ code: 'max-title', message: 'Título demasiado largo' });
  }
  if ((plan.interactions?.length ?? 0) > budget.maxInteractions) {
    issues.push({ code: 'max-interactions', message: 'Demasiadas interacciones' });
  }

  const ids = plan.elements.map((e) => e.id);
  if (new Set(ids).size !== ids.length) {
    issues.push({ code: 'duplicate-element-ids', message: 'IDs de elementos duplicados' });
  }

  for (const el of plan.elements) {
    if (!el.label.trim()) {
      issues.push({ code: 'empty-label', message: `Label vacío en ${el.id}`, path: el.id });
    }
    if (el.label.length > budget.maxLabelChars) {
      issues.push({
        code: 'max-label',
        message: `Label demasiado largo en ${el.id}`,
        path: el.id,
      });
    }
    if ((el.description?.length ?? 0) > budget.maxDescriptionChars) {
      issues.push({
        code: 'max-description',
        message: `Descripción demasiado larga en ${el.id}`,
        path: el.id,
      });
    }
  }

  const idSet = new Set(ids);
  for (const rel of plan.relationships) {
    if (!idSet.has(rel.from) || !idSet.has(rel.to)) {
      issues.push({
        code: 'relation-dangling',
        message: `Relación ${rel.id} apunta a elementos inexistentes`,
        path: rel.id,
      });
    }
  }

  const visible = plan.elements.filter((e) => e.visible !== false).map((e) => e.id);
  const order = plan.readingOrder;
  if (order.length !== visible.length || visible.some((id) => !order.includes(id))) {
    issues.push({
      code: 'reading-order',
      message: 'readingOrder no cubre exactamente los elementos visibles',
    });
  }
  if (new Set(order).size !== order.length) {
    issues.push({ code: 'duplicate-reading-order', message: 'readingOrder con IDs duplicados' });
  }

  const interactions = plan.interactions ?? [];
  if (
    interactions.length === 1 &&
    interactions[0]?.purpose === 'inspect-detail'
  ) {
    issues.push({
      code: 'inspect-detail-only',
      message: 'La única interacción no puede ser inspect-detail',
    });
  }

  return { name: 'StructuralBudgetVerifier', pass: issues.length === 0, issues };
}

export function verifyCognitiveFit(
  plan: VisualizationPlan,
  primaryTask: string
): VerifierReport {
  const issues: VerifierIssue[] = [];
  if (!plan.expectedInsight.trim()) {
    issues.push({
      code: 'missing-insight',
      message: 'El plan no declara expectedInsight',
    });
  }
  if (plan.strategy === 'causal-chain' && plan.relationships.length < 1) {
    issues.push({
      code: 'causal-without-edges',
      message: 'causal-chain sin relaciones visibles',
    });
  }
  if (plan.strategy === 'guided-reading' && plan.elements.length < 2) {
    issues.push({
      code: 'guided-too-thin',
      message: 'guided-reading necesita al menos núcleo + una idea',
    });
  }
  if (
    primaryTask === 'understand-causality' &&
    plan.strategy === 'guided-reading' &&
    plan.relationships.length === 0 &&
    plan.elements.length > 3
  ) {
    // Soft: not a hard fail — guided may still be correct fallback.
  }
  return { name: 'CognitiveVerifier', pass: issues.length === 0, issues };
}
