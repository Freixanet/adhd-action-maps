/**
 * Runtime validation — fail closed.
 */

import {
  isGenericUnsupportedAdvice,
  isMetaSuccessPlaceholder,
  isVagueSuccessCriterion,
  startsWithVerb,
} from './genericAdvice';
import { isBlockedAffirmativeStatus, isHighRisk } from './policy';
import type {
  ApplicationActionV1,
  ApplicationArtifactV1,
  ApplicationAssumptionV1,
  ApplicationCandidateV1,
  ApplicationContextV1,
  ApplicationPlanV1,
  ApplicationReviewV1,
} from './types';
import {
  APPLICATION_COMPILER_VERSION,
  APPLICATION_POLICY_VERSION,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
  APPLICATION_SUPPORTED_COMPILER_VERSIONS,
  APPLICATION_SUPPORTED_POLICY_VERSIONS,
  APPLICATION_SUPPORTED_PROMPT_VERSIONS,
  APPLICATION_SUPPORTED_SCHEMA_VERSIONS,
} from './versions';

export type ValidateOk<T> = { ok: true; value: T };
export type ValidateFail = { ok: false; errors: string[] };
export type ValidateResult<T> = ValidateOk<T> | ValidateFail;

function fail(errors: string[]): ValidateFail {
  return { ok: false as const, errors };
}

function isNonEmptyString(v: unknown, min = 1): v is string {
  return typeof v === 'string' && v.trim().length >= min;
}

export function validateContext(input: unknown): ValidateResult<ApplicationContextV1> {
  if (input == null) return { ok: true as const, value: {} };
  if (typeof input !== 'object') return fail(['context must be object']);
  const raw = input as Record<string, unknown>;
  const out: ApplicationContextV1 = {};
  for (const key of ['goal', 'situation', 'constraint', 'horizon'] as const) {
    if (raw[key] == null) continue;
    if (typeof raw[key] !== 'string') return fail([`context.${key} must be string`]);
    const t = (raw[key] as string).trim();
    if (t) out[key] = t.slice(0, 500);
  }
  if (raw.optionalConstraints != null) {
    if (!Array.isArray(raw.optionalConstraints)) {
      return fail(['context.optionalConstraints must be array']);
    }
    out.optionalConstraints = raw.optionalConstraints
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 5);
  }
  return { ok: true as const, value: out };
}

function validateAssumption(raw: unknown): ValidateResult<ApplicationAssumptionV1> {
  if (!raw || typeof raw !== 'object') return fail(['assumption invalid']);
  const a = raw as ApplicationAssumptionV1;
  if (!isNonEmptyString(a.id) || !isNonEmptyString(a.text, 4)) {
    return fail(['assumption id/text required']);
  }
  if (typeof a.editable !== 'boolean') return fail(['assumption.editable required']);
  if (a.source !== 'user' && a.source !== 'nucleo_default') {
    return fail(['assumption.source invalid']);
  }
  return {
    ok: true,
    value: {
      id: a.id.trim(),
      text: a.text.trim().slice(0, 400),
      editable: a.editable,
      source: a.source,
    },
  };
}

function validateAction(raw: unknown): ValidateResult<ApplicationActionV1> {
  if (!raw || typeof raw !== 'object') return fail(['action invalid']);
  const a = raw as ApplicationActionV1;
  const fields: Array<keyof ApplicationActionV1> = [
    'id',
    'verbLedInstruction',
    'whenOrTrigger',
    'durationOrScope',
    'obstacle',
    'mitigation',
    'successCriterion',
    'stopOrChangeCriterion',
  ];
  for (const f of fields) {
    if (!isNonEmptyString(a[f], f === 'id' ? 1 : 4)) {
      return fail([`action.${f} required`]);
    }
  }
  if (!startsWithVerb(a.verbLedInstruction)) {
    return fail(['action must start with a verb']);
  }
  if (isGenericUnsupportedAdvice(a.verbLedInstruction)) {
    return fail(['action is unsupported generic advice']);
  }
  if (isVagueSuccessCriterion(a.successCriterion) || isMetaSuccessPlaceholder(a.successCriterion)) {
    return fail(['success criterion too vague']);
  }
  if (isVagueSuccessCriterion(a.stopOrChangeCriterion) && a.stopOrChangeCriterion.length < 12) {
    return fail(['stop criterion too vague']);
  }
  return {
    ok: true,
    value: {
      id: a.id.trim(),
      verbLedInstruction: a.verbLedInstruction.trim().slice(0, 280),
      whenOrTrigger: a.whenOrTrigger.trim().slice(0, 200),
      durationOrScope: a.durationOrScope.trim().slice(0, 200),
      obstacle: a.obstacle.trim().slice(0, 240),
      mitigation: a.mitigation.trim().slice(0, 240),
      successCriterion: a.successCriterion.trim().slice(0, 280),
      stopOrChangeCriterion: a.stopOrChangeCriterion.trim().slice(0, 280),
    },
  };
}

