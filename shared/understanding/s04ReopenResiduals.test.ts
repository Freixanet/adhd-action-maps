/**
 * S04 reopen residuals — canonicalize, compile invariants, cache, gate, rehydrate.
 */

import { describe, expect, it } from 'vitest';
import type { TransformRequest } from '../contracts';
import type { IngestResult } from '../types/chunk';
import { runUnderstandEngine } from '../../server/src/understanding/runUnderstandEngine';
import {
  assertCompileRelationInvariants,
  buildUnitIdentitySeed,
  canonicalizeUnits,
  canRunUnderstandingEngine,
  clearUnderstandingCache,
  compileUnderstandingToMap,
  plannedRelationsRepresented,
  rehydrateUnderstanding,
  setUnderstandingCache,
  stableUnderstandingId,
  unitSlotKey,
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
  validateArtifact,
  validateClosure,
  validateUnits,
  type UnderstandingArtifact,
  type UnderstandingUnit,
} from './index';
import {
  GOLDEN_FIXTURES,
  goldenBlueprint,
  goldenUnitsPayload,
  type GoldenFixtureId,
} from './fixtures/goldenSources';
import { createFakeUnderstandGenerateJson } from './fixtures/fakeProvider';

const FORBIDDEN_LAYER0_TRIO = [
  'Relee la idea nuclear',
  'Anota un ejemplo propio',
  'Marca qué queda sin afirmar',
] as const;

function seedArgsFor(contentHash: string) {
  return {
    contentHash,
    depth: 'estandar' as const,
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
  };
}

function unitStub(
  partial: Partial<UnderstandingUnit> & Pick<UnderstandingUnit, 'id' | 'title'>
): UnderstandingUnit {
  return {
    role: 'concept',
    explanation: 'Explicación mínima para prueba.',
    relations: [],
    examples: [],
    cautions: [],
    segmentRefs: [],
    incomplete: false,
    ...partial,
  };
}

function buildCompleteArtifact(
  fixtureId: GoldenFixtureId = 'explanatory_caution',
  contentHash = 'hash-compile'
): UnderstandingArtifact {
  const fixture = GOLDEN_FIXTURES.find((f) => f.id === fixtureId)!;
  const bp = goldenBlueprint(fixtureId);
  const payload = goldenUnitsPayload(fixtureId, fixture.chunkIds);
  const unitsResult = validateUnits(payload.units, {
    depth: 'estandar',
    allowedChunkIds: new Set(fixture.chunkIds),
    blueprint: bp,
  });
  if (unitsResult.ok === false) throw new Error(unitsResult.errors.join('; '));
  const canon = canonicalizeUnits(
    unitsResult.value,
    seedArgsFor(contentHash),
    bp.plan.unitOrder
  );
  if (canon.ok === false) throw new Error(canon.errors.join('; '));
  const closureResult = validateClosure(payload.closure);
  if (closureResult.ok === false) throw new Error(closureResult.errors.join('; '));

  return {
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    modelVersion: 'fake-s04-model',
    intent: 'understand',
    depth: 'estandar',
    status: 'complete',
    blueprint: bp,
    units: canon.units,
    closure: closureResult.value,
  };
}

function ingestFromChunks(chunkIds: string[], chunkText?: string): IngestResult {
  const text =
    chunkText ??
    'Texto de segmento suficientemente largo para superar el mínimo de veinticuatro caracteres.';
  return {
    sourceId: 'src-test',
    chunks: chunkIds.map((id, order) => ({
      id,
      text,
      hash: `h-${id}`,
      loc: { start: 0, end: text.length },
      order,
    })),
  } as unknown as IngestResult;
}

