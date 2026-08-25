/**
 * S06 Application Engine — shared orchestration.
 * Pipeline: evidence → candidates → context gate → plan → validate → compile.
 */

import type { ActionMapData, MapDepth, TransformRequest } from '../contracts';
import type { EvidenceArtifact } from '../evidence/types';
import { extractApplicationCandidates } from './candidates';
import {
  deleteApplicationCache,
  getApplicationCache,
  setApplicationCache,
} from './cache';
import {
  buildDeterministicPlan,
  compileApplicationToMap,
} from './compile';
import { applyModelDraft } from './applyModelDraft';
import { applicationCacheKey as buildCacheKey, canonicalContextHash } from './ids';
import {
  evidenceArtifactDigest,
  evidenceVersionPins,
  understandingVersionPins,
} from './evidenceDigest';
import { classifyAdaptationRisk } from './policy';
import { coerceModelPlanDraft, wrapUntrusted } from './untrusted';
import { validateApplicationArtifact, validateContext, validatePlan } from './validate';
import type { ApplicationArtifactV1, ApplicationContextV1, ApplicationTelemetryEvent } from './types';
import {
  APPLICATION_COMPILER_VERSION,
  APPLICATION_MODEL_ROUTE,
  APPLICATION_POLICY_VERSION,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
  APPLICATION_STAGE_LABELS,
} from './versions';

export type ApplicationJsonGenerator = (args: {
  stage: 'plan' | 'repair';
  system: string;
  user: string;
  maxOutputTokens: number;
}) => Promise<{ text: string; model: string }>;

export type RunApplicationEngineArgs = {
  body: TransformRequest;
  map: ActionMapData;
  evidence: EvidenceArtifact;
  contentHash: string;
  context?: ApplicationContextV1;
  ownerId?: string;
  /** Optional S04 pins from understanding artifact. */
  understandingVersions?: {
    schemaVersion?: string;
    promptVersion?: string;
    compilerVersion?: string;
  };
  generateJson?: ApplicationJsonGenerator;
  buildPlanPrompts?: (args: {
    evidenceSummary: string;
    candidatesJson: string;
    contextJson: string;
    deterministicPlanJson: string;
  }) => { system: string; user: string };
  buildRepairPrompt?: (args: {
    errors: string[];
    previousJson: string;
  }) => { system: string; user: string };
  isCancelled?: () => boolean;
  onTelemetry?: (event: ApplicationTelemetryEvent) => void;
  onStage?: (label: string) => void;
};

export type RunApplicationEngineResult =
  | {
      ok: true;
      artifact: ApplicationArtifactV1;
      map: ActionMapData;
      cacheHit: boolean;
    }
  | { ok: false; code: string; message: string };

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('invalid_json');
  }
}

function evidenceSummary(evidence: EvidenceArtifact): string {
  return evidence.claims
    .slice(0, 12)
    .map(
      (c) =>
        `[${c.presentationStatus}] ${c.id}: ${c.text.slice(0, 160)}`
    )
    .join('\n');
}