export function validateCandidate(raw: unknown): ValidateResult<ApplicationCandidateV1> {
  if (!raw || typeof raw !== 'object') return fail(['candidate invalid']);
  const c = raw as ApplicationCandidateV1;
  if (!isNonEmptyString(c.id) || !isNonEmptyString(c.claimId) || !isNonEmptyString(c.claimText, 4)) {
    return fail(['candidate ids/text required']);
  }
  if (!Array.isArray(c.evidenceLinkIds)) return fail(['evidenceLinkIds required']);
  const levels = ['high', 'medium', 'low'] as const;
  if (!levels.includes(c.relevance as (typeof levels)[number])) {
    return fail(['relevance invalid']);
  }
  if (!levels.includes(c.effort as (typeof levels)[number])) return fail(['effort invalid']);
  if (!levels.includes(c.reversibility as (typeof levels)[number])) {
    return fail(['reversibility invalid']);
  }
  return { ok: true, value: c };
}

export function validatePlan(
  raw: unknown,
  opts?: { allowNullAction?: boolean }
): ValidateResult<ApplicationPlanV1> {
  if (!raw || typeof raw !== 'object') return fail(['plan invalid']);
  const p = raw as ApplicationPlanV1;
  const statuses = [
    'needs_context',
    'provisional',
    'ready',
    'in_progress',
    'completed',
    'abandoned',
    'abstained',
  ] as const;
  if (!statuses.includes(p.status as (typeof statuses)[number])) {
    return fail(['plan.status invalid']);
  }
  if (!isNonEmptyString(p.id)) return fail(['plan.id required']);
  if (typeof p.sourceBasis !== 'string' || typeof p.inference !== 'string' || typeof p.adaptation !== 'string') {
    return fail(['sourceBasis/inference/adaptation required']);
  }
  if (!Array.isArray(p.assumptions) || !Array.isArray(p.reviewQuestions) || !Array.isArray(p.sourceChunkIds)) {
    return fail(['assumptions/reviewQuestions/sourceChunkIds required']);
  }
  if (!isNonEmptyString(p.reviewTrigger) && p.status !== 'needs_context' && p.status !== 'abstained') {
    return fail(['reviewTrigger required']);
  }

  const assumptions: ApplicationAssumptionV1[] = [];
  for (const a of p.assumptions) {
    const v = validateAssumption(a);
    if (v.ok === false) return fail(v.errors);
    assumptions.push(v.value);
  }

  let action: ApplicationActionV1 | null = null;
  if (p.action != null) {
    const av = validateAction(p.action);
    if (av.ok === false) return fail(av.errors);
    action = av.value;
  } else if (
    !opts?.allowNullAction &&
    (p.status === 'ready' || p.status === 'provisional')
  ) {
    return fail(['action required for ready/provisional']);
  }

  if (
    (p.status === 'ready' || p.status === 'provisional') &&
    (!p.sourceBasis.trim() || !p.inference.trim() || !p.adaptation.trim())
  ) {
    return fail(['source/inference/adaptation must be non-empty for actionable plans']);
  }

  if (p.status === 'ready' || p.status === 'provisional') {
    if (isGenericUnsupportedAdvice(p.adaptation) || (action && isGenericUnsupportedAdvice(action.verbLedInstruction))) {
      return fail(['generic unsupported advice']);
    }
  }

  if (p.selectedCandidateId && action) {
    // Affirmative action cannot rest on blocked statuses — checked at artifact level.
  }

  return {
    ok: true,
    value: {
      id: p.id.trim(),
      status: p.status,
      selectedCandidateId: p.selectedCandidateId ?? null,
      sourceBasis: p.sourceBasis.trim().slice(0, 800),
      inference: p.inference.trim().slice(0, 800),
      adaptation: p.adaptation.trim().slice(0, 800),
      assumptions,
      action,
      reviewTrigger: (p.reviewTrigger ?? '').trim().slice(0, 200),
      reviewQuestions: p.reviewQuestions
        .filter((q): q is string => typeof q === 'string')
        .map((q) => q.trim())
        .filter(Boolean)
        .slice(0, 5),
      risk: p.risk ?? 'low',
      abstentionReason: p.abstentionReason?.trim(),
      needsContextPrompt: p.needsContextPrompt?.trim(),
      sourceChunkIds: p.sourceChunkIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 20),
      startedAt:
        typeof p.startedAt === 'string' && p.startedAt.trim()
          ? p.startedAt.trim()
          : undefined,
    },
  };
}

