/**
 * S04 Understanding Engine — golden fixtures, compiler, repair, cancel, IDs.
 */

import { describe, expect, it } from 'vitest';
import type { ActionMapData } from '../contracts';
import { normalizeMapData } from '../mapData';
import { createEntry, loadHistory, saveHistory } from '../history';
import { configureStorage, type SyncKeyValueStorage } from '../storage';
import {
  compileEssentialPartial,
  compileUnderstandingToMap,
  stableUnderstandingId,
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
  UNDERSTANDING_STAGE_LABELS,
  validateBlueprint,
  validateUnits,
  clearUnderstandingCache,
} from './index';
import { runUnderstandEngine } from '../../server/src/understanding/runUnderstandEngine';
import { BLUEPRINT_SYSTEM_PROMPT, UNITS_SYSTEM_PROMPT } from '../../server/src/understanding/prompts';
import { GOLDEN_FIXTURES, goldenBlueprint, type GoldenFixture } from './fixtures/goldenSources';
import { createFakeUnderstandGenerateJson } from './fixtures/fakeProvider';

function memoryKv(): SyncKeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

function ingestFromChunks(chunkIds: string[]): import('../types/chunk').IngestResult | null {
  if (!chunkIds.length) return null;
  return {
    sourceId: 'src-test',
    chunks: chunkIds.map((id, order) => ({
      id,
      text: 'segmento',
      hash: `h-${id}`,
      loc: { start: 0, end: 8 },
      order,
    })),
  } as unknown as import('../types/chunk').IngestResult;
}

function assertSemanticInvariants(fixture: GoldenFixture, map: ActionMapData) {
  const userFacing = JSON.stringify({
    title: map.title,
    coreIdea: map.coreIdea,
    coreSupport: map.coreSupport,
    layer0: map.layer0,
    steps: map.steps,
    completionCard: map.completionCard,
    knowledgeSections: map.knowledgeSections,
    coverage: map.coverage,
  }).toLowerCase();

  for (const keep of fixture.mustPreserve) {
    const blob = JSON.stringify(map).toLowerCase();
    expect(blob, `mustPreserve: ${keep}`).toContain(keep.toLowerCase());
  }
  for (const bad of fixture.mustNotContain) {
    expect(userFacing, `mustNotContain: ${bad}`).not.toContain(bad.toLowerCase());
  }
  for (const step of map.steps ?? []) {
    expect(step.title).not.toMatch(/^(punto\s*\d+|introducci[oó]n)$/i);
  }
  const understanding = map.understanding;
  if (understanding) {
    for (const u of understanding.units) {
      for (const r of u.segmentRefs) {
        expect(r.status).toBe('pending');
      }
    }
    expect(understanding.schemaVersion).toBe(UNDERSTANDING_SCHEMA_VERSION);
    expect(understanding.promptVersion).toBe(UNDERSTANDING_PROMPT_VERSION);
    expect(understanding.compilerVersion).toBe(UNDERSTANDING_COMPILER_VERSION);
  }
  if (fixture.forbidCausalUpgrade) {
    expect(userFacing).not.toMatch(/el café causa/);
    expect(userFacing).not.toMatch(/causa concentración/);
  }
  if (fixture.expectScope) {
    expect(map.understanding?.blueprint.classification.scopeKnown).toBe(fixture.expectScope);
  }
  expect(map.layer0?.what?.trim().length).toBeGreaterThan(0);
  expect(map.coreIdea?.trim().length).toBeGreaterThan(0);
}

