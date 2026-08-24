import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  registerTransformRoutes,
  type TransformRouteDeps,
} from '../../server/src/routes/registerTransformRoutes';
import type { ActionMapData } from '../contracts';
import { lumenCanvasToMap } from './toMap';
import { LUMEN_SAMPLE_CANVAS } from './samples';
import type { ResolvedTransformIngest } from '../../server/src/routes/resolveTransformIngest';

function stubMap(): ActionMapData {
  return {
    title: 'Classic',
    coreIdea: 'idea',
    coreSupport: 'support',
    tldr: [{ title: 'A', desc: 'B' }],
    steps: [
      {
        id: 's1',
        shortNav: 'Uno',
        title: 'Uno',
        time: '~1 min',
        content: [{ type: 'prose', text: 'texto' }],
      },
    ],
  };
}

function sourceIngest(text: string): ResolvedTransformIngest {
  return {
    kind: 'source',
    body: { type: 'text', text, intent: 'understand', textMode: 'source' },
    ingest: {
      rawHash: 'hash',
      metadata: { type: 'text', title: 'paste' },
      chunks: [
        {
          id: 'chk1',
          text,
          hash: 'h',
          loc: { start: 0, end: text.length },
        },
      ],
    },
    overviewOnly: false,
    skipSourceTruncate: true,
    provenance: {
      originalKind: 'text',
      extractionKind: 'pasted_text',
      contentHash: 'hash',
    },
  };
}

function deps(overrides: Partial<TransformRouteDeps> = {}): TransformRouteDeps {
  return {
    authenticateOptional: async () => undefined,
    requireLlmAccess: async () => true,
    enforceProEntitlements: () => true,
    enforceUsageQuota: () => true,
    consumeTransformRateLimit: () => true,
    isCsvTransformRequest: () => false,
    describeBlockedTransformUrl: () => null,
    isCancelled: () => false,
    getClientIp: () => '127.0.0.1',
    getAccessToken: () => undefined,
    getSupabaseConfig: () => ({}),
    generateAskAnswer: async () => 'ask',
    buildTransformContext: async () => {
      throw new Error('legacy path should not run');
    },
    generateTransformJson: async () => {
      throw new Error('legacy path should not run');
    },
    finalizeMapJson: async () => stubMap(),
    attachCitations: (map) => map,
    runUnderstandEngine: async () => ({
      ok: true,
      map: stubMap(),
      model: 'understand-test',
    }),
    runTransformStream: async () => {
      throw new Error('legacy stream should not run');
    },
    createJwtPersistFn: () => async () => ({ ok: true as const }),
    describeSecureFetchError: () => null,
    describeGeminiError: () => ({ statusCode: 500, errorMessage: 'err' }),
    isIngestError: (err: unknown): err is { httpStatus: number; message: string; code?: string } =>
      false,
    ...overrides,
  };
}

describe('lumen-v1 transform path', () => {
  it('skips Entender and returns a canvas map', async () => {
    const app = express();
    app.use(express.json());
    let understandCalled = false;
    const canvasMap = lumenCanvasToMap(LUMEN_SAMPLE_CANVAS, { modelUsed: 'gemini-3.7-flash' });
    registerTransformRoutes(
      app,
      deps({
        resolveIngest: async () => sourceIngest('relatividad especial'),
        runUnderstandEngine: async () => {
          understandCalled = true;
          return { ok: true, map: stubMap(), model: 'no' };
        },
        runLumenIlluminate: async () => ({
          ok: true,
          map: canvasMap,
          model: 'gemini-3.7-flash',
        }),
      })
    );
    const res = await request(app).post('/api/transform').send({
      type: 'text',
      text: 'relatividad especial',
      textMode: 'source',
      generationMode: 'lumen-v1',
    });
    expect(understandCalled).toBe(false);
    expect(res.status).toBe(200);
    expect(res.body.generationMode).toBe('lumen-v1');
    expect(res.body.lumenCanvas.kind).toBe('explain');
  });

  it('classic still hits Entender', async () => {
    const app = express();
    app.use(express.json());
    let lumenCalled = false;
    registerTransformRoutes(
      app,
      deps({
        resolveIngest: async () =>
          sourceIngest('Fuente pegada con suficiente contenido para entender el material con calma.'),
        runLumenIlluminate: async () => {
          lumenCalled = true;
          return { ok: false, status: 500, error: 'no', code: 'X' };
        },
      })
    );
    const res = await request(app).post('/api/transform').send({
      type: 'text',
      text: 'Fuente pegada con suficiente contenido para entender el material con calma.',
      textMode: 'source',
      generationMode: 'classic',
    });
    expect(lumenCalled).toBe(false);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Classic');
  });
});
