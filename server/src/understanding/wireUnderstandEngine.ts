/**
 * Adapter: productive `runUnderstandEngine` for registerTransformRoutes.
 * Keeps Gemini calls out of the shared route module.
 */

import type { ActionMapData, TransformRequest } from '../../../shared/contracts';
import type { IngestResult } from '../../../shared/types/chunk';
import {
  UNDERSTANDING_MODEL_ROUTE,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
  compileEssentialPartial,
} from '../../../shared/understanding';
import {
  runUnderstandEngine,
  type UnderstandJsonGenerator,
} from './runUnderstandEngine';

export type UnderstandEngineHttpResult =
  | { ok: true; map: ActionMapData; model: string }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
      essentialPartial?: ActionMapData;
    };

function statusForCode(code: string): number {
  if (code === 'UNDERSTAND_CANCELLED') return 499;
  if (code === 'UNDERSTAND_INSUFFICIENT_SOURCE') return 400;
  return 422;
}

export function createRunUnderstandEngineDep(args: {
  generateJson: UnderstandJsonGenerator;
  onTelemetry?: Parameters<typeof runUnderstandEngine>[0]['onTelemetry'];
}): (opts: {
  body: TransformRequest;
  ingest: IngestResult | null;
  contentHash?: string;
  provenance?: import('../../../shared/understanding').SourceProvenance;
  userId?: string;
  isCancelled: () => boolean;
  onStage?: (label: string) => void;
  onEssentialReady?: (partial: ActionMapData) => void;
}) => Promise<UnderstandEngineHttpResult> {
  return async (opts) => {
    const sourceText = typeof opts.body.text === 'string' ? opts.body.text : '';
    const result = await runUnderstandEngine({
      body: { ...opts.body, intent: 'understand' },
      sourceText,
      ingest: opts.ingest,
      ownerId: opts.userId,
      contentHash: opts.contentHash,
      provenance: opts.provenance,
      generateJson: args.generateJson,
      isCancelled: opts.isCancelled,
      onTelemetry: args.onTelemetry,
      onStage: opts.onStage,
      onEssentialReady: (partial) => opts.onEssentialReady?.(partial),
    });

    if (result.ok === false) {
      const essentialPartial = result.essentialOnly
        ? compileEssentialPartial(result.essentialOnly.partialArtifact)
        : undefined;
      return {
        ok: false as const,
        status: statusForCode(result.code),
        error: result.message,
        code: result.code,
        essentialPartial,
      };
    }

    return {
      ok: true as const,
      map: result.map,
      model: result.artifact.modelVersion || UNDERSTANDING_MODEL_ROUTE,
    };
  };
}

/** Log S04 telemetry without source text, prompts, or Nucleo content. */
export function logUnderstandingTelemetry(
  event: import('../../../shared/understanding').UnderstandingTelemetryEvent
): void {
  console.log('[s04-understanding]', {
    schemaVersion: event.schemaVersion || UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: event.promptVersion || UNDERSTANDING_PROMPT_VERSION,
    modelVersion: event.modelVersion,
    stage: event.stage,
    durationMs: event.durationMs,
    unitCount: event.unitCount,
    validationFailed: event.validationFailed,
    repairUsed: event.repairUsed,
    cancelled: event.cancelled,
    cacheHit: event.cacheHit,
    errorCode: event.errorCode,
    depth: event.depth,
    intent: event.intent,
  });
}