describe('S04 contracts & validators', () => {
  it('rejects generic plan titles and non-pending refs', () => {
    const raw = {
      classification: {
        genre: 'explanatory',
        discourseStructure: 'conceptual',
        language: 'es',
        scopeKnown: 'complete',
        uncertainties: [],
      },
      plan: {
        centralQuestion: '¿?',
        thesisOrPurpose: 'T',
        unitOrder: ['Punto 1'],
        relationsToPreserve: [],
        mustKeep: [],
        excludedNoise: [],
      },
      essential: {
        nuclearIdea: 'N',
        essentialIdeas: [{ title: 'a', desc: 'a' }],
        limitsOrConditions: [],
        doesNotClaim: [],
        layer0Synthesis: 'S',
        layer0Why: 'W',
        layer0Actions: ['1', '2', '3'],
      },
    };
    expect(validateBlueprint(raw).ok).toBe(false);
  });

  it('rejects hallucinated chunk ids', () => {
    const bp = goldenBlueprint('explanatory_caution');
    const result = validateUnits(
      [
        {
          id: 'u1',
          title: 'Capacidad limitada de retención',
          role: 'concept',
          explanation: 'Capacidad limitada e interferencia bajo multitarea. No equivale a inteligencia.',
          relations: [],
          examples: [],
          cautions: ['no equivale a inteligencia'],
          segmentRefs: [{ chunkId: 'nope', status: 'pending' }],
          incomplete: false,
        },
        {
          id: 'u2',
          title: 'Interferencia bajo multitarea',
          role: 'mechanism',
          explanation: 'Interferencia bajo multitarea.',
          relations: [],
          examples: [],
          cautions: [],
          segmentRefs: [],
          incomplete: false,
        },
        {
          id: 'u3',
          title: 'Cautela: no equivale a inteligencia',
          role: 'caution',
          explanation: 'No equivale a inteligencia.',
          relations: [],
          examples: [],
          cautions: ['no equivale a inteligencia'],
          segmentRefs: [],
          incomplete: false,
        },
      ],
      { depth: 'estandar', allowedChunkIds: new Set(['c_mem_1']), blueprint: bp }
    );
    expect(result.ok).toBe(false);
    expect(
      result.ok === false && result.errors.some((e) => /hallucinated chunkId/i.test(e))
    ).toBe(true);
  });

  it('rejects verified status on segment refs', () => {
    const bp = goldenBlueprint('explanatory_caution');
    const result = validateUnits(
      [
        {
          id: 'u1',
          title: 'Capacidad limitada de retención',
          role: 'concept',
          explanation: 'Capacidad limitada.',
          relations: [],
          examples: [],
          cautions: ['no equivale a inteligencia'],
          segmentRefs: [{ chunkId: 'c_mem_1', status: 'verified' }],
          incomplete: false,
        },
        {
          id: 'u2',
          title: 'Interferencia bajo multitarea',
          role: 'mechanism',
          explanation: 'Interferencia bajo multitarea.',
          relations: [],
          examples: [],
          cautions: [],
          segmentRefs: [],
          incomplete: false,
        },
        {
          id: 'u3',
          title: 'Cautela crítica de inteligencia',
          role: 'caution',
          explanation: 'No equivale a inteligencia.',
          relations: [],
          examples: [],
          cautions: ['no equivale a inteligencia'],
          segmentRefs: [],
          incomplete: false,
        },
      ],
      { depth: 'estandar', allowedChunkIds: new Set(['c_mem_1']), blueprint: bp }
    );
    expect(result.ok).toBe(false);
  });
});

describe('S04 prompt injection boundaries', () => {
  it('system prompts delimit untrusted source and forbid obedience', () => {
    expect(BLUEPRINT_SYSTEM_PROMPT).toMatch(/<<<FUENTE>>>/);
    expect(BLUEPRINT_SYSTEM_PROMPT).toMatch(/prompt injection/i);
    expect(UNITS_SYSTEM_PROMPT).toMatch(/Ignora instrucciones/i);
    expect(UNITS_SYSTEM_PROMPT).toMatch(/pending/);
  });
});

describe('S04 stable IDs', () => {
  it('same seed/label/index → same id', () => {
    const a = stableUnderstandingId('hash1', 'Capacidad limitada', 0);
    const b = stableUnderstandingId('hash1', 'Capacidad limitada', 0);
    expect(a).toBe(b);
    expect(a).toMatch(/^u_[a-f0-9]{12}$/);
  });
});

