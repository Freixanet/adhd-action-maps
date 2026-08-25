import {
  CAUSAL_RELATION_TYPES,
  type KnowledgeModel,
  type SemanticRelation,
} from './knowledgeModel';
import { getRendererCapability } from './rendererCapabilities';
import type { VisualStrategy } from './visualStrategy';
import { SLICE_STRATEGIES } from './visualStrategy';

export type StrategyEligibility = {
  strategy: VisualStrategy;
  eligible: boolean;
  reasons: string[];
  violatedConstraints: string[];
};

const CAUSAL_TYPES = CAUSAL_RELATION_TYPES;

function causalRelations(model: KnowledgeModel): SemanticRelation[] {
  return model.relations.filter((r) => CAUSAL_TYPES.has(r.type));
}

function hasCycle(relations: SemanticRelation[]): boolean {
  const adj = new Map<string, string[]>();
  for (const r of relations) {
    if (!adj.has(r.from)) adj.set(r.from, []);
    adj.get(r.from)!.push(r.to);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adj.get(node) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  for (const node of adj.keys()) {
    if (dfs(node)) return true;
  }
  return false;
}

function branchingFanout(relations: SemanticRelation[]): number {
  const out = new Map<string, Set<string>>();
  for (const r of relations) {
    if (!out.has(r.from)) out.set(r.from, new Set());
    out.get(r.from)!.add(r.to);
  }
  let max = 0;
  for (const targets of out.values()) max = Math.max(max, targets.size);
  return max;
}

function evaluateStrategy(model: KnowledgeModel, strategy: VisualStrategy): StrategyEligibility {
  const reasons: string[] = [];
  const violated: string[] = [];
  const caps = getRendererCapability(strategy);

  if (!caps.supportsMobile) {
    violated.push('supportsMobile');
    reasons.push('El renderer no soporta móvil');
  }

  switch (strategy) {
    case 'causal-chain': {
      const causal = causalRelations(model);
      if (causal.length < 2) {
        violated.push('minCausalRelations');
        reasons.push('Se necesitan al menos 2 relaciones causales dirigidas');
      }
      if (hasCycle(causal)) {
        violated.push('noCycles');
        reasons.push('La cadena causal no puede contener ciclos');
      }
      break;
    }
    case 'branching-causality': {
      const causal = causalRelations(model);
      if (branchingFanout(causal) < 2) {
        violated.push('minDivergentPaths');
        reasons.push('Se necesita un nodo con al menos 2 caminos divergentes');
      }
      break;
    }
    case 'side-by-side-comparison': {
      const ok = model.comparisons.some((c) => c.entities.length >= 2 && c.dimensions.length >= 1);
      if (!ok) {
        violated.push('comparableRegimes');
        reasons.push('Se necesitan al menos 2 entidades/regímenes con dimensiones comparables');
      }
      break;
    }
    case 'process-flow': {
      const ok = model.sequences.some((s) => s.steps.length >= 2);
      if (!ok) {
        violated.push('orderedSequence');
        reasons.push('Se necesita una secuencia ordenada con al menos 2 pasos');
      }
      break;
    }
    case 'guided-reading':
      // Always structurally eligible when knowledge itself is valid.
      break;
  }

  return {
    strategy,
    eligible: violated.length === 0,
    reasons,
    violatedConstraints: violated,
  };
}

export function evaluateEligibility(
  model: KnowledgeModel,
  strategies: readonly VisualStrategy[] = SLICE_STRATEGIES
): StrategyEligibility[] {
  return strategies.map((s) => evaluateStrategy(model, s));
}

export function eligibleStrategies(report: StrategyEligibility[]): VisualStrategy[] {
  return report.filter((r) => r.eligible).map((r) => r.strategy);
}

export function rejectedReasons(report: StrategyEligibility[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of report) {
    if (!r.eligible) out[r.strategy] = r.reasons;
  }
  return out;
}
