/**
 * Fail-closed merge of a limited model draft onto a compiler-owned plan.
 * Provenance fields are ALWAYS rebuilt from candidate → claim → links → chunks.
 * When the model selects a different allow-listed candidate, the compiler rebuilds
 * a new skeleton (risk, inference, caution, action) for THAT candidate first.
 */

import type { EvidenceArtifact } from '../evidence/types';
import {
  isGenericUnsupportedAdvice,
  isMetaSuccessPlaceholder,
  isVagueSuccessCriterion,
  startsWithVerb,
} from './genericAdvice';
import { authorizedChunkManifest } from './evidenceDigest';
import { buildDeterministicPlan } from './compile';
import type { ModelPlanDraftV1 } from './modelDraft';
import {
  candidateAllowsAction,
  classifyAdaptationRisk,
  isBlockedAffirmativeStatus,
  isHighRisk,
  stripInjectionLooks,
} from './policy';
import {
  actionContradictsSourceBasis,
  isDangerousHighRiskInstruction,
  safeConsultInstructionForRisk,
} from './highRiskActionGuard';
import type {
  AdaptationRisk,
  ApplicationArtifactV1,
  ApplicationCandidateV1,
  ApplicationPlanV1,
} from './types';
import { validateApplicationArtifact } from './validate';

export type ApplyDraftResult =
  | { ok: true; artifact: ApplicationArtifactV1 }
  | { ok: false; code: string; errors: string[] };

const RISK_RANK: Record<AdaptationRisk, number> = {
  low: 0,
  moderate: 1,
  high_medical: 2,
  high_psychological: 2,
  high_legal: 2,
  high_financial: 2,
  high_physical: 2,
};