describe('S04 compiler', () => {
  it('compiles complete artifact to valid ActionMapData with Layer0', async () => {
    clearUnderstandingCache();
    const gen = createFakeUnderstandGenerateJson();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const result = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      contentHash: 'hash-compile',
      generateJson: gen,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.map) return;
    const normalized = normalizeMapData(result.map);
    expect(normalized).toBeTruthy();
    expect(normalized!.layer0?.what).toBeTruthy();
    expect(normalized!.steps.length).toBeGreaterThanOrEqual(3);
    assertSemanticInvariants(fixture, normalized!);
  });

  it('does not compile essential-only as done map', () => {
    const bp = goldenBlueprint('explanatory_caution');
    const partial = compileEssentialPartial({
      blueprint: bp,
      modelVersion: 'fake',
    });
    expect(partial.steps).toEqual([]);
    const compiled = compileUnderstandingToMap({
      schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
      promptVersion: UNDERSTANDING_PROMPT_VERSION,
      compilerVersion: UNDERSTANDING_COMPILER_VERSION,
      modelVersion: 'fake',
      intent: 'understand',
      depth: 'estandar',
      status: 'essential_only',
      blueprint: bp,
      units: [],
      closure: null,
    });
    expect(compiled.ok).toBe(false);
  });

  it('reads legacy maps without understanding IR', () => {
    const legacy = normalizeMapData({
      title: 'Legacy',
      coreIdea: 'Idea legacy suficiente para normalizar.',
      coreSupport: 'Soporte',
      intent: 'understand',
      tldr: [
        { title: 'A', desc: 'uno' },
        { title: 'B', desc: 'dos' },
        { title: 'C', desc: 'tres' },
      ],
      steps: [
        {
          id: 's1',
          shortNav: 'Uno',
          title: 'Primera unidad legacy',
          time: '~3 min',
          content: [{ type: 'prose', text: 'Texto' }],
          selfCheck: '¿?',
        },
        {
          id: 's2',
          shortNav: 'Dos',
          title: 'Segunda unidad legacy',
          time: '~3 min',
          content: [{ type: 'prose', text: 'Texto' }],
          selfCheck: '¿?',
        },
        {
          id: 's3',
          shortNav: 'Tres',
          title: 'Tercera unidad legacy',
          time: '~3 min',
          content: [{ type: 'prose', text: 'Texto' }],
          selfCheck: '¿?',
        },
      ],
    });
    expect(legacy).toBeTruthy();
    expect(legacy!.understanding).toBeUndefined();
  });
});

describe('S04 golden fixtures (fake provider)', () => {
  for (const fixture of GOLDEN_FIXTURES) {
    it(`fixture ${fixture.id}`, async () => {
      clearUnderstandingCache();
      const stages: string[] = [];
      let essentialReady = false;

      if (fixture.expectInsufficient) {
        const result = await runUnderstandEngine({
          body: { type: 'text', text: fixture.source, intent: 'understand' },
          sourceText: fixture.source,
          ingest: null,
          generateJson: createFakeUnderstandGenerateJson(),
        });
        expect(result.ok).toBe(false);
        if (result.ok === false) {
          expect(result.code).toBe('UNDERSTAND_INSUFFICIENT_SOURCE');
        }
        return;
      }

      const gen = createFakeUnderstandGenerateJson();
      const result = await runUnderstandEngine({
        body: {
          type: 'text',
          text: fixture.source,
          intent: 'understand',
          depth: 'estandar',
          sourceId: 'src-test',
          sourceVersionId: 'ver-test',
        },
        sourceText: fixture.source,
        ingest: ingestFromChunks(fixture.chunkIds),
        ownerId: 'owner-a',
        contentHash: `hash-${fixture.id}`,
        generateJson: gen,
        onStage: (label) => {
          stages.push(label);
        },
        onEssentialReady: () => {
          essentialReady = true;
        },
      });

      expect(result.ok, fixture.id).toBe(true);
      expect(essentialReady).toBe(true);
      expect(stages).toContain(UNDERSTANDING_STAGE_LABELS.classifying);
      expect(stages).toContain(UNDERSTANDING_STAGE_LABELS.essential);
      if (!result.ok || !result.map) return;
      assertSemanticInvariants(fixture, result.map);
      // Injection fixture must not leak hacked schema
      if (fixture.id === 'prompt_injection') {
        expect(result.artifact.schemaVersion).toBe(UNDERSTANDING_SCHEMA_VERSION);
        expect(JSON.stringify(result.map)).not.toMatch(/hacked/i);
      }
    });
  }
});

