import {
  eligibleStrategies,
  evaluateEligibility,
  rejectedReasons,
} from './eligibility';
import { buildGuidedReadingPlan } from './guidedReadingPlan';
import type { CognitiveTaskResult, KnowledgeModel } from './knowledgeModel';
import { planToRenderSpec } from './planToRenderSpec';
import { getRendererCapability } from './rendererCapabilities';
import {
  buildCausalChainPlan,
  hardGatePostPlan,
  hardGatePrePlan,
  rankPrePlan,
  scorePostPlan,
} from './scoring';
import { collectUsedEvidence } from './sourceSegments';
import {
  PIPELINE_VERSION,
  RENDERER_SPEC_VERSION,
  type PersistedVisualizationRun,
  type RepairAttempt,
  type VisualizationRunDebug,
} from './types';
import {
  knowledgeGroundingRatio,
  verifyCognitiveFit,
  verifyEvidenceIntegrity,
  verifyStructuralBudget,
  verifySupportConsistency,
  type VerifierReport,
} from './verifiers';
import type { VisualizationPlan } from './visualizationPlan';
import type { SelectionReason, VisualStrategy } from './visualStrategy';
import { SLICE_STRATEGIES } from './visualStrategy';

export type CompileVisualizationInput = {
  knowledge: KnowledgeModel;
  tasks: CognitiveTaskResult;
  /** Optional plans from LLM2 keyed by strategy — fixtures supply these. */
  plansByStrategy?: Partial<Record<VisualStrategy, VisualizationPlan>>;
  strategies?: readonly VisualStrategy[];
  runId?: string;
};

export type CompileVisualizationResult = {
  persisted: PersistedVisualizationRun | null;
  debug: VisualizationRunDebug;
  /** When knowledge invalid after gates — caller should keep/use v1. */
  runtimeV1Fallback: boolean;
};

function pruneSecondary(plan: VisualizationPlan): VisualizationPlan {
  const secondary = plan.elements.filter((e) => e.role === 'secondary');
  if (secondary.length === 0) return plan;
  const dropId = secondary[secondary.length - 1]!.id;
  const elements = plan.elements.filter((e) => e.id !== dropId);
  return {
    ...plan,
    elements,
    relationships: plan.relationships.filter((r) => r.from !== dropId && r.to !== dropId),
    readingOrder: plan.readingOrder.filter((id) => id !== dropId),
    interactions: (plan.interactions ?? []).filter((i) => !i.targets.includes(dropId)),
  };
}

function resolvePlan(
  strategy: VisualStrategy,
  knowledge: KnowledgeModel,
  plansByStrategy?: Partial<Record<VisualStrategy, VisualizationPlan>>
): VisualizationPlan | null {
  const provided = plansByStrategy?.[strategy];
  if (provided) return provided;
  if (strategy === 'guided-reading') return buildGuidedReadingPlan(knowledge);
  if (strategy === 'causal-chain') return buildCausalChainPlan(knowledge);
  return null;
}

function unsupportedPlanRelations(plan: VisualizationPlan): number {
  return plan.relationships.filter((r) => r.evidence.length === 0).length;
}

function tryFinalizePlan(
  knowledge: KnowledgeModel,
  tasks: CognitiveTaskResult,
  plan: VisualizationPlan,
  reports: VerifierReport[]
): { ok: boolean; plan: VisualizationPlan; postPass: boolean } {
  let current = plan;
  const caps = getRendererCapability(current.strategy);

  let budget = verifyStructuralBudget(current, caps.budget);
  reports.push(budget);

  if (!budget.pass) {
    current = pruneSecondary(current);
    budget = verifyStructuralBudget(current, caps.budget);
    reports.push({ ...budget, name: 'StructuralBudgetVerifier:after-prune' });
  }

  const cognitive = verifyCognitiveFit(current, tasks.primary);
  reports.push(cognitive);

  const post = scorePostPlan(knowledge, current, budget.pass);
  const gate = hardGatePostPlan({
    planFidelity: post.planFidelity,
    unsupportedPlanRelations: unsupportedPlanRelations(current),
    structuralBudgetPasses: budget.pass,
  });

  return {
    ok: gate.pass && cognitive.pass,
    plan: current,
    postPass: gate.pass,
  };
}

/**
 * Pure compile path for slice 1 (no LLM). Used by Vitest fixtures and later
 * wrapped by server/visualize with LLM1/2/3.
 */
