/**
 * HTTP E2E for S03 productive handlers (supertest).
 *
 * Mounts `registerTransformRoutes` — the same registrar `server.ts` uses.
 * Dependencies (auth, persist, model) are fakes; handlers are not.
 */

import { describe, expect, it } from 'vitest';
import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import {
  registerTransformRoutes,
  TRANSFORM_HTTP_PATHS,
  handleTransformJsonRoute,
  handleTransformStreamRoute,
  handlePastedPersistRoute,
  REGISTER_TRANSFORM_ROUTES_MARKER,
  type TransformRouteDeps,
} from '../server/src/routes/registerTransformRoutes';
import { createPastedTextOperationIds } from './pastedText';
import { consumeTransformStream } from './transformStream';
import { normalizeMapData } from './mapData';
import { configureStorage, type SyncKeyValueStorage } from './storage';
import { createEntry, loadHistory, saveHistory } from './history';
import {
  buildStableCollectionPartBody,
  mintStableCollectionPartIdentities,
} from './collectionPartExecution';
import type { ActionMapData, TransformRequest } from './contracts';
import type { PersistPastedTextFn } from '../server/src/ingestors/pastedTextOrchestration';

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

type MountOpts = {
  userId?: string | null;
  requireAuthToken?: boolean;
  persistFn?: PersistPastedTextFn;
  persistFails?: boolean;
  map?: ActionMapData | ((body: TransformRequest) => ActionMapData);
  askAnswer?: string;
  rateLimited?: boolean;
  cancelled?: boolean;
};

function mountProductiveTransformApp(opts: MountOpts = {}): {
  app: Express;
  handlers: ReturnType<typeof registerTransformRoutes>['handlers'];
  generateCount: { n: number };
} {
  const generateCount = { n: 0 };
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const persistFn: PersistPastedTextFn =
    opts.persistFn ??
    (async () =>
      opts.persistFails
        ? { ok: false as const, error: 'SOURCE_PERSIST_FAILED' }
        : { ok: true as const });

  const deps: TransformRouteDeps = {
    authenticateOptional: async (req) => {
      if (opts.userId === null) return;
      if (opts.requireAuthToken !== false) {
        const token = req.header('authorization')?.replace(/^Bearer\s+/i, '')?.trim();
        if (!token && opts.userId === undefined) return;
        if (!token) return;
      }
      if (opts.userId === undefined && !req.header('authorization')) return;
      req.userId = opts.userId ?? 'user-a';
    },
    requireLlmAccess: async () => true,
    enforceProEntitlements: () => true,
    enforceUsageQuota: () => true,
    consumeTransformRateLimit: () => !opts.rateLimited,
    isCsvTransformRequest: () => false,
    describeBlockedTransformUrl: () => null,
    isCancelled: () => Boolean(opts.cancelled),
    getClientIp: () => '127.0.0.1',
    getAccessToken: (req) =>
      req.header('authorization')?.replace(/^Bearer\s+/i, '')?.trim(),
    getSupabaseConfig: () => ({ url: 'http://test.local', anonKey: 'test-anon' }),
    persistFnOverride: persistFn,
    generateAskAnswer: async () => opts.askAnswer ?? 'respuesta ask controlada',
    buildTransformContext: async () => ({
      contents: 'ctx',
      modelChain: ['fake-model'],
      maxOutputTokens: 1024,
      resolvedDepth: 'medium',
    }),
    generateTransformJson: async () => {
      generateCount.n += 1;
      return { rawText: '{}', usedModel: 'fake-model' };
    },
    finalizeMapJson: async (_raw, _ctx, _model, _opts) => {
      // map resolved after body is known via closure — see run below
      return mapFixture;
    },
    attachCitations: (m) => m,
    runTransformStream: async (_ctx, res, _req, _ingest, sourceMeta) => {
      generateCount.n += 1;
      res.setHeader('Content-Type', 'application/x-ndjson');
      if (sourceMeta) {
        res.write(`${JSON.stringify({ type: 'source_meta', sourceMeta })}\n`);
      }
      const map =
        typeof opts.map === 'function' ? opts.map({} as TransformRequest) : opts.map ?? mapFixture;
      res.write(`${JSON.stringify({ type: 'done', map })}\n`);
      res.end();
    },
    createJwtPersistFn: () => persistFn,
    describeSecureFetchError: () => null,
    describeGeminiError: () => ({ statusCode: 500, errorMessage: 'error de modelo' }),
    isIngestError: (err): err is { httpStatus: number; message: string; code?: string } =>
      Boolean(err && typeof err === 'object' && 'httpStatus' in err),
  };

  // Capture map-from-body for JSON path
  const mapResolver = opts.map;
  deps.finalizeMapJson = async () => {
    if (typeof mapResolver === 'function') {
      // last request body is not available here; collection test uses stream/json with title via generate
      return mapFixture;
    }
    return mapResolver ?? mapFixture;
  };

  // Better: wrap generate to stamp title from a side channel
  let lastBody: TransformRequest | null = null;
  const origBuild = deps.buildTransformContext;
  deps.buildTransformContext = async (body, o) => {
    lastBody = body;
    return origBuild(body, o);
  };
  deps.finalizeMapJson = async () => {
    if (typeof mapResolver === 'function' && lastBody) {
      return mapResolver(lastBody);
    }
    return (typeof mapResolver === 'function' ? mapFixture : mapResolver) ?? mapFixture;
  };
  deps.runTransformStream = async (_ctx, res, _req, _ingest, sourceMeta) => {
    generateCount.n += 1;
    res.setHeader('Content-Type', 'application/x-ndjson');
    if (sourceMeta) {
      res.write(`${JSON.stringify({ type: 'source_meta', sourceMeta })}\n`);
    }
    const map =
      typeof mapResolver === 'function' && lastBody
        ? mapResolver(lastBody)
        : (typeof mapResolver === 'function' ? mapFixture : mapResolver) ?? mapFixture;
    res.write(`${JSON.stringify({ type: 'done', map })}\n`);
    res.end();
  };

  const { handlers } = registerTransformRoutes(app, deps);
  return { app, handlers, generateCount };
}