export async function runApplicationEngine(
  args: RunApplicationEngineArgs
): Promise<RunApplicationEngineResult> {
  const t0 = Date.now();
  const depth: MapDepth =
    args.body.depth === 'rapido' || args.body.depth === 'profundo'
      ? args.body.depth
      : 'estandar';

  const ctxRaw = args.context ?? args.body.applicationContext ?? {};
  const ctxResult = validateContext(ctxRaw);
  if (ctxResult.ok === false) {
    return {
      ok: false,
      code: 'APPLICATION_INVALID_PLAN',
      message: ctxResult.errors.join('; '),
    };
  }
  const context = ctxResult.value;
  const contextCanonicalHash = canonicalContextHash(context);

  const emit = (
    stage: string,
    extra: Partial<ApplicationTelemetryEvent> = {}
  ) => {
    args.onTelemetry?.({
      schemaVersion: APPLICATION_SCHEMA_VERSION,
      promptVersion: APPLICATION_PROMPT_VERSION,
      compilerVersion: APPLICATION_COMPILER_VERSION,
      policyVersion: APPLICATION_POLICY_VERSION,
      modelVersion: extra.modelVersion ?? 'unknown',
      stage,
      durationMs: Date.now() - t0,
      depth,
      intent: 'apply',
      contextHashPresent: Boolean(contextCanonicalHash),
      ...extra,
    });
  };

  if (args.isCancelled?.()) {
    return { ok: false, code: 'APPLICATION_CANCELLED', message: 'Creación cancelada' };
  }

  args.onStage?.(APPLICATION_STAGE_LABELS.analyzing);

  const uPins = understandingVersionPins(args.understandingVersions);
  const ePins = evidenceVersionPins(args.evidence);
  const evidenceDigest = evidenceArtifactDigest(args.evidence);

  const cacheKey =
    args.ownerId && args.contentHash
      ? buildCacheKey({
          ownerId: args.ownerId,
          contentHash: args.contentHash,
          sourceVersionId: args.body.sourceVersionId,
          depth,
          contextCanonicalHash,
          evidenceDigest,
          understandingSchemaVersion: uPins.schema,
          understandingPromptVersion: uPins.prompt,
          understandingCompilerVersion: uPins.compiler,
          evidenceSchemaVersion: ePins.schema,
          evidencePromptVersion: ePins.prompt,
          evidenceVerifierVersion: ePins.verifier,
          evidenceCompilerVersion: ePins.compiler,
        })
      : null;

  if (cacheKey && args.ownerId) {
    const hit = getApplicationCache(cacheKey, args.ownerId);
    if (hit) {
      emit('cache', { cacheHit: true, modelVersion: hit.modelVersion });
      const map = compileApplicationToMap({ baseMap: args.map, artifact: hit });
      return { ok: true, artifact: hit, map, cacheHit: true };
    }
  }

  if (args.isCancelled?.()) {
    return { ok: false, code: 'APPLICATION_CANCELLED', message: 'Creación cancelada' };
  }

  args.onStage?.(APPLICATION_STAGE_LABELS.candidates);
  const sourceId = args.body.sourceId;
  const sourceVersionId = args.body.sourceVersionId;

  const candidates = extractApplicationCandidates({
    evidence: args.evidence,
    contentHash: args.contentHash,
    depth,
    contextCanonicalHash,
    sourceVersionId,
    context,
  });

  if (args.isCancelled?.()) {
    return { ok: false, code: 'APPLICATION_CANCELLED', message: 'Creación cancelada' };
  }

  args.onStage?.(APPLICATION_STAGE_LABELS.adapting);
  let artifact = buildDeterministicPlan({
    candidates,
    evidence: args.evidence,
    context,
    contentHash: args.contentHash,
    depth,
    contextCanonicalHash,
    sourceId,
    sourceVersionId,
    evidenceDigest,
    understandingSchemaVersion: uPins.schema,
    understandingPromptVersion: uPins.prompt,
    understandingCompilerVersion: uPins.compiler,
    evidenceSchemaVersion: ePins.schema,
    evidencePromptVersion: ePins.prompt,
    evidenceVerifierVersion: ePins.verifier,
    evidenceCompilerVersion: ePins.compiler,
  });

  const compilerRisk = classifyAdaptationRisk([
    artifact.plan.sourceBasis,
    context.goal ?? '',
    context.situation ?? '',
  ]);

  // Optional model enrichment — limited draft only; compiler rebuilds provenance.
  if (
    args.generateJson &&
    args.buildPlanPrompts &&
    (artifact.plan.status === 'ready' || artifact.plan.status === 'provisional') &&
    artifact.plan.action
  ) {
    args.onStage?.(APPLICATION_STAGE_LABELS.preparing);
    let modelVersion = 'unknown';
    let repaired = false;
    try {
      const prompts = args.buildPlanPrompts({
        evidenceSummary: wrapUntrusted('evidence', evidenceSummary(args.evidence)),
        candidatesJson: wrapUntrusted(
          'candidates',
          JSON.stringify(candidates.slice(0, 5))
        ),
        contextJson: wrapUntrusted(
          'context',
          JSON.stringify({
            hasGoal: Boolean(context.goal),
            hasSituation: Boolean(context.situation),
            hasConstraint: Boolean(context.constraint),
            hasHorizon: Boolean(context.horizon),
            goal: context.goal ?? null,
            situation: context.situation ?? null,
            constraint: context.constraint ?? null,
            horizon: context.horizon ?? null,
          })
        ),
        deterministicPlanJson: wrapUntrusted(
          'deterministic_plan',
          JSON.stringify({
            selectedCandidateId: artifact.plan.selectedCandidateId,
            inference: artifact.plan.inference,
            adaptation: artifact.plan.adaptation,
            action: artifact.plan.action,
            assumptions: artifact.plan.assumptions,
            reviewTrigger: artifact.plan.reviewTrigger,
            reviewQuestions: artifact.plan.reviewQuestions,
            // provenance omitted — model must not author it
          })
        ),
      });
      const first = await args.generateJson({
        stage: 'plan',
        system: prompts.system,
        user: prompts.user,
        maxOutputTokens: 2048,
      });
      modelVersion = first.model;
      if (args.isCancelled?.()) {
        return { ok: false, code: 'APPLICATION_CANCELLED', message: 'Creación cancelada' };
      }
      const draft = coerceModelPlanDraft(parseJsonObject(first.text));
      let applied = applyModelDraft({
        base: artifact,
        draft,
        evidence: args.evidence,
        compilerRisk,
      });
      if (applied.ok === false) {
        if (args.buildRepairPrompt) {
          repaired = true;
          const repair = args.buildRepairPrompt({
            errors: applied.errors,
            previousJson: wrapUntrusted('draft', JSON.stringify(draft)),
          });
          const second = await args.generateJson({
            stage: 'repair',
            system: repair.system,
            user: repair.user,
            maxOutputTokens: 2048,
          });
          modelVersion = second.model;
          if (args.isCancelled?.()) {
            return { ok: false, code: 'APPLICATION_CANCELLED', message: 'Creación cancelada' };
          }
          const repairedDraft = coerceModelPlanDraft(parseJsonObject(second.text));
          applied = applyModelDraft({
            base: artifact,
            draft: repairedDraft,
            evidence: args.evidence,
            compilerRisk,
          });
          if (applied.ok === false) {
            emit('repair', {
              validationFailed: true,
              repairUsed: true,
              errorCode: 'APPLICATION_REPAIR_FAILED',
              modelVersion,
            });
            return {
              ok: false,
              code: 'APPLICATION_REPAIR_FAILED',
              message: applied.errors.join('; '),
            };
          }
        } else {
          const det = validateApplicationArtifact(artifact);
          if (det.ok === false) {
            return {
              ok: false,
              code: 'APPLICATION_INVALID_PLAN',
              message: applied.errors.join('; '),
            };
          }
          artifact = det.value;
          emit('plan', { validationFailed: true, repairUsed: false, modelVersion });
        }
      }
      if (applied.ok === true) {
        artifact = { ...applied.artifact, modelVersion };
        emit('plan', { repairUsed: repaired, modelVersion });
      }
    } catch {
      emit('plan', {
        validationFailed: true,
        errorCode: 'APPLICATION_PROVIDER_ERROR',
      });
      const det = validateApplicationArtifact(artifact);
      if (det.ok === false) {
        return {
          ok: false,
          code: 'APPLICATION_PROVIDER_ERROR',
          message: 'El proveedor falló y no hay plan válido de reserva.',
        };
      }
      artifact = det.value;
    }
  }

  if (args.isCancelled?.()) {
    return { ok: false, code: 'APPLICATION_CANCELLED', message: 'Creación cancelada' };
  }

  const final = validateApplicationArtifact(artifact);
  if (final.ok === false) {
    if (cacheKey) deleteApplicationCache(cacheKey);
    return {
      ok: false,
      code: 'APPLICATION_COMPILE_FAILED',
      message: final.errors.join('; '),
    };
  }

  // Plan validation double-check for actionable statuses.
  if (final.value.plan.status === 'ready' || final.value.plan.status === 'provisional') {
    const pv = validatePlan(final.value.plan);
    if (pv.ok === false) {
      return {
        ok: false,
        code: 'APPLICATION_INVALID_PLAN',
        message: pv.errors.join('; '),
      };
    }
  }

  if (cacheKey && args.ownerId) {
    setApplicationCache(cacheKey, args.ownerId, final.value);
  }

  const map = compileApplicationToMap({
    baseMap: args.map,
    artifact: final.value,
  });

  emit('done', {
    cacheHit: false,
    modelVersion: final.value.modelVersion,
  });

  return { ok: true, artifact: final.value, map, cacheHit: false };
}

export { APPLICATION_MODEL_ROUTE, APPLICATION_STAGE_LABELS };