export function validateReview(raw: unknown): ValidateResult<ApplicationReviewV1 | null> {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== 'object') return fail(['review invalid']);
  const r = raw as ApplicationReviewV1;
  const outcomes = ['worked', 'partial', 'did_not_work', 'abandoned'] as const;
  if (!outcomes.includes(r.outcome as (typeof outcomes)[number])) {
    return fail(['review.outcome invalid']);
  }
  if (!isNonEmptyString(r.id) || !isNonEmptyString(r.reviewedAt)) {
    return fail(['review id/reviewedAt required']);
  }
  return {
    ok: true,
    value: {
      id: r.id.trim(),
      outcome: r.outcome,
      privateNote:
        typeof r.privateNote === 'string' ? r.privateNote.trim().slice(0, 1000) : undefined,
      failedAssumptionId:
        typeof r.failedAssumptionId === 'string' ? r.failedAssumptionId.trim() : undefined,
      wantsAdjust: Boolean(r.wantsAdjust),
      wantsRepeat: Boolean(r.wantsRepeat),
      reviewedAt: r.reviewedAt,
    },
  };
}

export function validateApplicationArtifact(
  input: unknown,
  opts?: { strictVersions?: boolean; candidates?: ApplicationCandidateV1[] }
): ValidateResult<ApplicationArtifactV1> {
  if (!input || typeof input !== 'object') return fail(['artifact invalid']);
  const raw = input as ApplicationArtifactV1;

  if (opts?.strictVersions !== false) {
    if (!APPLICATION_SUPPORTED_SCHEMA_VERSIONS.has(raw.schemaVersion)) {
      return fail([`unsupported schemaVersion ${raw.schemaVersion}`]);
    }
    if (!APPLICATION_SUPPORTED_PROMPT_VERSIONS.has(raw.promptVersion)) {
      return fail([`unsupported promptVersion ${raw.promptVersion}`]);
    }
    if (!APPLICATION_SUPPORTED_COMPILER_VERSIONS.has(raw.compilerVersion)) {
      return fail([`unsupported compilerVersion ${raw.compilerVersion}`]);
    }
    if (!APPLICATION_SUPPORTED_POLICY_VERSIONS.has(raw.policyVersion)) {
      return fail([`unsupported policyVersion ${raw.policyVersion}`]);
    }
  }

  const ctx = validateContext(raw.context);
  if (ctx.ok === false) return fail(ctx.errors);

  if (!Array.isArray(raw.candidates)) return fail(['candidates required']);
  const candidates: ApplicationCandidateV1[] = [];
  for (const c of raw.candidates) {
    const v = validateCandidate(c);
    if (v.ok === false) return fail(v.errors);
    candidates.push(v.value);
  }

  const allowNullAction =
    raw.status === 'needs_context' ||
    raw.status === 'abstained' ||
    raw.status === 'cancelled' ||
    raw.status === 'invalid';
  const plan = validatePlan(raw.plan, { allowNullAction });
  if (plan.ok === false) return fail(plan.errors);

  const review = validateReview(raw.review);
  if (review.ok === false) return fail(review.errors);
  if (review.value?.failedAssumptionId) {
    const ok = plan.value.assumptions.some((a) => a.id === review.value!.failedAssumptionId);
    if (!ok) return fail(['failedAssumptionId not in plan assumptions']);
  }

  // Artifact ↔ plan status coherence (fail-closed for needs_context / abstained).
  if (plan.value.status === 'needs_context' && raw.status !== 'needs_context') {
    return fail(['artifact status must be needs_context when plan needs context']);
  }
  if (plan.value.status === 'abstained' && raw.status !== 'abstained') {
    return fail(['artifact status must be abstained when plan abstained']);
  }
  if (plan.value.status === 'provisional' && raw.status !== 'provisional') {
    return fail(['artifact status must be provisional when plan is provisional']);
  }
  if (
    (plan.value.status === 'ready' ||
      plan.value.status === 'in_progress' ||
      plan.value.status === 'completed' ||
      plan.value.status === 'abandoned') &&
    raw.status !== 'complete'
  ) {
    return fail(['artifact status must be complete for actionable/finished plans']);
  }

  // Policy: affirmative plan cannot select blocked epistemic status.
  if (plan.value.selectedCandidateId && plan.value.action) {
    const selected =
      candidates.find((c) => c.id === plan.value.selectedCandidateId) ||
      opts?.candidates?.find((c) => c.id === plan.value.selectedCandidateId);
    if (selected && isBlockedAffirmativeStatus(selected.epistemicStatus)) {
      return fail(['contradicted/degraded/insufficient claim cannot ground action']);
    }
  }

  if (isHighRisk(plan.value.risk) && plan.value.status === 'ready' && !plan.value.assumptions.length) {
    // High risk ready plans must keep explicit caution assumptions or abstain.
    if (!/profesional|m[eé]dico|no\s+sustituye/i.test(plan.value.adaptation)) {
      return fail(['high-risk ready plan missing professional caution']);
    }
  }

  if (
    !isNonEmptyString(raw.contentHash) ||
    !isNonEmptyString(raw.contextCanonicalHash) ||
    !isNonEmptyString(raw.depth) ||
    !isNonEmptyString(raw.createdAt)
  ) {
    return fail(['contentHash/contextCanonicalHash/depth/createdAt required']);
  }

  return {
    ok: true,
    value: {
      schemaVersion: raw.schemaVersion || APPLICATION_SCHEMA_VERSION,
      promptVersion: raw.promptVersion || APPLICATION_PROMPT_VERSION,
      compilerVersion: raw.compilerVersion || APPLICATION_COMPILER_VERSION,
      policyVersion: raw.policyVersion || APPLICATION_POLICY_VERSION,
      modelVersion: String(raw.modelVersion || 'unknown'),
      modelRoute: String(raw.modelRoute || ''),
      status: raw.status,
      contentHash: raw.contentHash,
      sourceId: raw.sourceId,
      sourceVersionId: raw.sourceVersionId,
      depth: raw.depth,
      contextCanonicalHash: raw.contextCanonicalHash,
      understandingSchemaVersion: raw.understandingSchemaVersion,
      understandingPromptVersion: raw.understandingPromptVersion,
      understandingCompilerVersion: raw.understandingCompilerVersion,
      evidenceSchemaVersion: raw.evidenceSchemaVersion,
      evidencePromptVersion: raw.evidencePromptVersion,
      evidenceVerifierVersion: raw.evidenceVerifierVersion,
      evidenceCompilerVersion: raw.evidenceCompilerVersion,
      evidenceDigest: raw.evidenceDigest,
      context: ctx.value,
      candidates,
      plan: plan.value,
      review: review.value,
      createdAt: raw.createdAt,
    },
  };
}

export function rehydrateApplication(
  input: unknown
): ApplicationArtifactV1 | null {
  const v = validateApplicationArtifact(input, { strictVersions: true });
  return v.ok ? v.value : null;
}