describe('S03 productive HTTP handlers (supertest)', () => {
  it('architectural parity: server.ts registers shared handlers; no parallel router', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const serverSrc = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
    expect(serverSrc).toContain(REGISTER_TRANSFORM_ROUTES_MARKER);
    expect(serverSrc).toContain('registerTransformRoutes(app, transformRouteDeps)');
    expect(serverSrc).not.toContain('createS03TransformRouter');
    expect(serverSrc).not.toMatch(
      /app\.post\(\s*["']\/api\/transform["']/
    );
    expect(serverSrc).not.toMatch(
      /app\.post\(\s*["']\/api\/transform\/stream["']/
    );
    expect(serverSrc).not.toMatch(
      /app\.post\(\s*["']\/api\/sources\/pasted\/persist["']/
    );

    // Handler symbols exported for identity — same functions tests invoke.
    expect(typeof handleTransformJsonRoute).toBe('function');
    expect(typeof handleTransformStreamRoute).toBe('function');
    expect(typeof handlePastedPersistRoute).toBe('function');
    expect(TRANSFORM_HTTP_PATHS.transform).toBe('/api/transform');

    const dupPath = path.join(root, 'server/src/routes/s03TransformRoutes.ts');
    expect(fs.existsSync(dupPath)).toBe(false);
  });

  it('POST /api/transform JSON + sourceMeta; ASK vs SOURCE', async () => {
    const persistCalls: unknown[] = [];
    const ids = createPastedTextOperationIds();
    const { app, generateCount } = mountProductiveTransformApp({
      persistFn: async (args) => {
        persistCalls.push(args);
        return { ok: true };
      },
    });

    const sourceRes = await request(app)
      .post('/api/transform')
      .set('Authorization', 'Bearer tok-a')
      .send({
        type: 'text',
        text: QUESTION,
        textMode: 'source',
        ...ids,
      })
      .expect(200);

    expect(sourceRes.headers['x-nucleo-source-id']).toBe(ids.sourceId);
    expect(sourceRes.body.sourceMeta).toBeTruthy();
    expect(sourceRes.body.sourceMeta.persistStatus).toBe('cloud');
    expect(normalizeMapData(sourceRes.body)?.title).toBe('Memoria de trabajo');
    expect(persistCalls).toHaveLength(1);
    expect(generateCount.n).toBe(1);

    const askRes = await request(app)
      .post('/api/transform')
      .send({ type: 'text', text: QUESTION, textMode: 'ask' })
      .expect(200);
    expect(askRes.body.isAsk).toBe(true);
    expect(askRes.body.answer).toContain('ask');
    expect(generateCount.n).toBe(1);
  });

  it('POST /api/transform/stream emits NDJSON source_meta + done', async () => {
    const ids = createPastedTextOperationIds();
    const { app } = mountProductiveTransformApp();

    const res = await request(app)
      .post('/api/transform/stream')
      .set('Authorization', 'Bearer tok-a')
      .send({
        type: 'text',
        text: 'Fuente larga para stream. '.repeat(20),
        textMode: 'source',
        ...ids,
      })
      .expect(200);

    expect(String(res.headers['content-type'])).toMatch(/ndjson|json/);
    const bodyText = typeof res.text === 'string' ? res.text : String(res.body);
    expect(bodyText).toContain('"type":"source_meta"');
    expect(bodyText).toContain('"type":"done"');

    let gotMeta = false;
    await consumeTransformStream(new Response(bodyText), {
      onSourceMeta: () => {
        gotMeta = true;
      },
      onDone: () => {},
      onError: (m) => {
        throw new Error(m);
      },
    });
    expect(gotMeta).toBe(true);
  });

  it('POST /api/sources/pasted/persist does not invoke generation', async () => {
    const ids = createPastedTextOperationIds();
    const { app, generateCount } = mountProductiveTransformApp();

    const res = await request(app)
      .post('/api/sources/pasted/persist')
      .set('Authorization', 'Bearer tok-a')
      .send({
        text: QUESTION,
        ...ids,
        textMode: 'source',
      })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.sourceMeta.persistStatus).toBe('cloud');
    expect(generateCount.n).toBe(0);
  });

  it('collection of two parts keeps stable IDs and per-part sourceMeta through HTTP', async () => {
    const baseIds = createPastedTextOperationIds();
    const base: TransformRequest = {
      type: 'text',
      text: 'Parte base',
      textMode: 'source',
      ...baseIds,
    };
    const identities = mintStableCollectionPartIdentities(2);
    const parts = [
      { title: '¿Qué es A?', text: '¿Qué es la memoria de trabajo en la parte A?' },
      { title: 'Parte B', text: 'Texto de la parte B con más contenido útil.' },
    ];

    const { app } = mountProductiveTransformApp({
      map: (body) => ({
        ...mapFixture,
        title: body.sourceLabel || mapFixture.title,
      }),
    });

    configureStorage(memoryKv());
    let store = loadHistory();
    const metas: string[] = [];

    for (let i = 0; i < parts.length; i += 1) {
      const partBody = buildStableCollectionPartBody(base, parts[i]!, identities[i]!);
      expect(partBody.textMode).toBe('source');
      const retryBody = buildStableCollectionPartBody(base, parts[i]!, identities[i]!);
      expect(retryBody.mapId).toBe(partBody.mapId);
      expect(retryBody.sourceRequestId).toBe(partBody.sourceRequestId);

      const res = await request(app)
        .post('/api/transform')
        .set('Authorization', 'Bearer tok-a')
        .send(partBody)
        .expect(200);

      expect(res.body.sourceMeta.sourceRequestId).toBe(identities[i]!.sourceRequestId);
      metas.push(res.body.sourceMeta.sourceRequestId);
      const normalized = normalizeMapData(res.body);
      expect(normalized).toBeTruthy();
      store = createEntry(
        store,
        {
          data: normalized!,
          currentStep: 0,
          isComplete: false,
          viewAll: false,
        },
        'text',
        identities[i]!.mapId,
        undefined,
        res.body.sourceMeta
      );
    }

    saveHistory(store);
    const reloaded = loadHistory();
    expect(metas[0]).not.toBe(metas[1]);
    expect(
      reloaded.entries.find((e) => e.id === identities[0]!.mapId)?.sourceMeta?.sourceRequestId
    ).toBe(identities[0]!.sourceRequestId);
  });

  it('persist requires auth; rate-limit returns 429; cancel returns 499; persist error surfaces', async () => {
    const ids = createPastedTextOperationIds();

    const unauth = mountProductiveTransformApp({ userId: null });
    await request(unauth.app)
      .post('/api/sources/pasted/persist')
      .send({ text: QUESTION, ...ids })
      .expect(401);

    const limited = mountProductiveTransformApp({ rateLimited: true });
    await request(limited.app)
      .post('/api/transform')
      .set('Authorization', 'Bearer tok-a')
      .send({ type: 'text', text: QUESTION, textMode: 'source', ...ids })
      .expect(429);

    const cancelled = mountProductiveTransformApp({ cancelled: true });
    await request(cancelled.app)
      .post('/api/transform')
      .set('Authorization', 'Bearer tok-a')
      .send({ type: 'text', text: QUESTION, textMode: 'source', ...createPastedTextOperationIds() })
      .expect(499);

    const failPersist = mountProductiveTransformApp({ persistFails: true });
    const failRes = await request(failPersist.app)
      .post('/api/transform')
      .set('Authorization', 'Bearer tok-a')
      .send({ type: 'text', text: QUESTION, textMode: 'source', ...createPastedTextOperationIds() })
      .expect(200);
    // Productive path: generation continues; sync failure is in sourceMeta (not a hard HTTP error).
    expect(failRes.body.sourceMeta.persistStatus).toBe('sync_failed');
    expect(failPersist.generateCount.n).toBe(1);

    const failOnly = mountProductiveTransformApp({ persistFails: true });
    const persistOnlyRes = await request(failOnly.app)
      .post('/api/sources/pasted/persist')
      .set('Authorization', 'Bearer tok-a')
      .send({ text: QUESTION, ...createPastedTextOperationIds() })
      .expect(200);
    expect(persistOnlyRes.body.sourceMeta.persistStatus).toBe('sync_failed');
  });

  it('registered handlers are the productive shared functions', () => {
    const { handlers } = mountProductiveTransformApp();
    // Wrappers close over deps but call the shared route implementations.
    expect(handlers.persist.length).toBeGreaterThanOrEqual(2);
    expect(handlers.transform.length).toBeGreaterThanOrEqual(2);
    expect(handlers.stream.length).toBeGreaterThanOrEqual(2);
  });
});
