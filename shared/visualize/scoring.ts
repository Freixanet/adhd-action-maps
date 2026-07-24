import {
  CAUSAL_RELATION_TYPES,
  type KnowledgeModel,
} from './knowledgeModel';
import { getRendererCapability } from './rendererCapabilities';
import type { VisualizationPlan } from './visualizationPlan';
import type { VisualStrategy } from './visualStrategy';

export type PrePlanScore = {
  structureMatch: number;
  groundedCoveragePotential: number;
  mobileCapability: number;
  estimatedComplexity: number;
};

export type PostPlanScore = {
  planFidelity: number;
  actualCoverage: number;
  interactionUtility: number;
  structuralBudgetFit: number;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function scorePrePlan(
  model: KnowledgeModel,
  strategy: VisualStrategy,
  knowledgeGrounding: number
): PrePlanScore {
  const caps = getRendererCapability(strategy);
  let structureMatch = 0.2;
  let estimatedComplexity = 0.5;

  switch (strategy) {
    case 'causal-chain': {
      const causal = model.relations.filter((r) => CAUSAL_RELATION_TYPES.has(r.type));
      structureMatch = clamp01(causal.length / 4);
      estimatedComplexity = clamp01(causal.length / 6);
      break;
    }
    case 'branching-causality': {
      structureMatch = 0.6;
      estimatedComplexity = 0.7;
      break;
    }
    case 'side-by-side-comparison': {
      structureMatch = model.comparisons.length > 0 ? 0.8 : 0.1;
      estimatedComplexity = 0.5;
      break;
    }
    case 'process-flow': {
      const len = model.sequences[0]?.steps.length ?? 0;
      structureMatch = clamp01(len / 4);
      estimatedComplexity = clamp01(len / 6);
      break;
    }
    case 'guided-reading': {
      structureMatch = 0.55;
      estimatedComplexity = 0.25;
      break;
    }
  }

  return {
    structureMatch,
    groundedCoveragePotential: clamp01(knowledgeGrounding),
    mobileCapability: caps.supportsMobile ? 1 : 0,
    estimatedComplexity,
  };
}

export function rankPrePlan(
  model: KnowledgeModel,
  strategies: VisualStrategy[],
  knowledgeGrounding: number
): Array<{ strategy: VisualStrategy; score: PrePlanScore; total: number }> {
  return strategies
    .map((strategy) => {
      const score = scorePrePlan(model, strategy, knowledgeGrounding);
      const total =
        score.structureMatch * 0.4 +
        score.groundedCoveragePotential * 0.3 +
        score.mobileCapability * 0.2 +
        (1 - score.estimatedComplexity) * 0.1;
      return { strategy, score, total };
    })
    .sort((a, b) => b.total - a.total);
}

export function scorePostPlan(
  model: KnowledgeModel,
  plan: VisualizationPlan,
  structuralBudgetPass: boolean
): PostPlanScore {
  const conceptIds = new Set(model.concepts.map((c) => c.id));
  const represented = plan.elements.filter((e) => e.conceptId && conceptIds.has(e.conceptId));
  const required = Math.min(
    model.concepts.length,
    getRendererCapability(plan.strategy).budget.maxPrimaryElements
  );
  const actualCoverage = required === 0 ? 1 : clamp01(represented.length / Math.max(required, 1));

  const planRels = plan.relationships;
  const supported = planRels.filter((r) => r.evidence.length > 0).length;
  const planFidelity =
    planRels.length === 0 ? (plan.strategy === 'guided-reading' ? 1 : 0) : supported / planRels.length;

  const interactions = plan.interactions ?? [];
  const useful = interactions.filter((i) => i.purpose !== 'inspect-detail').length;
  const interactionUtility = interactions.length === 0 ? 0.6 : useful / interactions.length;

  return {
    planFidelity,
    actualCoverage,
    interactionUtility,
    structuralBudgetFit: structuralBudgetPass ? 1 : 0,
  };
}

export function postPlanTotal(score: PostPlanScore): number {
  return (
    score.planFidelity * 0.4 +
    score.actualCoverage * 0.25 +
    score.interactionUtility * 0.15 +
    score.structuralBudgetFit * 0.2
  );
}

export function hardGatePrePlan(input: {
  eligible: boolean;
  supportsMobile: boolean;
  knowledgeGrounding: number;
}): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.eligible) reasons.push('not-eligible');
  if (!input.supportsMobile) reasons.push('not-mobile');
  if (input.knowledgeGrounding < 0.8) reasons.push('knowledge-grounding-below-0.8');
  return { pass: reasons.length === 0, reasons };
}

export function hardGatePostPlan(input: {
  planFidelity: number;
  unsupportedPlanRelations: number;
  structuralBudgetPasses: boolean;
}): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.planFidelity < 0.8) reasons.push('plan-fidelity-below-0.8');
  if (input.unsupportedPlanRelations > 0) reasons.push('unsupported-plan-relations');
  if (!input.structuralBudgetPasses) reasons.push('structural-budget-failed');
  return { pass: reasons.length === 0, reasons };
}

/** Deterministic causal-chain plan from verified knowledge (fixture / offline path). */
export function buildCausalChainPlan(model: KnowledgeModel): VisualizationPlan | null {
  const causal = model.relations.filter((r) => CAUSAL_RELATION_TYPES.has(r.type));
  if (causal.length < 2) return null;

  const byId = new Map(model.concepts.map((c) => [c.id, c]));
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const r of causal) {
    if (!seen.has(r.from)) {
      seen.add(r.from);
      orderedIds.push(r.from);
    }
    if (!seen.has(r.to)) {
      seen.add(r.to);
      orderedIds.push(r.to);
    }
  }

  const primaryIds = orderedIds.slice(0, 5);
  const elements = primaryIds.map((id) => {
    const c = byId.get(id);
    return {
      id: `n-${id}`,
      label: (c?.label || id).slice(0, 55),
      description: (c?.summary || '').slice(0, 140) || undefined,
      role: 'primary' as const,
      conceptId: id,
      evidence: c?.evidence ?? [],
    };
  });

  const idMap = new Map(primaryIds.map((id) => [id, `n-${id}`]));
  const relationships = causal
    .filter((r) => idMap.has(r.from) && idMap.has(r.to))
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      from: idMap.get(r.from)!,
      to: idMap.get(r.to)!,
      semanticType: r.type,
      label: (r.label || r.type).slice(0, 55),
      evidence: r.evidence,
    }));

  if (relationships.length < 1) return null;

  return {
    strategy: 'causal-chain',
    title: model.thesis.slice(0, 90),
    expectedInsight: 'Ver la cadena causal principal sustentada en la fuente',
    elements,
    relationships,
    interactions: [],
    readingOrder: elements.map((e) => e.id),
    assumptions: [],
    excludedDetails: orderedIds.slice(5).map((id) => byId.get(id)?.label || id),
  };
}
