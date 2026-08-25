/**
 * S04 final reopen residuals — provenance, chunk auth, versioned IDs, relations.
 */

import { describe, expect, it } from 'vitest';
import { normalizeMapData } from '../mapData';
import {
  applyCausalGuards,
  assertCompileRelationInvariants,
  buildSourceProvenance,
  buildUnitIdentitySeed,
  canonicalizeUnits,
  compileUnderstandingToMap,
  familiesCompatible,
  matchPlannedRelation,
  plannedRelationsRepresented,
  rehydrateUnderstanding,
  relationFamily,
  sourceKindFromIngestMetadata,
  stableUnderstandingId,
  unitSlotKey,
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
  validateUnits,
  validateClosure,
  type UnderstandingArtifact,
  type UnderstandingUnit,
} from './index';
import {
  GOLDEN_FIXTURES,
  goldenBlueprint,
  goldenUnitsPayload,
} from './fixtures/goldenSources';

function seedArgs(contentHash: string, overrides: Partial<{
  sourceVersionId: string;
  schemaVersion: string;
  promptVersion: string;
  compilerVersion: string;
  depth: string;
}> = {}) {
  return {
    contentHash,
    depth: 'estandar',
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    ...overrides,
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

function buildArtifact(): UnderstandingArtifact {
  const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
  const bp = goldenBlueprint('explanatory_caution');
  const payload = goldenUnitsPayload('explanatory_caution', fixture.chunkIds);
  const unitsResult = validateUnits(payload.units, {
    depth: 'estandar',
    allowedChunkIds: new Set(fixture.chunkIds),
    blueprint: bp,
  });
  if (unitsResult.ok === false) {
    throw new Error(unitsResult.errors.join('; '));
  }
  const canon = canonicalizeUnits(
    unitsResult.value,
    seedArgs('hash-final'),
    bp.plan.unitOrder
  );
  if (canon.ok === false) {
    throw new Error(canon.errors.join('; '));
  }
  const closure = validateClosure(payload.closure);
  if (closure.ok === false) {
    throw new Error(closure.errors.join('; '));
  }
  return {
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    modelVersion: 'fake',
    intent: 'understand',
    depth: 'estandar',
    status: 'complete',
    blueprint: bp,
    units: canon.units,
    closure: closure.value,
  };
}

describe('S04 final — provenance', () => {
  it('ingest metadata type url → sourceKind link', () => {
    expect(sourceKindFromIngestMetadata('url')).toBe('link');
    expect(sourceKindFromIngestMetadata('pdf')).toBe('pdf');
    expect(sourceKindFromIngestMetadata('text')).toBe('text');
  });

  it('buildSourceProvenance keeps original URL after body rewrite to text', () => {
    const originalUrl = 'https://example.com/article';
    const labelled =
      'Los marcadores [[chunk_a]] en la fuente…\n[[chunk_a]]\nCuerpo extraído largo suficiente.';
    const p = buildSourceProvenance({
      body: {
        type: 'text',
        text: labelled,
        sourceLabel: 'Article',
        intent: 'understand',
      },
      originalBody: {
        type: 'link',
        text: originalUrl,
        sourceLabel: 'Article',
      },
      ingest: {
        chunks: [
          {
            id: 'chunk_a',
            text: 'Cuerpo',
            hash: 'h',
            loc: { start: 0, end: 6 },
          },
        ],
        metadata: { type: 'url', title: 'Article' },
        rawHash: 'raw-web',
      },
      contentHash: 'raw-web',
    });
    expect(p.originalKind).toBe('link');
    expect(p.canonicalUrl).toBe(originalUrl);
    expect(p.extractionKind).toBe('web_fetch');
    expect(p.canonicalUrl).not.toContain('chunk');
  });

  it('PDF / paste / youtube provenance kinds', () => {
    const pdf = buildSourceProvenance({
      body: { type: 'text', text: 'x'.repeat(40), intent: 'understand' },
      originalBody: { type: 'pdf', text: undefined, mimeType: 'application/pdf' },
      ingest: {
        chunks: [],
        metadata: { type: 'pdf', title: 'Doc' },
        rawHash: 'pdf-h',
      },
    });
    expect(pdf.originalKind).toBe('pdf');
    expect(pdf.extractionKind).toBe('pdf_text');

    const paste = buildSourceProvenance({
      body: { type: 'text', text: 'x'.repeat(40), intent: 'understand' },
      originalBody: { type: 'text', text: 'x'.repeat(40) },
      ingest: {
        chunks: [],
        metadata: { type: 'text' },
        rawHash: 'paste-h',
      },
    });
    expect(paste.originalKind).toBe('text');
    expect(paste.extractionKind).toBe('pasted_text');

    const yt = buildSourceProvenance({
      body: {
        type: 'youtube',
        text: 'https://www.youtube.com/watch?v=abc',
        intent: 'understand',
      },
      originalBody: {
        type: 'youtube',
        text: 'https://www.youtube.com/watch?v=abc',
      },
      ingest: null,
      ingestKind: 'passthrough',
    });
    expect(yt.originalKind).toBe('youtube');
    expect(yt.canonicalUrl).toBe('https://www.youtube.com/watch?v=abc');
  });

  it('compileUnderstandingToMap uses provenance for sourceMetadata', () => {
    const artifact = buildArtifact();
    const compiled = compileUnderstandingToMap(artifact, {
      provenance: {
        originalKind: 'link',
        canonicalUrl: 'https://example.com/x',
        label: 'Web',
        extractionKind: 'web_fetch',
        contentHash: 'h',
      },
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.map.sourceMetadata?.kind).toBe('link');
    expect(compiled.map.sourceMetadata?.url).toBe('https://example.com/x');
    expect(compiled.map.understanding?.units.length).toBeGreaterThan(0);
  });
});

describe('S04 final — independent chunk authorization', () => {
  it('invented pending ref without external manifest → reject', () => {
    const artifact = buildArtifact();
    const raw = {
      ...artifact,
      units: artifact.units.map((u, i) =>
        i === 0
          ? {
              ...u,
              segmentRefs: [{ chunkId: 'invented_chunk_xyz', status: 'pending' as const }],
            }
          : { ...u, segmentRefs: [] }
      ),
    };
    expect(rehydrateUnderstanding(raw)).toBeNull();
    expect(rehydrateUnderstanding(raw, { allowedChunkIds: new Set() })).toBeNull();
  });

  it('invented pending ref that only appears inside IR → still reject', () => {
    const artifact = buildArtifact();
    const invented = 'self_auth_chunk';
    const raw = {
      ...artifact,
      units: artifact.units.map((u, i) =>
        i === 0
          ? { ...u, segmentRefs: [{ chunkId: invented, status: 'pending' as const }] }
          : u
      ),
    };
    // Passing a set built from the artifact itself must still fail validation
    // when the invented id is not in a truly independent manifest — here we
    // simulate the forbidden pattern by NOT providing independent IDs.
    expect(rehydrateUnderstanding(raw)).toBeNull();
  });

  it('ref present in independent manifest → accept', () => {
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const artifact = buildArtifact();
    const hydrated = rehydrateUnderstanding(artifact, {
      allowedChunkIds: new Set(fixture.chunkIds),
    });
    expect(hydrated).not.toBeNull();
    expect(hydrated?.units[0]?.segmentRefs[0]?.status).toBe('pending');
  });

  it('verified ref → reject', () => {
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const artifact = buildArtifact();
    const raw = {
      ...artifact,
      units: artifact.units.map((u, i) =>
        i === 0
          ? {
              ...u,
              segmentRefs: [
                { chunkId: fixture.chunkIds[0]!, status: 'verified' as const },
              ],
            }
          : u
      ),
    };
    expect(
      rehydrateUnderstanding(raw, { allowedChunkIds: new Set(fixture.chunkIds) })
    ).toBeNull();
  });

  it('generated validated artifact keeps IR after compile (no external rehydrate)', () => {
    const artifact = buildArtifact();
    const compiled = compileUnderstandingToMap(artifact, { sourceKind: 'text' });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.map.understanding?.status).toBe('complete');
    expect(compiled.map.understanding?.units.length).toBe(artifact.units.length);
  });

  it('legacy history without understanding still opens', () => {
    const normalized = normalizeMapData({
      title: 'Legacy',
      coreIdea: 'Idea legacy suficientemente concreta para abrir el mapa.',
      coreSupport: 'Soporte',
      intent: 'understand',
      tldr: [
        { title: 'A', desc: 'a' },
        { title: 'B', desc: 'b' },
        { title: 'C', desc: 'c' },
      ],
      steps: [
        {
          id: 's1',
          shortNav: 'Uno',
          title: 'Paso uno legacy',
          time: '~3 min',
          content: [{ type: 'prose', text: 'texto' }],
          selfCheck: '?',
        },
        {
          id: 's2',
          shortNav: 'Dos',
          title: 'Paso dos legacy',
          time: '~3 min',
          content: [{ type: 'prose', text: 'texto' }],
          selfCheck: '?',
        },
        {
          id: 's3',
          shortNav: 'Tres',
          title: 'Paso tres legacy',
          time: '~3 min',
          content: [{ type: 'prose', text: 'texto' }],
          selfCheck: '?',
        },
      ],
    });
    expect(normalized).toBeTruthy();
    expect(normalized!.understanding).toBeUndefined();
  });

  it('history with invented refs and no citedChunks omits understanding', () => {
    const artifact = buildArtifact();
    const poisoned = {
      ...artifact,
      units: artifact.units.map((u, i) =>
        i === 0
          ? {
              ...u,
              segmentRefs: [{ chunkId: 'bogus', status: 'pending' as const }],
            }
          : u
      ),
    };
    const normalized = normalizeMapData({
      title: 'Con IR',
      coreIdea: 'Idea con IR inválida en historial.',
      coreSupport: 'Soporte',
      intent: 'understand',
      tldr: [
        { title: 'A', desc: 'a' },
        { title: 'B', desc: 'b' },
        { title: 'C', desc: 'c' },
      ],
      steps: [
        {
          id: 's1',
          shortNav: 'Uno',
          title: 'Paso uno',
          time: '~3 min',
          content: [{ type: 'prose', text: 'texto' }],
          selfCheck: '?',
        },
        {
          id: 's2',
          shortNav: 'Dos',
          title: 'Paso dos',
          time: '~3 min',
          content: [{ type: 'prose', text: 'texto' }],
          selfCheck: '?',
        },
        {
          id: 's3',
          shortNav: 'Tres',
          title: 'Paso tres',
          time: '~3 min',
          content: [{ type: 'prose', text: 'texto' }],
          selfCheck: '?',
        },
      ],
      understanding: poisoned,
    });
    expect(normalized).toBeTruthy();
    expect(normalized!.understanding).toBeUndefined();
  });
});

describe('S04 final — versioned unit identity', () => {
  it('same source + versions → same IDs', () => {
    const units = [
      unitStub({ id: 'a', title: 'Alpha unit title' }),
      unitStub({ id: 'b', title: 'Beta unit title' }),
      unitStub({ id: 'c', title: 'Gamma unit title' }),
    ];
    const args = seedArgs('content-stable', { sourceVersionId: 'sv1' });
    const first = canonicalizeUnits(units, args);
    const second = canonicalizeUnits(units, args);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.units.map((u) => u.id)).toEqual(second.units.map((u) => u.id));
  });

  it('prose-only title change does not change slot IDs when plan order fixed', () => {
    const plan = ['slot-a', 'slot-b', 'slot-c'];
    const args = seedArgs('content-prose');
    const base = [
      unitStub({ id: 'a', title: 'Título original A' }),
      unitStub({ id: 'b', title: 'Título original B' }),
      unitStub({ id: 'c', title: 'Título original C' }),
    ];
    const tweaked = [
      unitStub({ id: 'a', title: 'Título reformulado A con más prosa' }),
      unitStub({ id: 'b', title: 'Título reformulado B con más prosa' }),
      unitStub({ id: 'c', title: 'Título reformulado C con más prosa' }),
    ];
    const first = canonicalizeUnits(base, args, plan);
    const second = canonicalizeUnits(tweaked, args, plan);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.units.map((u) => u.id)).toEqual(second.units.map((u) => u.id));
  });

  it('structural compiler version bump → different ID namespace', () => {
    const units = [
      unitStub({ id: 'a', title: 'Alpha unit title' }),
      unitStub({ id: 'b', title: 'Beta unit title' }),
      unitStub({ id: 'c', title: 'Gamma unit title' }),
    ];
    const v1 = canonicalizeUnits(
      units,
      seedArgs('content-v', { compilerVersion: 's04.compile.v1.1' })
    );
    const v2 = canonicalizeUnits(
      units,
      seedArgs('content-v', { compilerVersion: 's04.compile.v1.2' })
    );
    expect(v1.ok && v2.ok).toBe(true);
    if (!v1.ok || !v2.ok) return;
    expect(v1.units.map((u) => u.id)).not.toEqual(v2.units.map((u) => u.id));
    expect(v1.seed).not.toBe(v2.seed);
    // No collisions across namespaces
    const set = new Set([...v1.units, ...v2.units].map((u) => u.id));
    expect(set.size).toBe(6);
  });

  it('relations remap into new namespace after version bump', () => {
    const units = [
      unitStub({
        id: 'a',
        title: 'Origen',
        relations: [{ toUnitId: 'b', kind: 'supports' }],
      }),
      unitStub({ id: 'b', title: 'Destino' }),
      unitStub({ id: 'c', title: 'Extra' }),
    ];
    const v2 = canonicalizeUnits(
      units,
      seedArgs('rel-ns', { compilerVersion: UNDERSTANDING_COMPILER_VERSION })
    );
    expect(v2.ok).toBe(true);
    if (!v2.ok) return;
    expect(v2.units[0]!.relations[0]!.toUnitId).toBe(v2.units[1]!.id);
    expect(v2.units[0]!.relations[0]!.toUnitId).not.toBe('b');
  });

  it('seed includes depth and sourceVersion', () => {
    const a = buildUnitIdentitySeed(seedArgs('h', { depth: 'rapido' }));
    const b = buildUnitIdentitySeed(seedArgs('h', { depth: 'profundo' }));
    const c = buildUnitIdentitySeed(
      seedArgs('h', { depth: 'rapido', sourceVersionId: 'sv-other' })
    );
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('S04 final — planned relation equivalence', () => {
  it('A→B supports and C→D causes does not satisfy A→B causes', () => {
    const edges = [
      {
        fromTitle: 'Alpha',
        toTitle: 'Beta',
        fromId: '1',
        toId: '2',
        kind: 'supports',
      },
      {
        fromTitle: 'Charlie',
        toTitle: 'Delta',
        fromId: '3',
        toId: '4',
        kind: 'causes',
      },
    ];
    expect(
      matchPlannedRelation({ from: 'Alpha', to: 'Beta', kind: 'causes' }, edges)
    ).toBeNull();
  });

  it('same pair incompatible type → fail', () => {
    const edges = [
      {
        fromTitle: 'Alpha',
        toTitle: 'Beta',
        fromId: '1',
        toId: '2',
        kind: 'supports',
      },
    ];
    expect(
      matchPlannedRelation({ from: 'Alpha', to: 'Beta', kind: 'causes' }, edges)
    ).toBeNull();
  });

  it('compatible aliases → accept', () => {
    expect(familiesCompatible('causes', 'causa')).toBe(true);
    expect(familiesCompatible('supports', 'apoya')).toBe(true);
    expect(relationFamily('contributes')).toBe('contribution');
    const edges = [
      {
        fromTitle: 'Alpha',
        toTitle: 'Beta',
        fromId: '1',
        toId: '2',
        kind: 'causes',
      },
    ];
    expect(
      matchPlannedRelation({ from: 'Alpha', to: 'Beta', kind: 'causa' }, edges)
    ).not.toBeNull();
  });

  it('caution hedge without explanation → causes degraded/rejected', () => {
    const artifact = buildArtifact();
    const hedged: UnderstandingArtifact = {
      ...artifact,
      units: artifact.units.map((u, i) =>
        i === 0
          ? {
              ...u,
              explanation: 'La fuente describe un vínculo entre A y B.',
              cautions: ['Puede correlacionarse sin probar causalidad.'],
              relations: [{ toUnitId: artifact.units[1]!.id, kind: 'causes' }],
            }
          : { ...u, relations: [] }
      ),
      blueprint: {
        ...artifact.blueprint,
        plan: {
          ...artifact.blueprint.plan,
          relationsToPreserve: [
            {
              from: artifact.units[0]!.title,
              to: artifact.units[1]!.title,
              kind: 'causes',
            },
          ],
        },
      },
    };

    const guarded = applyCausalGuards(hedged);
    expect(guarded.units[0]!.relations[0]!.kind).toBe('contributes');

    const compiled = compileUnderstandingToMap(hedged);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const irKind = compiled.map.understanding?.units[0]?.relations[0]?.kind;
    expect(irKind).toBe('contributes');
    expect(JSON.stringify(compiled.map.steps).toLowerCase()).not.toMatch(
      /"causes"/
    );
  });

  it('visible and IR keep same relation semantics after compile', () => {
    const artifact = buildArtifact();
    const compiled = compileUnderstandingToMap(artifact);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const inv = assertCompileRelationInvariants(
      {
        ...artifact,
        units: compiled.map.understanding!.units,
      },
      compiled.map
    );
    expect(inv.ok).toBe(true);
    const planned = plannedRelationsRepresented({
      ...artifact,
      units: compiled.map.understanding!.units,
    });
    expect(planned.ok).toBe(true);
  });
});
