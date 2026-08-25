/**
 * Adapter: productive runApplicationEngine for registerTransformRoutes.
 */

import type { ActionMapData, TransformRequest } from '../../../shared/contracts';
import type { EvidenceArtifact } from '../../../shared/evidence/types';
import {
  APPLICATION_MODEL_ROUTE,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
  runApplicationEngine,
  type ApplicationJsonGenerator,
  type ApplicationContextV1,
} from '../../../shared/application';
import {
  APPLICATION_PLAN_SYSTEM_PROMPT,
  buildApplicationPlanUserPrompt,
  buildApplicationRepairUserPrompt,
} from './prompts';

export type ApplicationEngineHttpResult =
  | { ok: true; map: ActionMapData; cacheHit: boolean; model: string }
  | { ok: false; status: number; error: string; code: string };

function statusForCode(code: string): number {
  if (code === 'APPLICATION_CANCELLED') return 499;
  if (code === 'APPLICATION_NEEDS_CONTEXT') return 200;
  if (
    code === 'APPLICATION_INSUFFICIENT_SOURCE' ||
    code === 'APPLICATION_NO_SAFE_BASE'
  ) {
    return 400;
  }
  if (
    code === 'APPLICATION_INVALID_PLAN' ||
    code === 'APPLICATION_REPAIR_FAILED' ||
    code === 'APPLICATION_GENERIC_ADVICE' ||
    code === 'APPLICATION_HIGH_RISK_ABSTAIN' ||
    code === 'APPLICATION_POLICY_REJECT' ||
    code === 'APPLICATION_COMPILE_FAILED'
  ) {
    return 422;
  }
  return 500;
}

export function createRunApplicationEngineDep(args: {
  generateJson: ApplicationJsonGenerator;
  onTelemetry?: Parameters<typeof runApplicationEngine>[0]['onTelemetry'];
}): (opts: {
  body: TransformRequest;
  map: ActionMapData;
  evidence: EvidenceArtifact;
  contentHash: string;
  context?: ApplicationContextV1;
  userId?: string;
  isCancelled: () => boolean;
  onStage?: (label: string) => void;
}) => Promise<ApplicationEngineHttpResult> {
  return async (opts) => {
    const result = await runApplicationEngine({
      body: { ...opts.body, intent: 'apply' },
      map: opts.map,
      evidence: opts.evidence,
      contentHash: opts.contentHash,
      context: opts.context ?? opts.body.applicationContext,
      ownerId: opts.userId,
      generateJson: args.generateJson,
      buildPlanPrompts: (p) => ({
        system: APPLICATION_PLAN_SYSTEM_PROMPT,
        user: buildApplicationPlanUserPrompt(p),
      }),
      buildRepairPrompt: buildApplicationRepairUserPrompt,
      isCancelled: opts.isCancelled,
      onTelemetry: args.onTelemetry,
      onStage: opts.onStage,
    });

    if (result.ok === false) {
      return {
        ok: false as const,
        status: statusForCode(result.code),
        error: result.message,
        code: result.code,
      };
    }

    return {
      ok: true as const,
      map: result.map,
      cacheHit: result.cacheHit,
      model: result.artifact.modelVersion || APPLICATION_MODEL_ROUTE,
    };
  };
}

export function logApplicationTelemetry(
  event: import('../../../shared/application').ApplicationTelemetryEvent
): void {
  console.log('[s06-application]', {
    schemaVersion: event.schemaVersion || APPLICATION_SCHEMA_VERSION,
    promptVersion: event.promptVersion || APPLICATION_PROMPT_VERSION,
    modelVersion: event.modelVersion,
    stage: event.stage,
    durationMs: event.durationMs,
    validationFailed: event.validationFailed,
    repairUsed: event.repairUsed,
    cancelled: event.cancelled,
    cacheHit: event.cacheHit,
    errorCode: event.errorCode,
    depth: event.depth,
    intent: event.intent,
    contextHashPresent: event.contextHashPresent,
  });
}
