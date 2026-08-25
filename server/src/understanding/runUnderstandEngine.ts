/**
 * S04 Understanding Engine — staged runner (blueprint → units → compile).
 * Injectable JSON generator for Gemini (prod) or fixtures (tests).
 */

import type { ActionMapData, MapDepth, TransformRequest } from '../../../shared/contracts';
import type { IngestResult } from '../../../shared/types/chunk';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
  UNDERSTANDING_STAGE_LABELS,
  buildSourceProvenance,
  canonicalizeUnits,
  compileEssentialPartial,
  compileUnderstandingToMap,
  deleteUnderstandingCache,
  getUnderstandingCache,
  setUnderstandingCache,
  understandingDepthBudget,
  validateArtifact,
  validateBlueprint,
  validateClosure,
  validateUnits,
  type SourceProvenance,
  type UnderstandingArtifact,
  type UnderstandingBlueprint,
  type UnderstandingClosure,
  type UnderstandingEngineError,
  type UnderstandingEngineOk,
  type UnderstandingTelemetryEvent,
} from '../../../shared/understanding';
import {
  BLUEPRINT_SYSTEM_PROMPT,
  UNITS_SYSTEM_PROMPT,
  buildBlueprintUserPrompt,
  buildUnitsUserPrompt,
  buildRepairUserPrompt,
} from './prompts';

function validationErrorsFrom(result: { ok: boolean; errors?: string[] }): string[] {
  if (result.ok) return [];
  return Array.isArray(result.errors) ? result.errors : [];
}

export type UnderstandJsonGenerator = (args: {
  stage: 'blueprint' | 'units' | 'repair';
  system: string;
  user: string;
  maxOutputTokens: number;
}) => Promise<{ text: string; model: string }>;

export type RunUnderstandEngineArgs = {
  body: TransformRequest;
  sourceText: string;
  ingest: IngestResult | null;
  ownerId?: string;
  contentHash?: string;
  provenance?: SourceProvenance;
  generateJson: UnderstandJsonGenerator;
  isCancelled?: () => boolean;
  onTelemetry?: (event: UnderstandingTelemetryEvent) => void;
  onStage?: (label: string) => void;
  onEssentialReady?: (partial: ActionMapData, blueprint: UnderstandingBlueprint) => void;
};

function allowedChunkIds(ingest: IngestResult | null): Set<string> {
  const set = new Set<string>();
  for (const c of ingest?.chunks ?? []) {
    if (c.id) set.add(c.id);
  }
  return set;
}

function artifactHasSegmentRefs(artifact: UnderstandingArtifact): boolean {
  return artifact.units.some((u) => u.segmentRefs.length > 0);
}

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

function resolveProvenance(args: RunUnderstandEngineArgs): SourceProvenance {
  if (args.provenance) return args.provenance;
  return buildSourceProvenance({
    body: args.body,
    ingest: args.ingest,
    contentHash: args.contentHash,
    sourceId: args.body.sourceId,
    sourceVersionId: args.body.sourceVersionId,
  });
}

function cacheArgs(args: RunUnderstandEngineArgs, depth: MapDepth) {
  return {
    ownerId: args.ownerId!,
    contentHash: args.contentHash!,
    sourceId: args.body.sourceId,
    sourceVersionId: args.body.sourceVersionId,
    depth,
  };
}

export async function runUnderstandEngine(
  args: RunUnderstandEngineArgs
): Promise<
  | (UnderstandingEngineOk & { map: ActionMapData })
  | UnderstandingEngineError