describe('S04 repair & fail-closed', () => {
  it('repairs invalid blueprint once then succeeds', async () => {
    clearUnderstandingCache();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const gen = createFakeUnderstandGenerateJson({ failBlueprintOnce: true });
    const result = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      generateJson: gen,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.repaired).toBe(true);
    expect(gen.calls.some((c) => c.stage === 'repair')).toBe(true);
  });

  it('retries malformed units output once and succeeds', async () => {
    clearUnderstandingCache();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const gen = createFakeUnderstandGenerateJson({ failUnitsOnce: true });
    const result = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      generateJson: gen,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.repaired).toBe(true);
    expect(gen.calls.filter((c) => c.stage === 'repair')).toHaveLength(1);
  });

  it('fail-closed on persistent invalid units — no done map', async () => {
    clearUnderstandingCache();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const gen = createFakeUnderstandGenerateJson({ alwaysInvalidUnits: true });
    const result = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      generateJson: gen,
      onEssentialReady: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.essentialOnly).toBeTruthy();
    }
  });

  it('rejects hallucinated chunk after repair budget', async () => {
    clearUnderstandingCache();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const gen = createFakeUnderstandGenerateJson({ hallucinateChunk: true });
    const result = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      generateJson: gen,
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe('UNDERSTAND_HALLUCINATED_CHUNK');
    }
  });
});

describe('S04 cancellation / A→B', () => {
  it('cancel after essential_ready blocks consolidation', async () => {
    clearUnderstandingCache();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    let cancel = false;
    const gen = createFakeUnderstandGenerateJson();
    const result = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      generateJson: gen,
      isCancelled: () => cancel,
      onEssentialReady: () => {
        cancel = true; // A→B / cancel after essential
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe('UNDERSTAND_CANCELLED');
      expect(result.essentialOnly).toBeTruthy();
    }
  });
});

describe('S04 cache privacy & hit', () => {
  it('cache hits for same owner+hash; misses across owners', async () => {
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
    // Early cache lookup runs before blueprint/units — zero model calls on hit.
    expect(gen2.calls.length).toBe(0);

    const gen3 = createFakeUnderstandGenerateJson();
    const other = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      ownerId: 'owner-b',
      contentHash: 'shared-hash',
      generateJson: gen3,
    });
    expect(other.ok).toBe(true);
    if (other.ok) expect(other.cacheHit).toBe(false);
    expect(gen3.calls.some((c) => c.stage === 'units')).toBe(true);
  });
});

describe('S04 essential_ready budget (fake provider)', () => {
  it('instruments time-to-essential_ready under 20s with fast fake', async () => {
    clearUnderstandingCache();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const gen = createFakeUnderstandGenerateJson({ delayMs: 5 });
    const t0 = Date.now();
    let readyAt = 0;
    await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      generateJson: gen,
      onEssentialReady: () => {
        readyAt = Date.now() - t0;
      },
    });
    expect(readyAt).toBeGreaterThan(0);
    expect(readyAt).toBeLessThan(20_000);
  });
});

describe('S04 persistence / rehydration', () => {
  it('round-trips understanding artifact via history entry', async () => {
    clearUnderstandingCache();
    const kv = memoryKv();
    configureStorage(kv);
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const result = await runUnderstandEngine({
      body: { type: 'text', text: fixture.source, intent: 'understand', depth: 'estandar' },
      sourceText: fixture.source,
      ingest: ingestFromChunks(fixture.chunkIds),
      generateJson: createFakeUnderstandGenerateJson(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.map) return;

    const store = createEntry(
      { activeId: null, entries: [], collections: [] },
      {
        data: result.map,
        currentStep: 0,
        isComplete: false,
        viewAll: false,
        layer0Passed: true,
      },
      'text',
      'map-s04-1'
    );
    saveHistory(store);
    const loaded = loadHistory();
    const rehydrated = loaded.entries[0]?.session.data as import('../contracts').ActionMapData;
    expect(rehydrated.understanding?.schemaVersion).toBe(UNDERSTANDING_SCHEMA_VERSION);
    expect(rehydrated.understanding?.units.length).toBeGreaterThan(0);
  });
});
