import { describe, expect, it, vi } from 'vitest';
import type { SourceChunk } from '../types/chunk';
import {
  clearEvidenceCache,
  createFakeEvidenceGenerateJson,
  EVIDENCE_ENTAILMENT_CONCURRENCY,
  runEvidenceEngine,
} from './index';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
  canonicalizeUnits,
  validateClosure,
  validateUnits,
} from '../understanding';
import {
  GOLDEN_FIXTURES,
  goldenBlueprint,
  goldenUnitsPayload,
} from '../understanding/fixtures/goldenSources';
import type { ActionMapData } from '../contracts';
import type { UnderstandingArtifact } from '../understanding/types';

function chunk(id: string, text: string): SourceChunk {
  return {
    id,
    text,
    hash: `h-${id}`,
    loc: { start: 0, end: text.length },
  };
}

function buildArtifact(): UnderstandingArtifact {
  const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
  const bp = goldenBlueprint('explanatory_caution');
  const payload = goldenUnitsPayload('explanatory_caution', fixture.chunkIds);
  const units = validateUnits(payload.units, {
    depth: 'estandar',
    allowedChunkIds: new Set(fixture.chunkIds),
    blueprint: bp,
  });
  if (units.ok === false) throw new Error(units.errors.join(';'));
  const canon = canonicalizeUnits(
    units.value,
    {
      contentHash: 's05-hash',
      depth: 'estandar',
      schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
      promptVersion: UNDERSTANDING_PROMPT_VERSION,
      compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    },
    bp.plan.unitOrder
  );
  if (canon.ok === false) throw new Error(canon.errors.join(';'));
  const closure = validateClosure(payload.closure);
  if (closure.ok === false) throw new Error(closure.errors.join(';'));
  return {
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    modelVersion: 'fake',
    intent: 'understand',
    depth: 'estandar',
    status: 'complete',
    contentHash: 's05-hash',
    blueprint: bp,
    units: canon.units,
    closure: closure.value,
  };
}

function baseMap(artifact: UnderstandingArtifact, chunks: SourceChunk[]): ActionMapData {
  return {
    title: artifact.blueprint.essential.nuclearIdea.slice(0, 40),
    coreIdea: artifact.blueprint.essential.nuclearIdea,
    coreSupport: artifact.blueprint.essential.layer0Synthesis,
    intent: 'understand',
    tldr: [
      { title: 'A', desc: 'a' },
      { title: 'B', desc: 'b' },
      { title: 'C', desc: 'c' },
    ],
    steps: artifact.units.map((u) => ({
      id: u.id,
      shortNav: u.title.slice(0, 20),
      title: u.title,
      time: '~3 min',
      content: [{ type: 'prose' as const, text: u.explanation }],
    })),
    understanding: artifact,
    citedChunks: chunks,
    chunkIdManifest: chunks.map((c) => c.id),
  };
}

describe('S05 heartbeats + concurrency', () => {
  it('emits heartbeats during a slow evidence phase', async () => {
    clearEvidenceCache();
    const artifact = buildArtifact();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const chunks = fixture.chunkIds.map((id, i) =>
      chunk(id, `Texto de evidencia ${i} con detalle suficiente para anclar claims.`)
    );

    const beats: Array<{ processed: number; total: number }> = [];
    const result = await runEvidenceEngine({
      artifact,
      map: baseMap(artifact, chunks),
      ingest: {
        chunks,
        metadata: { type: 'text' },
        rawHash: 's05-hash',
      },
      contentHash: 's05-hash',
      generateJson: createFakeEvidenceGenerateJson({ delayMs: 25 }),
      onHeartbeat: (info) => beats.push({ ...info }),
    });

    expect(result.ok).toBe(true);
    expect(beats.length).toBeGreaterThan(0);
    expect(beats[0]?.total).toBeGreaterThan(0);
  });

  it('uses bounded concurrency constant', () => {
    expect(EVIDENCE_ENTAILMENT_CONCURRENCY).toBeGreaterThanOrEqual(2);
    expect(EVIDENCE_ENTAILMENT_CONCURRENCY).toBeLessThanOrEqual(4);
  });

  it('cancels cleanly mid-run', async () => {
    clearEvidenceCache();
    const artifact = buildArtifact();
    const fixture = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!;
    const chunks = fixture.chunkIds.map((id, i) =>
      chunk(id, `Texto de evidencia ${i} con detalle suficiente para anclar claims.`)
    );
    let cancelled = false;
    setTimeout(() => {
      cancelled = true;
    }, 5);
    const result = await runEvidenceEngine({
      artifact,
      map: baseMap(artifact, chunks),
      ingest: {
        chunks,
        metadata: { type: 'text' },
        rawHash: 's05-hash',
      },
      contentHash: 's05-hash',
      generateJson: createFakeEvidenceGenerateJson({ delayMs: 40 }),
      isCancelled: () => cancelled,
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe('EVIDENCE_CANCELLED');
    }
  });
});

void vi;