describe('S04 reopen — canonicalizeUnits', () => {
  it('remaps u1→stable ids and relation toUnitId; same seed → same ids', () => {
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const bp = goldenBlueprint('explanatory_caution');
    const payload = goldenUnitsPayload('explanatory_caution', fixture.chunkIds);
    const validated = validateUnits(payload.units, {
      depth: 'estandar',
      allowedChunkIds: new Set(fixture.chunkIds),
      blueprint: bp,
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const seedArgs = seedArgsFor('canonical-seed-a');
    const first = canonicalizeUnits(validated.value, seedArgs, bp.plan.unitOrder);
    const second = canonicalizeUnits(validated.value, seedArgs, bp.plan.unitOrder);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const seed = buildUnitIdentitySeed(seedArgs);
    const slot0 = unitSlotKey({
      index: 0,
      planUnitOrder: bp.plan.unitOrder,
      localId: validated.value[0]!.id,
    });
    expect(first.units[0]!.id).not.toBe('u1');
    expect(first.units[0]!.id).toMatch(/^u_[a-f0-9]{12}$/);
    expect(first.units[0]!.id).toBe(stableUnderstandingId(seed, slot0, 0));
    expect(second.units.map((u) => u.id)).toEqual(first.units.map((u) => u.id));

    const rel = first.units[0]!.relations[0];
    expect(rel).toBeTruthy();
    expect(rel!.toUnitId).toBe(first.units[1]!.id);
    expect(rel!.toUnitId).not.toBe('u2');
  });

  it('model ids starting with u_ are never preserved — always remapped', () => {
    const modelIds = ['u_deadbeef0001', 'u_cafebabe0002', 'u_feedface0003'];
    const units = modelIds.map((id, i) =>
      unitStub({
        id,
        title: `Unidad específica ${i + 1}`,
        relations: i === 0 ? [{ toUnitId: modelIds[1]!, kind: 'causes' }] : [],
      })
    );
    const seedArgs = seedArgsFor('remap-seed');
    const result = canonicalizeUnits(units, seedArgs);
    expect(result.ok).toBe(true);
    if (result.ok === false) return;

    const seed = buildUnitIdentitySeed(seedArgs);
    for (let i = 0; i < modelIds.length; i += 1) {
      const slot = unitSlotKey({ index: i, localId: modelIds[i]! });
      expect(result.units[i]!.id).not.toBe(modelIds[i]);
      expect(result.units[i]!.id).toBe(stableUnderstandingId(seed, slot, i));
    }
    expect(result.units[0]!.relations[0]!.toUnitId).toBe(result.units[1]!.id);
  });

  it('relation to missing target after canonicalize fails', () => {
    const units = [
      unitStub({
        id: 'a',
        title: 'Origen relacional',
        relations: [{ toUnitId: 'ghost', kind: 'causes' }],
      }),
      unitStub({ id: 'b', title: 'Destino presente' }),
      unitStub({ id: 'c', title: 'Tercera unidad de apoyo' }),
    ];
    const result = canonicalizeUnits(units, seedArgsFor('seed'));
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.errors.some((e) => /missing after canonicalize|orphan/i.test(e))).toBe(
      true
    );
  });
});

describe('S04 reopen — compile relation invariants', () => {
  it('plannedRelationsRepresented fails when planned relation missing from units', () => {
    const artifact = buildCompleteArtifact();
    const stripped: UnderstandingArtifact = {
      ...artifact,
      units: artifact.units.map((u) => ({ ...u, relations: [] })),
    };
    const planned = plannedRelationsRepresented(stripped);
    expect(planned.ok).toBe(false);
    if (planned.ok === true) return;
    expect(planned.missing.length).toBeGreaterThan(0);
  });

  it('assertCompileRelationInvariants fails when planned relation missing', () => {
    const artifact = buildCompleteArtifact();
    const stripped: UnderstandingArtifact = {
      ...artifact,
      units: artifact.units.map((u) => ({ ...u, relations: [] })),
    };
    // Direct invariant check still fails before soften.
    const good = compileUnderstandingToMap(artifact);
    expect(good.ok).toBe(true);
    if (good.ok === false) return;
    const inv = assertCompileRelationInvariants(stripped, good.map);
    expect(inv.ok).toBe(false);

    // Full compile softens unrepresented planned relations and succeeds.
    const compiled = compileUnderstandingToMap(stripped);
    expect(compiled.ok).toBe(true);
    if (compiled.ok === false) return;
    expect(compiled.map.understanding?.blueprint.plan.relationsToPreserve ?? []).toEqual([]);
  });

  it('includeRelations:false fails invariants when IR has relations', () => {
    const artifact = buildCompleteArtifact();
    const compiled = compileUnderstandingToMap(artifact, { includeRelations: false });
    expect(compiled.ok).toBe(false);
    if (compiled.ok === true) return;
    expect(compiled.error).toMatch(/dropped visible relations|planned relation missing/i);
  });
});

describe('S04 reopen — cache (early hit = zero model calls)', () => {
  it('second runUnderstandEngine with same owner/hash → zero generateJson calls', async () => {
    clearUnderstandingCache();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const gen1 = createFakeUnderstandGenerateJson();
    const first = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      ownerId: 'owner-a',
      contentHash: 'shared-hash',
      generateJson: gen1,
    });
    expect(first.ok).toBe(true);
    expect(gen1.calls.length).toBeGreaterThan(0);

    const gen2 = createFakeUnderstandGenerateJson();
    const second = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      ownerId: 'owner-a',
      contentHash: 'shared-hash',
      generateJson: gen2,
    });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.cacheHit).toBe(true);
    // Early cache lookup runs before blueprint/units — no model stages on hit.
    expect(gen2.calls.length).toBe(0);
  });

  it('corrupt cache entry is ejected → miss and regenerate', async () => {
    clearUnderstandingCache();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const gen1 = createFakeUnderstandGenerateJson();
    await runUnderstandEngine({
      body: {
        type: 'text',
        text: fixture.source,
        intent: 'understand',
        depth: 'estandar',
        sourceId: 'src-a',
        sourceVersionId: 'ver-a',
      },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      ownerId: 'owner-corrupt',
      contentHash: 'corrupt-hash',
      generateJson: gen1,
    });

    const corrupt = buildCompleteArtifact();
    corrupt.schemaVersion = 's04.understanding.fake';
    setUnderstandingCache({
      ownerId: 'owner-corrupt',
      contentHash: 'corrupt-hash',
      sourceId: 'src-a',
      sourceVersionId: 'ver-a',
      depth: 'estandar',
      artifact: corrupt,
    });

    const gen2 = createFakeUnderstandGenerateJson();
    const second = await runUnderstandEngine({
      body: {
        type: 'text',
        text: fixture.source,
        intent: 'understand',
        depth: 'estandar',
        sourceId: 'src-a',
        sourceVersionId: 'ver-a',
      },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      ownerId: 'owner-corrupt',
      contentHash: 'corrupt-hash',
      generateJson: gen2,
    });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.cacheHit).toBe(false);
    expect(gen2.calls.length).toBeGreaterThan(0);
  });

  it('cancel after essential on cache hit path returns UNDERSTAND_CANCELLED', async () => {
    clearUnderstandingCache();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const gen1 = createFakeUnderstandGenerateJson();
    await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      ownerId: 'owner-cancel-cache',
      contentHash: 'cancel-cache-hash',
      generateJson: gen1,
    });

    let cancel = false;
    const gen2 = createFakeUnderstandGenerateJson();
    const result = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      ownerId: 'owner-cancel-cache',
      contentHash: 'cancel-cache-hash',
      generateJson: gen2,
      isCancelled: () => cancel,
      onEssentialReady: () => {
        cancel = true;
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.code).toBe('UNDERSTAND_CANCELLED');
    expect(result.essentialOnly).toBeTruthy();
    expect(gen2.calls.length).toBe(0);
  });
});