export function compileVisualizationRun(
  input: CompileVisualizationInput
): CompileVisualizationResult {
  const strategies = input.strategies ?? SLICE_STRATEGIES;
  const reports: VerifierReport[] = [];
  const repairHistory: RepairAttempt[] = [];
  const warnings: string[] = [];

  const integrity = verifyEvidenceIntegrity(input.knowledge);
  reports.push(integrity);
  const consistency = verifySupportConsistency(input.knowledge);
  reports.push(consistency);

  if (!integrity.pass || !consistency.pass) {
    repairHistory.push({
      at: new Date().toISOString(),
      failureClass: 'knowledge',
      action: 'runtime-v1-fallback',
      detail: 'Knowledge failed integrity/consistency; do not build guided-reading from it',
    });
    return {
      persisted: null,
      runtimeV1Fallback: true,
      debug: {
        knowledge: input.knowledge,
        tasks: input.tasks,
        candidates: [],
        verifierReports: reports,
        repairHistory,
        telemetry: [],
      },
    };
  }

  const grounding = knowledgeGroundingRatio(input.knowledge);
  if (grounding < 0.8) {
    repairHistory.push({
      at: new Date().toISOString(),
      failureClass: 'knowledge',
      action: 'runtime-v1-fallback',
      detail: `knowledgeGrounding=${grounding.toFixed(2)}`,
    });
    return {
      persisted: null,
      runtimeV1Fallback: true,
      debug: {
        knowledge: input.knowledge,
        tasks: input.tasks,
        candidates: [],
        verifierReports: reports,
        repairHistory,
        telemetry: [],
      },
    };
  }

  const eligibility = evaluateEligibility(input.knowledge, strategies);
  const eligible = eligibleStrategies(eligibility);
  const rejected = rejectedReasons(eligibility);

  const gated = eligible.filter((strategy) => {
    const gate = hardGatePrePlan({
      eligible: true,
      supportsMobile: getRendererCapability(strategy).supportsMobile,
      knowledgeGrounding: grounding,
    });
    return gate.pass;
  });

  const ranked = rankPrePlan(input.knowledge, gated, grounding);
  const candidates = ranked.map((r) => ({
    strategy: r.strategy,
    prePlan: r.score,
    total: r.total,
  }));

  const queue: VisualStrategy[] = ranked.map((r) => r.strategy);
  // Prefer non-guided first when both present with similar structure — ranking already does this
  // if causal has higher structureMatch; ensure guided is tried last among equals by stable sort:
  queue.sort((a, b) => {
    if (a === 'guided-reading' && b !== 'guided-reading') return 1;
    if (b === 'guided-reading' && a !== 'guided-reading') return -1;
    return 0;
  });

  let selectionReason: SelectionReason = 'best-candidate';
  let chosen: VisualStrategy | null = null;
  let finalPlan: VisualizationPlan | null = null;

  if (queue.length === 0 || (queue.length === 1 && queue[0] === 'guided-reading')) {
    selectionReason =
      queue.length === 0 || !gated.includes('guided-reading' as VisualStrategy)
        ? 'no-eligible-visual-strategy'
        : gated.some((s) => s !== 'guided-reading')
          ? 'best-candidate'
          : 'no-eligible-visual-strategy';
  }

  const attemptOrder =
    queue.length > 0
      ? queue
      : (['guided-reading'] as VisualStrategy[]);

  for (let i = 0; i < attemptOrder.length; i++) {
    const strategy = attemptOrder[i]!;
    let plan = resolvePlan(strategy, input.knowledge, input.plansByStrategy);
    if (!plan) {
      repairHistory.push({
        at: new Date().toISOString(),
        failureClass: 'plan',
        action: 'select-next-candidate',
        detail: `No plan for ${strategy}`,
      });
      continue;
    }

    let result = tryFinalizePlan(input.knowledge, input.tasks, plan, reports);
    if (!result.ok && strategy !== 'guided-reading') {
      // Simulate LLM3 repair once: rebuild from knowledge heuristically
      repairHistory.push({
        at: new Date().toISOString(),
        failureClass: 'plan',
        action: 'repair-plan',
        detail: strategy,
      });
      const repaired =
        strategy === 'causal-chain'
          ? buildCausalChainPlan(input.knowledge)
          : plan;
      if (repaired) {
        result = tryFinalizePlan(input.knowledge, input.tasks, repaired, reports);
        plan = repaired;
      }
    }

    if (result.ok) {
      chosen = strategy;
      finalPlan = result.plan;
      selectionReason =
        i === 0 && strategy !== 'guided-reading'
          ? 'best-candidate'
          : strategy === 'guided-reading' && i > 0
            ? 'verification-fallback'
            : strategy === 'guided-reading'
              ? 'no-eligible-visual-strategy'
              : 'best-candidate';
      break;
    }

    repairHistory.push({
      at: new Date().toISOString(),
      failureClass: 'cognitive',
      action: i < attemptOrder.length - 1 ? 'select-next-candidate' : 'use-guided-reading',
      detail: strategy,
    });
  }

  if (!chosen || !finalPlan) {
    const guided = buildGuidedReadingPlan(input.knowledge);
    const result = tryFinalizePlan(input.knowledge, input.tasks, guided, reports);
    if (!result.ok) {
      return {
        persisted: null,
        runtimeV1Fallback: true,
        debug: {
          knowledge: input.knowledge,
          tasks: input.tasks,
          candidates,
          verifierReports: reports,
          repairHistory: [
            ...repairHistory,
            {
              at: new Date().toISOString(),
              failureClass: 'knowledge',
              action: 'runtime-v1-fallback',
              detail: 'guided-reading also failed validation',
            },
          ],
          telemetry: [],
        },
      };
    }
    chosen = 'guided-reading';
    finalPlan = result.plan;
    selectionReason = 'verification-fallback';
    warnings.push('Degradado a guided-reading tras fallos de verificación');
  }

  const renderSpec = planToRenderSpec(finalPlan);
  const usedEvidence = collectUsedEvidence(
    input.knowledge.segments,
    [
      ...input.knowledge.thesisEvidence,
      ...finalPlan.elements.flatMap((e) => e.evidence ?? []),
      ...finalPlan.relationships.flatMap((r) => r.evidence),
    ]
  );

  const persisted: PersistedVisualizationRun = {
    schemaVersion: 2,
    pipelineVersion: PIPELINE_VERSION,
    rendererSpecVersion: RENDERER_SPEC_VERSION,
    runId: input.runId ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    status: selectionReason === 'best-candidate' ? 'complete' : 'degraded',
    selection: {
      strategy: chosen,
      reason: selectionReason,
      eligible: gated,
      rejected,
    },
    renderSpec,
    warnings,
    usedEvidence,
  };

  return {
    persisted,
    runtimeV1Fallback: false,
    debug: {
      knowledge: input.knowledge,
      tasks: input.tasks,
      candidates,
      verifierReports: reports,
      repairHistory,
      telemetry: [],
    },
  };
}
