import { describe, expect, it } from 'vitest';
import { compileVisualizationRun } from './compileVisualizationRun';
import {
  FIXTURE_BROKEN_EVIDENCE,
  FIXTURE_CAUSAL_KNOWLEDGE,
  FIXTURE_CAUSAL_TASKS,
  FIXTURE_FLAT_KNOWLEDGE,
  FIXTURE_FLAT_TASKS,
  FIXTURE_SOURCE,
} from './fixtures/slice1';
import { evaluateEligibility } from './eligibility';
import { buildGuidedReadingPlan } from './guidedReadingPlan';
import { planToRenderSpec } from './planToRenderSpec';
import { segmentSourceText } from './sourceSegments';
import {
  verifyEvidenceIntegrity,
  verifyStructuralBudget,
  verifySupportConsistency,
} from './verifiers';
import { getRendererCapability } from './rendererCapabilities';
import { hardGatePostPlan, hardGatePrePlan } from './scoring';

describe('sourceSegments', () => {
  it('produces stable segment ids with offsets', () => {
    const segments = segmentSourceText(FIXTURE_SOURCE);
    expect(segments.length).toBeGreaterThanOrEqual(3);
    expect(segments[0]?.id).toBe('seg-1');
    expect(segments[0]?.text.length).toBeGreaterThan(10);
    expect(segments[0]?.startOffset).toBe(0);
  });
});

describe('evidence verifiers', () => {
  it('passes integrity and consistency on causal fixture', () => {
    expect(verifyEvidenceIntegrity(FIXTURE_CAUSAL_KNOWLEDGE).pass).toBe(true);
    expect(verifySupportConsistency(FIXTURE_CAUSAL_KNOWLEDGE).pass).toBe(true);
  });

  it('rejects unknown segment ids', () => {
    const report = verifyEvidenceIntegrity(FIXTURE_BROKEN_EVIDENCE);
    expect(report.pass).toBe(false);
    expect(report.issues.some((i) => i.code === 'unknown-segment')).toBe(true);
  });

  it('rejects asserted relation backed only by inferred support', () => {
    const model = {
      ...FIXTURE_CAUSAL_KNOWLEDGE,
      relations: [
        {
          ...FIXTURE_CAUSAL_KNOWLEDGE.relations[0]!,
          modality: 'asserted' as const,
          evidence: [{ segmentId: 'seg-2', support: 'inferred' as const }],
        },
      ],
    };
    const report = verifySupportConsistency(model);
    expect(report.pass).toBe(false);
    expect(report.issues.some((i) => i.code === 'modality-support-mismatch')).toBe(true);
  });
});

describe('eligibility', () => {
  it('marks causal-chain eligible for causal fixture', () => {
    const report = evaluateEligibility(FIXTURE_CAUSAL_KNOWLEDGE);
    const causal = report.find((r) => r.strategy === 'causal-chain');
    expect(causal?.eligible).toBe(true);
  });

  it('rejects causal-chain for flat fixture but keeps guided-reading', () => {
    const report = evaluateEligibility(FIXTURE_FLAT_KNOWLEDGE);
    expect(report.find((r) => r.strategy === 'causal-chain')?.eligible).toBe(false);
    expect(report.find((r) => r.strategy === 'guided-reading')?.eligible).toBe(true);
  });
});

describe('compileVisualizationRun slice1', () => {
  it('selects causal-chain for causal knowledge', () => {
    const result = compileVisualizationRun({
      knowledge: FIXTURE_CAUSAL_KNOWLEDGE,
      tasks: FIXTURE_CAUSAL_TASKS,
      runId: 'test-causal',
    });
    expect(result.runtimeV1Fallback).toBe(false);
    expect(result.persisted?.selection.strategy).toBe('causal-chain');
    expect(result.persisted?.renderSpec.type).toBe('causal-chain');
    expect(result.persisted?.selection.reason).toBe('best-candidate');
  });

  it('selects guided-reading for unstructured knowledge via same pipeline', () => {
    const result = compileVisualizationRun({
      knowledge: FIXTURE_FLAT_KNOWLEDGE,
      tasks: FIXTURE_FLAT_TASKS,
      runId: 'test-flat',
    });
    expect(result.runtimeV1Fallback).toBe(false);
    expect(result.persisted?.selection.strategy).toBe('guided-reading');
    expect(result.persisted?.renderSpec.type).toBe('guided-reading');
    expect(result.persisted?.selection.reason).toBe('no-eligible-visual-strategy');
  });

  it('falls back to v1 when knowledge evidence is broken', () => {
    const result = compileVisualizationRun({
      knowledge: FIXTURE_BROKEN_EVIDENCE,
      tasks: FIXTURE_CAUSAL_TASKS,
      runId: 'test-broken',
    });
    expect(result.runtimeV1Fallback).toBe(true);
    expect(result.persisted).toBeNull();
  });

  it('guided-reading plan passes structural budget', () => {
    const plan = buildGuidedReadingPlan(FIXTURE_FLAT_KNOWLEDGE);
    const budget = getRendererCapability('guided-reading').budget;
    expect(verifyStructuralBudget(plan, budget).pass).toBe(true);
    const spec = planToRenderSpec(plan);
    expect(spec.type).toBe('guided-reading');
  });
});

describe('hard gates', () => {
  it('pre-plan rejects low grounding', () => {
    expect(
      hardGatePrePlan({ eligible: true, supportsMobile: true, knowledgeGrounding: 0.5 }).pass
    ).toBe(false);
  });

  it('post-plan rejects unsupported relations', () => {
    expect(
      hardGatePostPlan({
        planFidelity: 0.9,
        unsupportedPlanRelations: 1,
        structuralBudgetPasses: true,
      }).pass
    ).toBe(false);
  });
});
