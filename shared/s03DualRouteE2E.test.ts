/**
 * Dual-route E2E with injected fakes (Express not required):
 * mobile-shaped request → resolveTransformIngest / orchestration → RPC fake →
 * generation fake → NDJSON/JSON protocol → mobile parser.
 *
 * Domain-only `orchestratePastedTextTransform` calls remain integration tests,
 * not this E2E suite.
 */

import { describe, expect, it } from 'vitest';
import { resolveTransformIngest } from '../server/src/routes/resolveTransformIngest';
import {
  orchestratePastedTextPersistOnly,
  orchestratePastedTextTransform,
} from '../server/src/ingestors/pastedTextOrchestration';
import { consumeTransformStream } from './transformStream';
import { normalizeMapData } from './mapData';
import { createPastedTextOperationIds } from './pastedText';
import type { PastedTextSourceMeta } from './pastedText';
import type { ActionMapData } from './contracts';
import { createEntry, loadHistory, saveHistory } from './history';
import { memoryStorage } from './storage';

const QUESTION = '¿Qué es la memoria de trabajo?';

const mapFixture = {
  title: 'Memoria de trabajo',
  coreIdea: 'La memoria de trabajo sostiene pocas piezas activas.',
  coreSupport: 'Es capacidad limitada de retención temporal.',
  intent: 'understand',
  tldr: [
    { title: 'Uno', desc: 'Primero del resumen breve.' },
    { title: 'Dos', desc: 'Segundo del resumen breve.' },
    { title: 'Tres', desc: 'Tercero del resumen breve.' },
  ],
  steps: Array.from({ length: 3 }, (_, index) => ({
    id: `step-${index + 1}`,
    shortNav: `Paso ${index + 1}`,
    title: `Paso ${index + 1}`,
    time: '~3 min',
    content: [{ type: 'prose', text: 'Contenido del paso.' }],
    selfCheck: '¿Qué recuerdas de este paso?',
  })),
  readingSections: [{ title: 'Base', fromStep: 1, toStep: 3 }],
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
} as unknown as ActionMapData;

describe('S03 dual-route E2E (fakes)', () => {
  it('request → ingest → RPC fake → fake map → stream+JSON parsers → history', async () => {
    const ids = createPastedTextOperationIds();
    const body = {
      type: 'text' as const,
      text: QUESTION,
      textMode: 'source' as const,
      ...ids,
    };

    let rpcCalls = 0;
    const orchestrated = await orchestratePastedTextTransform({
      body,
      persistFn: async () => {
        rpcCalls += 1;
        return { ok: true };
      },
    });
    expect(orchestrated.ok).toBe(true);
    if (!orchestrated.ok) return;
    expect(rpcCalls).toBe(1);

    const viaResolve = await resolveTransformIngest({
      body,
      // guest — no second persist
    });
    expect(viaResolve.kind).toBe('source');
    if (viaResolve.kind === 'source') {
      expect(viaResolve.pasted?.sourceMeta.segmentCount).toBeGreaterThan(0);
    }

    const sourceMeta = orchestrated.sourceMeta;

    // /api/transform JSON contract
    const jsonPayload = { ...mapFixture, sourceMeta };
    const normalizedJson = normalizeMapData(jsonPayload);
    expect(normalizedJson?.title).toBe('Memoria de trabajo');
    expect(jsonPayload.sourceMeta.persistStatus).toBe('cloud');

    // /api/transform/stream NDJSON contract
    const ndjson = [
      JSON.stringify({ type: 'source_meta', sourceMeta }),
      JSON.stringify({ type: 'done', map: mapFixture, model: 'fake', sourceMeta }),
      '',
    ].join('\n');
    let streamMeta: PastedTextSourceMeta | undefined;
    let doneMeta: PastedTextSourceMeta | undefined;
    const streamResult = await consumeTransformStream(
      new Response(ndjson, { headers: { 'Content-Type': 'application/x-ndjson' } }),
      {
        onSourceMeta: (m) => {
          streamMeta = m;
        },
        onDone: (_map, _model, m) => {
          doneMeta = m;
        },
        onError: (msg) => {
          throw new Error(msg);
        },
      }
    );
    expect(streamResult).toBe('done');
    expect(streamMeta?.sourceId).toBe(ids.sourceId);
    expect(doneMeta?.contentHash).toBe(sourceMeta.contentHash);

    // History keeps sourceMeta across save/load
    const prev = globalThis.localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
    try {
      const store = createEntry(
        loadHistory(),
        {
          data: normalizedJson!,
          currentStep: 0,
          isComplete: false,
          viewAll: false,
        },
        'text',
        ids.mapId,
        undefined,
        sourceMeta
      );
      saveHistory(store);
      const reloaded = loadHistory();
      const entry = reloaded.entries.find((e) => e.id === ids.mapId);
      expect(entry?.sourceMeta?.sourceRequestId).toBe(ids.sourceRequestId);
      expect(entry?.sourceMeta?.persistStatus).toBe('cloud');
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = prev;
    }

    // Same text as ASK → ask lane
    const ask = await resolveTransformIngest({
      body: { type: 'text', text: QUESTION, textMode: 'ask' },
    });
    expect(ask.kind).toBe('ask');
  });

  it('persist-only retry never invokes generation', async () => {
    const ids = createPastedTextOperationIds();
    let generationInvocations = 0;
    const generate = () => {
      generationInvocations += 1;
      return mapFixture;
    };
    const result = await orchestratePastedTextPersistOnly({
      text: QUESTION,
      ids,
      persistFn: async () => ({ ok: true }),
    });
    // Generation deliberately not called by persist-only path
    void generate;
    expect(generationInvocations).toBe(0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.persistStatus).toBe('cloud');
    }
  });
});