function maxRisk(a: AdaptationRisk, b: AdaptationRisk): AdaptationRisk {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

export function chunksForSelectedCandidate(
  evidence: EvidenceArtifact,
  candidate: ApplicationCandidateV1,
  allowedChunks: Set<string>
): string[] | null {
  const claim = evidence.claims.find((c) => c.id === candidate.claimId);
  if (!claim) return null;
  if (claim.id !== candidate.claimId) return null;

  const fromLinks = new Set<string>();
  for (const linkId of candidate.evidenceLinkIds) {
    if (!claim.evidenceLinkIds.includes(linkId)) return null;
    const link = evidence.links.find((l) => l.id === linkId);
    if (!link) return null;
    if (link.contentNodeId && link.contentNodeId !== claim.id) {
      return null;
    }
    if (!allowedChunks.has(link.chunkId)) return null;
    fromLinks.add(link.chunkId);
  }
  if (fromLinks.size === 0) return null;
  return [...fromLinks].filter((id) => allowedChunks.has(id)).sort();
}

export function rebuildSourceBasis(
  candidate: ApplicationCandidateV1,
  evidence: EvidenceArtifact
): string {
  const claim = evidence.claims.find((c) => c.id === candidate.claimId);
  const raw = claim?.text ?? candidate.claimText;
  const cleaned = stripInjectionLooks(raw);
  if (candidate.epistemicStatus === 'inference') {
    return `Inferencia (no afirmación literal de la fuente): ${cleaned}`;
  }
  if (candidate.epistemicStatus === 'qualified') {
    return `${cleaned} — la fuente lo matiza.`;
  }
  return cleaned;
}

function riskForCandidate(
  candidate: ApplicationCandidateV1,
  base: ApplicationArtifactV1
): AdaptationRisk {
  return classifyAdaptationRisk([
    candidate.claimText,
    base.context.goal ?? '',
    base.context.situation ?? '',
  ]);
}

/**
 * Apply a limited model draft. Authoritative fields are rebuilt by the compiler.
 */
export function applyModelDraft(args: {
  base: ApplicationArtifactV1;
  draft: ModelPlanDraftV1;
  evidence: EvidenceArtifact;
  /** Compiler-classified risk for the original primary (still used as floor). */
  compilerRisk: AdaptationRisk;
}): ApplyDraftResult {
  const errors: string[] = [];
  const allow = new Map(args.base.candidates.map((c) => [c.id, c]));
  const allowedChunks = authorizedChunkManifest(args.evidence);

  let selectedId = args.base.plan.selectedCandidateId;
  if (args.draft.selectedCandidateId != null) {
    if (!allow.has(args.draft.selectedCandidateId)) {
      return {
        ok: false,
        code: 'APPLICATION_POLICY_REJECT',
        errors: ['selectedCandidateId not in allow-list'],
      };
    }
    selectedId = args.draft.selectedCandidateId;
  }

  if (!selectedId) {
    return {
      ok: false,
      code: 'APPLICATION_POLICY_REJECT',
      errors: ['affirmative plan requires selectedCandidateId'],
    };
  }

  const candidate = allow.get(selectedId);
  if (!candidate) {
    return {
      ok: false,
      code: 'APPLICATION_POLICY_REJECT',
      errors: ['selected candidate missing'],
    };
  }

  if (isBlockedAffirmativeStatus(candidate.epistemicStatus) || !candidateAllowsAction(candidate)) {
    return {
      ok: false,
      code: 'APPLICATION_POLICY_REJECT',
      errors: ['blocked epistemic status cannot ground action'],
    };
  }

  const claim = args.evidence.claims.find((c) => c.id === candidate.claimId);
  if (!claim) {
    return {
      ok: false,
      code: 'APPLICATION_POLICY_REJECT',
      errors: ['claim not found for candidate'],
    };
  }

  const chunks = chunksForSelectedCandidate(args.evidence, candidate, allowedChunks);
  if (chunks == null) {
    return {
      ok: false,
      code: 'APPLICATION_POLICY_REJECT',
      errors: ['chunk/link binding invalid or cross-claim'],
    };
  }

  // Recalculate risk for the FINALLY selected candidate — never inherit primary's low.
  const selectedRisk = riskForCandidate(candidate, args.base);
  const risk = maxRisk(selectedRisk, maxRisk(args.compilerRisk, args.base.plan.risk));
  if (isHighRisk(selectedRisk) && risk === 'low') {
    return {
      ok: false,
      code: 'APPLICATION_POLICY_REJECT',
      errors: ['high-risk candidate cannot inherit low risk'],
    };
  }

  // Model proposed a different candidate → rebuild skeleton before accepting prose.
  let workingBase = args.base;
  if (selectedId !== args.base.plan.selectedCandidateId) {
    workingBase = buildDeterministicPlan({
      candidates: args.base.candidates,
      evidence: args.evidence,
      context: args.base.context,
      contentHash: args.base.contentHash,
      depth: args.base.depth,
      contextCanonicalHash: args.base.contextCanonicalHash,
      sourceId: args.base.sourceId,
      sourceVersionId: args.base.sourceVersionId,
      evidenceDigest: args.base.evidenceDigest,
      understandingSchemaVersion: args.base.understandingSchemaVersion,
      understandingPromptVersion: args.base.understandingPromptVersion,
      understandingCompilerVersion: args.base.understandingCompilerVersion,
      evidenceSchemaVersion: args.base.evidenceSchemaVersion,
      evidencePromptVersion: args.base.evidencePromptVersion,
      evidenceVerifierVersion: args.base.evidenceVerifierVersion,
      evidenceCompilerVersion: args.base.evidenceCompilerVersion,
      modelVersion: args.base.modelVersion,
      forcedCandidateId: selectedId,
    });
    // If policy abstains / needs context for the new candidate, do not keep prior action.
    if (
      workingBase.plan.status === 'abstained' ||
      workingBase.plan.status === 'needs_context' ||
      !workingBase.plan.action
    ) {
      const validated = validateApplicationArtifact({
        ...workingBase,
        plan: {
          ...workingBase.plan,
          risk: maxRisk(workingBase.plan.risk, selectedRisk),
          selectedCandidateId: selectedId,
          sourceBasis: rebuildSourceBasis(candidate, args.evidence),
          sourceChunkIds: chunks,
        },
      });
      if (validated.ok === false) {
        return { ok: false, code: 'APPLICATION_INVALID_PLAN', errors: validated.errors };
      }
      return { ok: true, artifact: validated.value };
    }
  }

  const sourceBasis = rebuildSourceBasis(candidate, args.evidence);

  let inference = workingBase.plan.inference;
  if (typeof args.draft.inference === 'string' && args.draft.inference.trim()) {
    inference = args.draft.inference.trim().slice(0, 800);
  }
  if (candidate.epistemicStatus === 'inference') {
    if (!/inferencia|hip[oó]tesis|n[uú]cleo/i.test(inference)) {
      inference = `Inferencia de Núcleo (no es cita de la fuente): ${inference}`;
    }
  }
  if (candidate.epistemicStatus === 'qualified' && !/matiz|cautela|cualific/i.test(inference)) {
    inference = `${inference} Conserva el matiz de la fuente.`;
  }

  let adaptation = workingBase.plan.adaptation;
  if (typeof args.draft.adaptation === 'string' && args.draft.adaptation.trim()) {
    adaptation = args.draft.adaptation.trim().slice(0, 800);
  }
  if (isHighRisk(risk) && !/profesional|m[eé]dico|no\s+sustituye/i.test(adaptation)) {
    adaptation +=
      ' Esto no sustituye criterio profesional; quédate en acciones informativas y de bajo riesgo.';
  }

  let assumptions = workingBase.plan.assumptions.map((a) => {
    const override = args.draft.editableAssumptionTexts?.[a.id];
    if (override != null && a.editable) {
      return { ...a, text: override.trim().slice(0, 400) };
    }
    return a;
  });
  if (args.draft.editableAssumptionTexts) {
    for (const id of Object.keys(args.draft.editableAssumptionTexts)) {
      if (!workingBase.plan.assumptions.some((a) => a.id === id && a.editable)) {
        errors.push(`assumption id not editable: ${id}`);
      }
    }
  }
  if (errors.length) {
    return { ok: false, code: 'APPLICATION_POLICY_REJECT', errors };
  }

  if (
    candidate.epistemicStatus === 'qualified' &&
    !assumptions.some((a) => /matiz|cautela/i.test(a.text))
  ) {
    return {
      ok: false,
      code: 'APPLICATION_POLICY_REJECT',
      errors: ['qualified caution must remain'],
    };
  }

  const baseAction = workingBase.plan.action;
  if (!baseAction) {
    return {
      ok: false,
      code: 'APPLICATION_INVALID_PLAN',
      errors: ['base plan has no action'],
    };
  }

  // High-risk without ready gate → do not keep prior low action.
  if (isHighRisk(selectedRisk) && workingBase.plan.status !== 'ready') {
    return {
      ok: true,
      artifact: {
        ...workingBase,
        plan: {
          ...workingBase.plan,
          selectedCandidateId: selectedId,
          sourceBasis,
          sourceChunkIds: chunks,
          risk,
          action: null,
        },
      },
    };
  }

  let verbLed =
    typeof args.draft.verbLedInstruction === 'string' && args.draft.verbLedInstruction.trim()
      ? args.draft.verbLedInstruction.trim().slice(0, 280)
      : baseAction.verbLedInstruction;
  let successCriterion =
    typeof args.draft.successCriterion === 'string' && args.draft.successCriterion.trim()
      ? args.draft.successCriterion.trim().slice(0, 280)
      : baseAction.successCriterion;

  // Final-action policy: caution elsewhere never legitimizes a dangerous imperative.
  if (
    isHighRisk(risk) &&
    (isDangerousHighRiskInstruction(risk, verbLed) ||
      actionContradictsSourceBasis(verbLed, sourceBasis))
  ) {
    verbLed = safeConsultInstructionForRisk(risk);
    successCriterion = 'Tener una consulta o cita agendada con el profesional adecuado.';
  }

  if (!startsWithVerb(verbLed) || isGenericUnsupportedAdvice(verbLed)) {
    return {
      ok: false,
      code: 'APPLICATION_GENERIC_ADVICE',
      errors: ['action invalid or generic'],
    };
  }
  if (isVagueSuccessCriterion(successCriterion) || isMetaSuccessPlaceholder(successCriterion)) {
    return {
      ok: false,
      code: 'APPLICATION_INVALID_PLAN',
      errors: ['success criterion vague or meta placeholder'],
    };
  }

  // Last line of defense after rewrite.
  if (isHighRisk(risk) && isDangerousHighRiskInstruction(risk, verbLed)) {
    const abstained: ApplicationPlanV1 = {
      ...workingBase.plan,
      id: workingBase.plan.id,
      status: 'abstained',
      selectedCandidateId: selectedId,
      sourceBasis,
      sourceChunkIds: chunks,
      risk,
      assumptions,
      inference,
      adaptation:
        adaptation ||
        'Esto no sustituye criterio profesional; no se emite una instrucción de cambio directo.',
      action: null,
      reviewTrigger: '',
      reviewQuestions: [],
      abstentionReason:
        'La instrucción propuesta modifica un área de alto riesgo; Núcleo se abstiene.',
    };
    const validatedAbstained = validateApplicationArtifact({
      ...workingBase,
      status: 'abstained',
      plan: abstained,
    });
    if (validatedAbstained.ok === false) {
      return { ok: false, code: 'APPLICATION_POLICY_REJECT', errors: validatedAbstained.errors };
    }
    return { ok: true, artifact: validatedAbstained.value };
  }

  const plan: ApplicationPlanV1 = {
    ...workingBase.plan,
    id: workingBase.plan.id,
    status: workingBase.plan.status,
    selectedCandidateId: selectedId,
    sourceBasis,
    sourceChunkIds: chunks,
    risk,
    assumptions,
    inference,
    adaptation,
    reviewTrigger:
      typeof args.draft.reviewTrigger === 'string' && args.draft.reviewTrigger.trim()
        ? args.draft.reviewTrigger.trim().slice(0, 200)
        : workingBase.plan.reviewTrigger,
    reviewQuestions:
      Array.isArray(args.draft.reviewQuestions) && args.draft.reviewQuestions.length
        ? args.draft.reviewQuestions
            .filter((q): q is string => typeof q === 'string')
            .map((q) => q.trim())
            .filter(Boolean)
            .slice(0, 5)
        : workingBase.plan.reviewQuestions,
    action: {
      id: baseAction.id,
      verbLedInstruction: verbLed,
      whenOrTrigger:
        typeof args.draft.whenOrTrigger === 'string' && args.draft.whenOrTrigger.trim()
          ? args.draft.whenOrTrigger.trim().slice(0, 200)
          : baseAction.whenOrTrigger,
      durationOrScope:
        typeof args.draft.durationOrScope === 'string' && args.draft.durationOrScope.trim()
          ? args.draft.durationOrScope.trim().slice(0, 200)
          : baseAction.durationOrScope,
      obstacle:
        typeof args.draft.obstacle === 'string' && args.draft.obstacle.trim()
          ? args.draft.obstacle.trim().slice(0, 240)
          : baseAction.obstacle,
      mitigation:
        typeof args.draft.mitigation === 'string' && args.draft.mitigation.trim()
          ? args.draft.mitigation.trim().slice(0, 240)
          : baseAction.mitigation,
      successCriterion,
      stopOrChangeCriterion:
        typeof args.draft.stopOrChangeCriterion === 'string' &&
        args.draft.stopOrChangeCriterion.trim()
          ? args.draft.stopOrChangeCriterion.trim().slice(0, 280)
          : baseAction.stopOrChangeCriterion,
    },
  };

  const artifact: ApplicationArtifactV1 = {
    ...workingBase,
    plan,
    status:
      plan.status === 'ready'
        ? 'complete'
        : plan.status === 'provisional'
          ? 'provisional'
          : plan.status === 'needs_context'
            ? 'needs_context'
            : plan.status === 'abstained'
              ? 'abstained'
              : workingBase.status,
  };

  const validated = validateApplicationArtifact(artifact);
  if (validated.ok === false) {
    return {
      ok: false,
      code: 'APPLICATION_INVALID_PLAN',
      errors: validated.errors,
    };
  }
  return { ok: true, artifact: validated.value };
}
