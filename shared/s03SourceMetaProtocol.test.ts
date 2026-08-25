import { describe, expect, it } from 'vitest';
import {
  consumeTransformStream,
  parseTransformStreamLine,
} from './transformStream';
import type { PastedTextSourceMeta } from './pastedText';
import { configureStorage, type SyncKeyValueStorage } from './storage';
import {
  loadPendingSourceSync,
  upsertPendingSourceSync,
} from './pendingSourceSync';

const meta: PastedTextSourceMeta = {
  sourceId: '11111111-1111-4111-8111-111111111111',
  sourceVersionId: '22222222-2222-4222-8222-222222222222',
  sourceRequestId: '33333333-3333-4333-8333-333333333333',
  sourceStatus: 'ready',
  persistStatus: 'sync_failed',
  contentHash: 'abc',
  segmentCount: 2,
};

const mapFixture = {
  title: 'Mapa de prueba',
  coreIdea: 'Idea central breve',
  coreSupport: 'Apoyo breve',
  intent: 'understand',
  tldr: [
    { title: 'Uno', desc: 'Primero' },
    { title: 'Dos', desc: 'Segundo' },
    { title: 'Tres', desc: 'Tercero' },
  ],
  steps: Array.from({ length: 3 }, (_, index) => ({
    id: `step-${index + 1}`,
    shortNav: `Paso ${index + 1}`,
    title: `Paso ${index + 1}`,
    time: '~3 min',
    content: [{ type: 'prose', text: 'Contenido del paso.' }],
    selfCheck: '¿Qué recuerdas?',
  })),
  readingSections: [{ title: 'Parte A', fromStep: 1, toStep: 3 }],
  sourceMetadata: {
    kind: 'text',
    label: 'Fuente',
    detected: ['Fuente'],
    limitations: [],
  },
  coverage: { summary: 'Cobertura', notes: [] },
  completionCard: {
    title: 'Completado',
    summary: 'Resumen',
    takeaways: ['Uno'],
  },
};

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

describe('S03 source_meta protocol', () => {
  it('parses source_meta NDJSON events', () => {
    const event = parseTransformStreamLine(
      JSON.stringify({ type: 'source_meta', sourceMeta: meta })
    );
    expect(event?.type).toBe('source_meta');
    expect(event?.sourceMeta?.persistStatus).toBe('sync_failed');
  });

  it('streaming path delivers source_meta to handler and onDone', async () => {
    const lines = [
      JSON.stringify({ type: 'source_meta', sourceMeta: meta }),
      JSON.stringify({ type: 'done', map: mapFixture, model: 'x', sourceMeta: meta }),
      '',
    ].join('\n');

    const response = new Response(lines, {
      headers: { 'Content-Type': 'application/x-ndjson' },
    });

    const seen: PastedTextSourceMeta[] = [];
    let doneMeta: PastedTextSourceMeta | undefined;
    const result = await consumeTransformStream(response, {
      onSourceMeta: (m) => seen.push(m),
      onDone: (_map, _model, m) => {
        doneMeta = m;
      },
      onError: (msg) => {
        throw new Error(msg);
      },
    });
    expect(result).toBe('done');
    expect(seen[0]?.sourceRequestId).toBe(meta.sourceRequestId);
    expect(doneMeta?.persistStatus).toBe('sync_failed');
  });
});

describe('S03 pending sync ownership', () => {
  it('A pending is not visible under B', () => {
    configureStorage(memoryKv());
    upsertPendingSourceSync('user-a', {
      mapId: '44444444-4444-4444-8444-444444444444',
      sourceId: meta.sourceId,
      sourceVersionId: meta.sourceVersionId,
      sourceRequestId: meta.sourceRequestId,
      canonicalText: 'hola',
      contentHash: 'abc',
    });
    expect(loadPendingSourceSync('user-a')).toHaveLength(1);
    expect(loadPendingSourceSync('user-b')).toHaveLength(0);
  });
});