describe('S04 reopen — canRunUnderstandingEngine gate', () => {
  const baseBody: TransformRequest = {
    type: 'text',
    text: 'Texto suficientemente largo para el motor de comprensión.',
    intent: 'understand',
  };

  it('youtube → false (legacy path)', () => {
    const d = canRunUnderstandingEngine({
      intent: 'understand',
      body: { ...baseBody, type: 'youtube', text: 'https://www.youtube.com/watch?v=abc' },
      ingestKind: 'passthrough',
      ingest: null,
    });
    expect(d.run).toBe(false);
    if (!d.run) expect(d.reason).toBe('youtube_without_transcript');
  });

  it('passthrough multimodal → false', () => {
    const d = canRunUnderstandingEngine({
      intent: 'understand',
      body: { ...baseBody, type: 'image', text: 'data:image/png;base64,abc' },
      ingestKind: 'passthrough',
      ingest: null,
    });
    expect(d.run).toBe(false);
    if (!d.run) expect(d.reason).toBe('multimodal_passthrough');
  });

  it('source with chunks → true', () => {
    const d = canRunUnderstandingEngine({
      intent: 'understand',
      body: baseBody,
      ingestKind: 'source',
      ingest: ingestFromChunks(['c1', 'c2']),
    });
    expect(d.run).toBe(true);
    if (d.run) expect(d.reason).toMatch(/pasted_text|web_or_document_text/);
  });

  it('pasted text (text source, no URL) → true', () => {
    const d = canRunUnderstandingEngine({
      intent: 'understand',
      body: {
        type: 'text',
        text: 'La memoria de trabajo sostiene pocas piezas activas a la vez.',
        textMode: 'source',
      },
      ingestKind: 'source',
      ingest: ingestFromChunks(['c_paste']),
    });
    expect(d.run).toBe(true);
    if (d.run) expect(d.reason).toBe('pasted_text');
  });
});