> {
  const depth: MapDepth =
    args.body.depth === 'rapido' || args.body.depth === 'profundo'
      ? args.body.depth
      : 'estandar';
  const budget = understandingDepthBudget(depth);
  const chunkIds = allowedChunkIds(args.ingest);
  const provenance = resolveProvenance(args);
  const t0 = Date.now();
  let blueprintMs = 0;
  let unitsMs = 0;
  let repaired = false;
  let cacheHit = false;
  let modelVersion = 'unknown';
  let essentialReadyAt: number | undefined;
  let repairReason: string | undefined;

  const emit = (
    stage: UnderstandingTelemetryEvent['stage'],
    extra: Partial<UnderstandingTelemetryEvent> = {}
  ) => {
    args.onTelemetry?.({
      schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
      promptVersion: UNDERSTANDING_PROMPT_VERSION,
      modelVersion,
      stage,
      durationMs: Date.now() - t0,
      depth,
      intent: 'understand',
      ...extra,
    });
  };

  if (args.isCancelled?.()) {
    return {
      ok: false,
      code: 'UNDERSTAND_CANCELLED',
      message: 'Creación cancelada',
    };
  }

  const sourceTrim = args.sourceText?.trim() ?? '';
  if (sourceTrim.length < 24) {
    return {
      ok: false,
      code: 'UNDERSTAND_INSUFFICIENT_SOURCE',
      message: 'La fuente es demasiado corta para construir un Núcleo de comprensión.',
    };
  }

  const contentHash =
    args.contentHash ||
    provenance.contentHash ||
    args.body.sourceRequestId ||
    args.body.mapId ||
    'local';

  const compileOpts = {
    provenance: {
      ...provenance,
      contentHash,
    },
  };

  // ——— Cache lookup BEFORE any model call ———
  if (args.ownerId && args.contentHash) {
    const cached = getUnderstandingCache(cacheArgs(args, depth));
    if (cached) {
      // Never authorize a cache entry using its own segmentRefs.
      if (artifactHasSegmentRefs(cached) && chunkIds.size === 0) {
        deleteUnderstandingCache(cacheArgs(args, depth));
        emit('cache', { cacheHit: false, validationFailed: true });
      } else {
        const validated = validateArtifact(cached, {
          allowedChunkIds: chunkIds.size ? chunkIds : new Set(),
          depth,
          strictVersions: true,
        });
        if (!validated.ok || validated.value.status !== 'complete') {
          deleteUnderstandingCache(cacheArgs(args, depth));
          emit('cache', { cacheHit: false, validationFailed: true });
        } else if (args.isCancelled?.()) {
          return {
            ok: false,
            code: 'UNDERSTAND_CANCELLED',
            message: 'Creación cancelada',
          };
        } else {
          cacheHit = true;
          modelVersion = validated.value.modelVersion;
          args.onStage?.(UNDERSTANDING_STAGE_LABELS.essential);
          const partialMap = compileEssentialPartial(validated.value);
          essentialReadyAt = Date.now() - t0;
          args.onEssentialReady?.(partialMap, validated.value.blueprint);
          emit('cache', { cacheHit: true });

          if (args.isCancelled?.()) {
            return {
              ok: false,
              code: 'UNDERSTAND_CANCELLED',
              message: 'Creación cancelada',
              essentialOnly: {
                blueprint: validated.value.blueprint,
                partialArtifact: {
                  ...validated.value,
                  status: 'essential_only',
                  units: [],
                  closure: null,
                },
              },
            };
          }

        const compiled = compileUnderstandingToMap(validated.value, compileOpts);
        if (!compiled.ok) {
          deleteUnderstandingCache(cacheArgs(args, depth));
          emit('compile', { validationFailed: true, cacheHit: true, errorCode: compiled.error.slice(0, 160) });
          console.error('[s04-understanding-compile-failed]', {
            error: compiled.error,
            unitCount: validated.value.units.length,
            depth,
            cacheHit: true,
          });
          return {
            ok: false,
            code: 'UNDERSTAND_COMPILE_FAILED',
            message: 'No se pudo preparar el Núcleo.',
          };
        }
        if (args.ingest?.chunks?.length) {
          compiled.map.chunkIdManifest = args.ingest.chunks.map((c) => c.id);
        }
        emit('compile', { unitCount: validated.value.units.length, cacheHit: true });
        return {
          ok: true,
          artifact: validated.value,
          repaired: false,
          cacheHit: true,
          timingsMs: {
            blueprint: 0,
            units: 0,
            total: Date.now() - t0,
            essentialReadyAt,
          },
          map: compiled.map,
        };
        }
      }
    }
  }

  args.onStage?.(UNDERSTANDING_STAGE_LABELS.classifying);

  // ——— Stage 1: blueprint ———
  const bpStart = Date.now();
  let blueprintRaw: unknown;
  try {
    const bpGen = await args.generateJson({
      stage: 'blueprint',
      system: BLUEPRINT_SYSTEM_PROMPT,
      user: buildBlueprintUserPrompt({
        sourceText: sourceTrim,
        depth,
        chunkIds: [...chunkIds],
      }),
      maxOutputTokens: budget.blueprintMaxOutputTokens,
    });
    modelVersion = bpGen.model;
    blueprintRaw = parseJsonObject(bpGen.text);
  } catch (error) {
    console.error('[s04-understanding-blueprint-failed]', {
      message:
        error instanceof Error
          ? error.message.slice(0, 240)
          : String(error ?? 'unknown').slice(0, 240),
      depth,
      sourceLength: sourceTrim.length,
      chunkCount: chunkIds.size,
    });
    return {
      ok: false,
      code: 'UNDERSTAND_INVALID_BLUEPRINT',
      message: 'No se pudo clasificar la fuente.',
    };
  }
  blueprintMs = Date.now() - bpStart;

  if (args.isCancelled?.()) {
    return { ok: false, code: 'UNDERSTAND_CANCELLED', message: 'Creación cancelada' };
  }

  let blueprintResult = validateBlueprint(blueprintRaw);
  if (!blueprintResult.ok) {
    const blueprintErrors = validationErrorsFrom(blueprintResult);
    repaired = true;
    repairReason = `blueprint:${blueprintErrors.slice(0, 3).join('|')}`;
    emit('repair', {
      repairUsed: true,
      validationFailed: true,
      errorCode: 'UNDERSTAND_INVALID_BLUEPRINT',
    });
    try {
      const repairGen = await args.generateJson({
        stage: 'repair',
        system: BLUEPRINT_SYSTEM_PROMPT,
        user: buildRepairUserPrompt({
          stage: 'blueprint',
          sourceText: sourceTrim,
          previousJson: blueprintRaw,
          errors: blueprintErrors,
          chunkIds: [...chunkIds],
        }),
        maxOutputTokens: budget.blueprintMaxOutputTokens,
      });
      modelVersion = repairGen.model;
      blueprintRaw = parseJsonObject(repairGen.text);
      blueprintResult = validateBlueprint(blueprintRaw);
    } catch {
      return {
        ok: false,
        code: 'UNDERSTAND_REPAIR_FAILED',
        message: 'La estructura de comprensión no es válida.',
      };
    }
  }

  if (!blueprintResult.ok) {
    emit('blueprint', { validationFailed: true, repairUsed: repaired });
    return {
      ok: false,
      code: 'UNDERSTAND_INVALID_BLUEPRINT',
      message: 'La estructura de comprensión no es válida.',
    };
  }

  const blueprint = blueprintResult.value;
  args.onStage?.(UNDERSTANDING_STAGE_LABELS.essential);

  const essentialPartialArtifact: UnderstandingArtifact = {
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    modelVersion,
    intent: 'understand',
    depth,
    status: 'essential_only',
    sourceId: args.body.sourceId ?? provenance.sourceId,
    sourceVersionId: args.body.sourceVersionId ?? provenance.sourceVersionId,
    contentHash,
    blueprint,
    units: [],
    closure: null,
  };

  const partialMap = compileEssentialPartial(essentialPartialArtifact);
  essentialReadyAt = Date.now() - t0;
  args.onEssentialReady?.(partialMap, blueprint);
  emit('blueprint', {
    durationMs: blueprintMs,
    repairUsed: repaired,
  });

  if (args.isCancelled?.()) {
    return {
      ok: false,
      code: 'UNDERSTAND_CANCELLED',
      message: 'Creación cancelada',
      essentialOnly: {
        blueprint,
        partialArtifact: essentialPartialArtifact,
      },
    };
  }

  // ——— Stage 2: units + closure ———
  args.onStage?.(UNDERSTANDING_STAGE_LABELS.units);
  const unitsStart = Date.now();
  let unitsPayload: unknown;
  let unitsResponseText = '';
  try {
    const unitsGen = await args.generateJson({
      stage: 'units',
      system: UNITS_SYSTEM_PROMPT,
      user: buildUnitsUserPrompt({
        sourceText: sourceTrim,
        depth,
        blueprint,
        chunkIds: [...chunkIds],
      }),
      maxOutputTokens: budget.unitsMaxOutputTokens,
    });
    modelVersion = unitsGen.model;
    unitsResponseText = unitsGen.text;
    unitsPayload = parseJsonObject(unitsGen.text);
  } catch (error) {
    console.error('[s04-understanding-units-generation-failed]', {
      message: error instanceof Error ? error.message.slice(0, 240) : 'unknown',
      depth,
      responseLength: unitsResponseText.length,
    });
    repaired = true;
    repairReason = 'units:provider output invalid';
    emit('repair', {
      repairUsed: true,
      validationFailed: true,
      errorCode: 'UNDERSTAND_INVALID_UNITS',
    });
    try {
      const retryGen = await args.generateJson({
        stage: 'repair',
        system: UNITS_SYSTEM_PROMPT,
        user: buildRepairUserPrompt({
          stage: 'units',
          sourceText: sourceTrim,
          previousJson: unitsResponseText || null,
          errors: ['La respuesta anterior no era JSON válido con units y closure completos.'],
          chunkIds: [...chunkIds],
          blueprint,
        }),
        maxOutputTokens: budget.unitsMaxOutputTokens,
      });
      modelVersion = retryGen.model;
      unitsResponseText = retryGen.text;
      unitsPayload = parseJsonObject(retryGen.text);
    } catch (retryError) {
      console.error('[s04-understanding-units-retry-failed]', {
        message: retryError instanceof Error ? retryError.message.slice(0, 240) : 'unknown',
        depth,
        responseLength: unitsResponseText.length,
      });
      return {
        ok: false,
        code: 'UNDERSTAND_INVALID_UNITS',
        message: 'No se pudieron conectar las ideas.',
        essentialOnly: {
          blueprint,
          partialArtifact: essentialPartialArtifact,
        },
      };
    }
  }
  unitsMs = Date.now() - unitsStart;

  if (args.isCancelled?.()) {
    return {
      ok: false,
      code: 'UNDERSTAND_CANCELLED',
      message: 'Creación cancelada',
      essentialOnly: {
        blueprint,
        partialArtifact: essentialPartialArtifact,
      },
    };
  }

  const unitsObj = (unitsPayload ?? {}) as Record<string, unknown>;
  let unitsRaw = unitsObj.units;
  let closureRaw = unitsObj.closure;

  let unitsResult = validateUnits(unitsRaw, {
    depth,
    allowedChunkIds: chunkIds.size ? chunkIds : new Set(['__none__']),
    blueprint,
  });

  if (!unitsResult.ok && chunkIds.size === 0) {
    const scrubbed = Array.isArray(unitsRaw)
      ? unitsRaw.map((u) => {
          if (!u || typeof u !== 'object') return u;
          return { ...(u as object), segmentRefs: [] };
        })
      : unitsRaw;
    unitsResult = validateUnits(scrubbed, {
      depth,
      allowedChunkIds: new Set(),
      blueprint,
    });
    unitsRaw = scrubbed;
  }

  let closureResult = validateClosure(closureRaw);

  if (!unitsResult.ok || !closureResult.ok) {
    const unitErrors = validationErrorsFrom(unitsResult);
    const closureErrors = validationErrorsFrom(closureResult);
    repaired = true;
    repairReason = `units:${[...unitErrors, ...closureErrors].slice(0, 3).join('|')}`;
    emit('repair', {
      repairUsed: true,
      validationFailed: true,
      errorCode: 'UNDERSTAND_INVALID_UNITS',
    });
    if (args.isCancelled?.()) {
      return {
        ok: false,
        code: 'UNDERSTAND_CANCELLED',
        message: 'Creación cancelada',
        essentialOnly: { blueprint, partialArtifact: essentialPartialArtifact },
      };
    }
    try {
      const repairGen = await args.generateJson({
        stage: 'repair',
        system: UNITS_SYSTEM_PROMPT,
        user: buildRepairUserPrompt({
          stage: 'units',
          sourceText: sourceTrim,
          previousJson: unitsPayload,
          errors: [...unitErrors, ...closureErrors],
          chunkIds: [...chunkIds],
          blueprint,
        }),
        maxOutputTokens: budget.unitsMaxOutputTokens,
      });
      modelVersion = repairGen.model;
      const repairedPayload = parseJsonObject(repairGen.text) as Record<string, unknown>;
      unitsRaw = repairedPayload.units;
      closureRaw = repairedPayload.closure;
      unitsResult = validateUnits(
        chunkIds.size === 0 && Array.isArray(unitsRaw)
          ? unitsRaw.map((u) =>
              u && typeof u === 'object' ? { ...(u as object), segmentRefs: [] } : u
            )
          : unitsRaw,
        {
          depth,
          allowedChunkIds: chunkIds,
          blueprint,
        }
      );
      closureResult = validateClosure(closureRaw);
    } catch {
      return {
        ok: false,
        code: 'UNDERSTAND_REPAIR_FAILED',
        message: 'No se pudieron conectar las ideas.',
        essentialOnly: { blueprint, partialArtifact: essentialPartialArtifact },
      };
    }
  }

  if (!unitsResult.ok) {
    const unitFailErrors = validationErrorsFrom(unitsResult);
    console.error('[s04-understanding-units-invalid]', {
      errorKinds: unitFailErrors.slice(0, 8).map((error) => error.split(':')[0]),
      errorCount: unitFailErrors.length,
      depth,
      unitCount: Array.isArray(unitsRaw) ? unitsRaw.length : 0,
      repairUsed: repaired,
    });
    const hallucinated = unitFailErrors.some((e) => /hallucinated chunkId/i.test(e));
    return {
      ok: false,
      code: hallucinated ? 'UNDERSTAND_HALLUCINATED_CHUNK' : 'UNDERSTAND_INVALID_UNITS',
      message: hallucinated
        ? 'Las referencias a la fuente no son válidas.'
        : 'No se pudieron conectar las ideas.',
      essentialOnly: { blueprint, partialArtifact: essentialPartialArtifact },
    };
  }

  if (!closureResult.ok) {
    return {
      ok: false,
      code: 'UNDERSTAND_INVALID_CLOSURE',
      message: 'No se pudo cerrar la comprensión.',
      essentialOnly: { blueprint, partialArtifact: essentialPartialArtifact },
    };
  }

  args.onStage?.(UNDERSTANDING_STAGE_LABELS.closing);

  const seedArgs = {
    contentHash,
    sourceVersionId: args.body.sourceVersionId ?? provenance.sourceVersionId,
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    depth,
  };
  const canonical = canonicalizeUnits(
    unitsResult.value,
    seedArgs,
    blueprint.plan.unitOrder
  );
  if (!canonical.ok) {
    emit('compile', { validationFailed: true });
    return {
      ok: false,
      code: 'UNDERSTAND_INVALID_UNITS',
      message: 'No se pudieron estabilizar las relaciones entre ideas.',
      essentialOnly: { blueprint, partialArtifact: essentialPartialArtifact },
    };
  }

  const closure: UnderstandingClosure = closureResult.value;
  const artifact: UnderstandingArtifact = {
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    modelVersion,
    intent: 'understand',
    depth,
    status: 'complete',
    sourceId: args.body.sourceId ?? provenance.sourceId,
    sourceVersionId: args.body.sourceVersionId ?? provenance.sourceVersionId,
    contentHash,
    blueprint,
    units: canonical.units,
    closure,
  };

  emit('units', {
    unitCount: canonical.units.length,
    repairUsed: repaired,
    durationMs: unitsMs,
    ...(repairReason ? { errorCode: undefined } : {}),
  });
  if (repairReason) {
    console.log('[s04-understanding-repair]', {
      reason: repairReason.slice(0, 120),
      depth,
      unitCount: canonical.units.length,
    });
  }

  if (args.isCancelled?.()) {
    return {
      ok: false,
      code: 'UNDERSTAND_CANCELLED',
      message: 'Creación cancelada',
      essentialOnly: { blueprint, partialArtifact: essentialPartialArtifact },
    };
  }

  const compiled = compileUnderstandingToMap(artifact, compileOpts);
  if (!compiled.ok) {
    emit('compile', { validationFailed: true, errorCode: compiled.error.slice(0, 160) });
    console.error('[s04-understanding-compile-failed]', {
      error: compiled.error,
      unitCount: artifact.units.length,
      depth,
      sourceId: artifact.sourceId,
    });
    return {
      ok: false,
      code: 'UNDERSTAND_COMPILE_FAILED',
      message: 'No se pudo preparar el Núcleo.',
      essentialOnly: { blueprint, partialArtifact: essentialPartialArtifact },
    };
  }

  // IDs-only manifest from real ingest — never fabricated chunk text.
  if (args.ingest?.chunks?.length) {
    compiled.map.chunkIdManifest = args.ingest.chunks.map((c) => c.id);
  }

  if (args.ownerId && args.contentHash) {
    setUnderstandingCache({
      ...cacheArgs(args, depth),
      artifact,
    });
  }

  emit('compile', { unitCount: canonical.units.length, repairUsed: repaired, cacheHit });

  return {
    ok: true,
    artifact,
    repaired,
    cacheHit,
    timingsMs: {
      blueprint: blueprintMs,
      units: unitsMs,
      total: Date.now() - t0,
      essentialReadyAt,
    },
    map: compiled.map,
  };
}