describe('S04 reopen — Layer0 actions specificity', () => {
  it('GOLDEN_FIXTURES layer0Actions avoid the forbidden generic trio', () => {
    for (const fixture of GOLDEN_FIXTURES) {
      if (fixture.expectInsufficient) continue;
      const bp = goldenBlueprint(fixture.id);
      for (const action of bp.essential.layer0Actions) {
        const lower = action.toLowerCase();
        for (const forbidden of FORBIDDEN_LAYER0_TRIO) {
          expect(lower, `${fixture.id}: ${action}`).not.toContain(forbidden.toLowerCase());
        }
      }
    }
  });
});

describe('S04 reopen — compile sourceKind', () => {
  it('preserves pdf/link/youtube when passed in compile options', () => {
    const artifact = buildCompleteArtifact();
    for (const kind of ['pdf', 'link', 'youtube'] as const) {
      const compiled = compileUnderstandingToMap(artifact, { sourceKind: kind });
      expect(compiled.ok).toBe(true);
      if (compiled.ok === false) continue;
      expect(compiled.map.sourceMetadata?.kind).toBe(kind);
    }
  });
});

describe('S04 reopen — rehydrateUnderstanding strict gate', () => {
  const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;

  it('rejects fake schemaVersion', () => {
    const artifact = buildCompleteArtifact();
    const raw = { ...artifact, schemaVersion: 's04.understanding.fake' };
    expect(rehydrateUnderstanding(raw, { allowedChunkIds: new Set(fixture.chunkIds) })).toBeNull();
  });

  it('rejects verified segmentRefs', () => {
    const artifact = buildCompleteArtifact();
    const raw = {
      ...artifact,
      units: artifact.units.map((u, i) =>
        i === 0
          ? {
              ...u,
              segmentRefs: [{ chunkId: fixture.chunkIds[0]!, status: 'verified' as const }],
            }
          : u
      ),
    };
    expect(rehydrateUnderstanding(raw, { allowedChunkIds: new Set(fixture.chunkIds) })).toBeNull();
  });

  it('rejects duplicate unit ids via validate', () => {
    const artifact = buildCompleteArtifact();
    const dupId = artifact.units[0]!.id;
    const raw = {
      ...artifact,
      units: [
        artifact.units[0]!,
        { ...artifact.units[1]!, id: dupId },
        artifact.units[2]!,
      ],
    };
    expect(validateArtifact(raw, { allowedChunkIds: new Set(fixture.chunkIds) }).ok).toBe(false);
    expect(rehydrateUnderstanding(raw, { allowedChunkIds: new Set(fixture.chunkIds) })).toBeNull();
  });

  it('rejects hostile __proto__ key', () => {
    const artifact = buildCompleteArtifact();
    const raw = JSON.parse(JSON.stringify(artifact)) as Record<string, unknown>;
    Object.defineProperty(raw, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    expect(Object.prototype.hasOwnProperty.call(raw, '__proto__')).toBe(true);
    expect(rehydrateUnderstanding(raw, { allowedChunkIds: new Set(fixture.chunkIds) })).toBeNull();
  });

  it('rejects incomplete / non-complete status', () => {
    const artifact = buildCompleteArtifact();
    expect(
      rehydrateUnderstanding(
        { ...artifact, status: 'essential_only' as const, units: [], closure: null },
        { allowedChunkIds: new Set(fixture.chunkIds) }
      )
    ).toBeNull();
    expect(
      rehydrateUnderstanding(
        { ...artifact, status: 'cancelled' as const },
        { allowedChunkIds: new Set(fixture.chunkIds) }
      )
    ).toBeNull();
  });
});
