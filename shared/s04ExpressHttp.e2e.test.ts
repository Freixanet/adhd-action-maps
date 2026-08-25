/**
 * S04 HTTP E2E — same registerTransformRoutes as production.
 * Fake understand engine; no live Gemini.
 */

import { describe, expect, it } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import {
  registerTransformRoutes,
  TRANSFORM_HTTP_PATHS,
  type TransformRouteDeps,
} from '../server/src/routes/registerTransformRoutes';
import type { ResolvedTransformIngest } from '../server/src/routes/resolveTransformIngest';
import { createRunUnderstandEngineDep } from '../server/src/understanding/wireUnderstandEngine';
import { createFakeUnderstandGenerateJson } from './understanding/fixtures/fakeProvider';
import { GOLDEN_FIXTURES } from './understanding/fixtures/goldenSources';
import { clearUnderstandingCache, buildSourceProvenance } from './understanding';
import { createFakeEvidenceGenerateJson } from './evidence/fakeProvider';
import { createRunEvidenceEngineDep } from '../server/src/evidence/wireEvidenceEngine';
import { attachCitations } from '../server/src/citations';
import { consumeTransformStream } from './transformStream';
import { createPastedTextOperationIds } from './pastedText';
import type { ActionMapData, TransformRequest } from './contracts';
import type { IngestResult } from './types/chunk';

const SOURCE = GOLDEN_FIXTURES.find((f) => f.id === 'explanatory_caution')!.source;

type SpyCounts = {
  understandCalls: number;
  legacyJsonCalls: number;
  legacyStreamCalls: number;
};

type MountOpts = {
  cancelled?: boolean;
  resolveIngest?: TransformRouteDeps['resolveIngest'];
  /** When false, legacy paths throw if invoked (default for S04 pasted tests). */
  allowLegacy?: boolean;
};

function legacyMapShell(kind: 'text' | 'youtube' | 'pdf' | 'link' = 'text', url?: string): ActionMapData {
  return {
    title: 'Legacy map',
    coreIdea: 'Legacy path used for non-S04 understand routes.',
    coreSupport: 'Soporte',
    intent: 'understand',
    sourceMetadata: {
      kind,
      label: kind === 'youtube' ? 'YouTube' : kind === 'pdf' ? 'PDF' : 'Fuente',
      url,
      detected: [],
    },
    tldr: [
      { title: 'A', desc: 'a' },
      { title: 'B', desc: 'b' },
      { title: 'C', desc: 'c' },
    ],
    steps: [
      {
        id: 's1',
        shortNav: 'Uno',
        title: 'Paso legacy uno',
        time: '~3 min',
        content: [{ type: 'prose', text: 'x' }],
        selfCheck: '?',
      },
      {
        id: 's2',
        shortNav: 'Dos',
        title: 'Paso legacy dos',
        time: '~3 min',
        content: [{ type: 'prose', text: 'x' }],
        selfCheck: '?',
      },
      {
        id: 's3',
        shortNav: 'Tres',
        title: 'Paso legacy tres',
        time: '~3 min',
        content: [{ type: 'prose', text: 'x' }],
        selfCheck: '?',
      },
    ],
  };
}

function mountS04App(opts: MountOpts = {}): Express {
  clearUnderstandingCache();
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const allowLegacy = opts.allowLegacy ?? false;

  const deps: TransformRouteDeps = {
    authenticateOptional: async (req) => {
      req.userId = 'user-s04';
    },
    requireLlmAccess: async () => true,
    enforceProEntitlements: () => true,
    enforceUsageQuota: () => true,
    consumeTransformRateLimit: () => true,
    isCsvTransformRequest: () => false,
    describeBlockedTransformUrl: () => null,
    isCancelled: () => Boolean(opts.cancelled),
    getClientIp: () => '127.0.0.1',
    getAccessToken: () => 'test-token',
    getSupabaseConfig: () => ({ url: undefined, anonKey: undefined }),
    persistFnOverride: async () => ({ ok: true as const }),
    resolveIngest: opts.resolveIngest,
    generateAskAnswer: async () => 'ask',
    buildTransformContext: async () => ({
      contents: 'legacy',
      modelChain: ['legacy'],
      maxOutputTokens: 1024,
      resolvedDepth: 'estandar',
    }),
    generateTransformJson: async () => {
      if (!allowLegacy) throw new Error('legacy path must not run for understand');
      return { rawText: '{}', usedModel: 'legacy' };
    },
    finalizeMapJson: async () => {
      if (!allowLegacy) throw new Error('legacy finalize must not run for understand');
      return legacyMapShell();
    },
    attachCitations,
    runUnderstandEngine: createRunUnderstandEngineDep({
      generateJson: createFakeUnderstandGenerateJson(),
    }),
    runEvidenceEngine: createRunEvidenceEngineDep({
      generateJson: createFakeEvidenceGenerateJson(),
    }),
    runTransformStream: async () => {
      if (!allowLegacy) throw new Error('legacy stream must not run for understand');
    },
    createJwtPersistFn: () => async () => ({ ok: true as const }),
    describeSecureFetchError: () => null,
    describeGeminiError: () => ({ statusCode: 500, errorMessage: 'model error' }),
    isIngestError: (err): err is { httpStatus: number; message: string; code?: string } =>
      Boolean(err && typeof err === 'object' && 'httpStatus' in err),
  };

  registerTransformRoutes(app, deps);
  return app;
}

function mountSpyApp(opts: MountOpts = {}): { app: Express; spies: SpyCounts } {
  clearUnderstandingCache();
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const spies: SpyCounts = {
    understandCalls: 0,
    legacyJsonCalls: 0,
    legacyStreamCalls: 0,
  };

  const fakeGen = createFakeUnderstandGenerateJson();
  const wiredEngine = createRunUnderstandEngineDep({ generateJson: fakeGen });

  const deps: TransformRouteDeps = {
    authenticateOptional: async (req) => {
      req.userId = 'user-s04';
    },
    requireLlmAccess: async () => true,
    enforceProEntitlements: () => true,
    enforceUsageQuota: () => true,
    consumeTransformRateLimit: () => true,
    isCsvTransformRequest: () => false,
    describeBlockedTransformUrl: () => null,
    isCancelled: () => Boolean(opts.cancelled),
    getClientIp: () => '127.0.0.1',
    getAccessToken: () => 'test-token',
    getSupabaseConfig: () => ({ url: undefined, anonKey: undefined }),
    persistFnOverride: async () => ({ ok: true as const }),
    resolveIngest: opts.resolveIngest,
    generateAskAnswer: async () => 'ask',
    buildTransformContext: async () => ({
      contents: 'legacy',
      modelChain: ['legacy-model'],
      maxOutputTokens: 1024,
      resolvedDepth: 'estandar',
    }),
    generateTransformJson: async () => {
      spies.legacyJsonCalls += 1;
      return { rawText: '{}', usedModel: 'legacy-model' };
    },
    finalizeMapJson: async (_raw, _ctx, _model, { req }) => {
      const body = req.body as TransformRequest;
      const kind =
        body.type === 'youtube'
          ? 'youtube'
          : body.type === 'pdf'
            ? 'pdf'
            : body.type === 'link'
              ? 'link'
              : 'text';
      const url =
        typeof body.text === 'string' && /^https?:\/\//i.test(body.text.trim())
          ? body.text.trim().split(/\s/)[0]
          : undefined;
      return legacyMapShell(kind, url);
    },
    attachCitations,
    runUnderstandEngine: async (engineOpts) => {
      spies.understandCalls += 1;
      return wiredEngine(engineOpts);
    },
    runEvidenceEngine: createRunEvidenceEngineDep({
      generateJson: createFakeEvidenceGenerateJson(),
    }),
    runTransformStream: async () => {
      spies.legacyStreamCalls += 1;
    },
    createJwtPersistFn: () => async () => ({ ok: true as const }),
    describeSecureFetchError: () => null,
    describeGeminiError: () => ({ statusCode: 500, errorMessage: 'model error' }),
    isIngestError: (err): err is { httpStatus: number; message: string; code?: string } =>
      Boolean(err && typeof err === 'object' && 'httpStatus' in err),
  };

  registerTransformRoutes(app, deps);
  return { app, spies };
}

function pastedUnderstandBody(): TransformRequest {
  const ids = createPastedTextOperationIds();
  return {
    type: 'text',
    text: SOURCE,
    textMode: 'source',
    intent: 'understand',
    depth: 'estandar',
    mapId: ids.mapId,
    sourceId: ids.sourceId,
    sourceVersionId: ids.sourceVersionId,
    sourceRequestId: ids.sourceRequestId,
  };
}

function sourceIngestFromText(text: string): IngestResult {
  return {
    sourceId: 'src-spy',
    chunks: [
      {
        id: 'c_spy_1',
        text,
        hash: 'h1',
        loc: { start: 0, end: text.length },
        order: 0,
      },
    ],
  } as unknown as IngestResult;
}

function buildPastedResolve(body: TransformRequest, contentHash: string): ResolvedTransformIngest {
  const text = typeof body.text === 'string' ? body.text : SOURCE;
  const ingest: IngestResult = {
    ...sourceIngestFromText(text),
    metadata: { type: 'text', title: 'Paste' },
    rawHash: contentHash,
  };
  const ids = {
    mapId: body.mapId!,
    sourceId: body.sourceId!,
    sourceVersionId: body.sourceVersionId!,
    sourceRequestId: body.sourceRequestId!,
  };
  const provenance = buildSourceProvenance({
    body,
    originalBody: { type: 'text', text, sourceLabel: body.sourceLabel },
    ingest,
    contentHash,
    sourceId: ids.sourceId,
    sourceVersionId: ids.sourceVersionId,
  });
  return {
    kind: 'source' as const,
    body,
    ingest,
    overviewOnly: false,
    skipSourceTruncate: true,
    provenance,
    pasted: {
      ok: true as const,
      body,
      ingest,
      canonical: text,
      contentHash,
      ids,
      sourceStatus: 'ready' as const,
      persistStatus: 'synced' as const,
      sourceMeta: {
        sourceId: ids.sourceId,
        sourceVersionId: ids.sourceVersionId,
        sourceRequestId: ids.sourceRequestId,
        sourceStatus: 'ready' as const,
        persistStatus: 'synced' as const,
        contentHash,
        segmentCount: ingest.chunks.length,
      },
    },
  } as unknown as ResolvedTransformIngest;
}

function buildWebResolve(
  body: TransformRequest,
  originalUrl: string,
  extractedText: string
): ResolvedTransformIngest {
  const contentHash = 'hash-web-e2e';
  const ingest: IngestResult = {
    chunks: [
      {
        id: 'c_web_1',
        text: extractedText,
        hash: 'hw',
        loc: { start: 0, end: extractedText.length },
      },
    ],
    metadata: { type: 'url', title: 'Web article' },
    rawHash: contentHash,
  };
  const nextBody: TransformRequest = {
    ...body,
    type: 'text',
    text: `Los marcadores [[c_web_1]]…\n[[c_web_1]]\n${extractedText}`,
    sourceLabel: 'Web article',
  };
  const provenance = buildSourceProvenance({
    body: nextBody,
    originalBody: { type: 'link', text: originalUrl, sourceLabel: 'Web article' },
    ingest,
    contentHash,
  });
  return {
    kind: 'source',
    body: nextBody,
    ingest,
    overviewOnly: false,
    skipSourceTruncate: true,
    provenance,
  };
}

function buildPdfResolve(
  body: TransformRequest,
  extractedText: string,
  opts?: { visionFallback?: boolean }
): ResolvedTransformIngest {
  if (opts?.visionFallback) {
    return {
      kind: 'passthrough',
      body: { ...body, type: 'pdf' },
      provenance: buildSourceProvenance({
        body: { ...body, type: 'pdf' },
        originalBody: { type: 'pdf', mimeType: 'application/pdf' },
        ingest: null,
        ingestKind: 'passthrough',
      }),
    };
  }
  const contentHash = 'hash-pdf-e2e';
  const ingest: IngestResult = {
    chunks: [
      {
        id: 'c_pdf_1',
        text: extractedText,
        hash: 'hp',
        loc: { start: 0, end: extractedText.length },
      },
    ],
    metadata: { type: 'pdf', title: 'Documento PDF' },
    rawHash: contentHash,
  };
  const nextBody: TransformRequest = {
    ...body,
    type: 'text',
    text: `[[c_pdf_1]]\n${extractedText}`,
    sourceLabel: 'Documento PDF',
  };
  const provenance = buildSourceProvenance({
    body: nextBody,
    originalBody: { type: 'pdf', mimeType: 'application/pdf' },
    ingest,
    contentHash,
  });
  return {
    kind: 'source',
    body: nextBody,
    ingest,
    overviewOnly: false,
    skipSourceTruncate: true,
    provenance,
  };
}

describe('S04 productive HTTP (registerTransformRoutes)', () => {
  it('JSON understand uses engine and returns understanding IR', async () => {
    const app = mountS04App();
    const body = pastedUnderstandBody();
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send(body);
    expect(res.status).toBe(200);
    const map = res.body as ActionMapData;
    expect(map.understanding?.schemaVersion).toMatch(/^s04/);
    expect(map.layer0?.what).toBeTruthy();
    expect(map.steps.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(map)).toContain('no equivale a inteligencia');
  });

  it('NDJSON emits stage + essential_ready + done; same artifact shape as JSON', async () => {
    const app = mountS04App();
    const body = pastedUnderstandBody();

    const jsonRes = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send(body);
    expect(jsonRes.status).toBe(200);

    const streamRes = await request(app)
      .post(TRANSFORM_HTTP_PATHS.stream)
      .set('Authorization', 'Bearer t')
      .set('Accept', 'application/x-ndjson')
      .send(body);
    expect(streamRes.status).toBe(200);

    const lines = String(streamRes.text)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string; map?: ActionMapData; stageLabel?: string });

    expect(lines.some((e) => e.type === 'stage')).toBe(true);
    expect(lines.some((e) => e.type === 'essential_ready')).toBe(true);
    const done = lines.find((e) => e.type === 'done');
    expect(done?.map?.understanding?.units.length).toBe(
      (jsonRes.body as ActionMapData).understanding?.units.length
    );
    expect(done?.map?.coreIdea).toBe((jsonRes.body as ActionMapData).coreIdea);

    // Consumer parity
    let essentialSeen = false;
    let stageSeen = false;
    let finalMap: ActionMapData | null = null;
    const result = await consumeTransformStream(new Response(streamRes.text), {
      onEssentialReady: () => {
        essentialSeen = true;
      },
      onStage: () => {
        stageSeen = true;
      },
      onDone: (map) => {
        finalMap = map;
      },
      onError: (m) => {
        throw new Error(m);
      },
    });
    expect(result).toBe('done');
    expect(essentialSeen).toBe(true);
    expect(stageSeen).toBe(true);
    expect(finalMap?.understanding?.schemaVersion).toMatch(/^s04/);
  });

  it('apply intent does not enter understand engine', async () => {
    clearUnderstandingCache();
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    let legacyCalled = false;
    const deps: TransformRouteDeps = {
      authenticateOptional: async (req) => {
        req.userId = 'u';
      },
      requireLlmAccess: async () => true,
      enforceProEntitlements: () => true,
      enforceUsageQuota: () => true,
      consumeTransformRateLimit: () => true,
      isCsvTransformRequest: () => false,
      describeBlockedTransformUrl: () => null,
      isCancelled: () => false,
      getClientIp: () => '127.0.0.1',
      getAccessToken: () => 't',
      getSupabaseConfig: () => ({}),
      persistFnOverride: async () => ({ ok: true as const }),
      generateAskAnswer: async () => 'ask',
      buildTransformContext: async () => ({
        contents: 'x',
        modelChain: ['m'],
        maxOutputTokens: 1,
        resolvedDepth: 'estandar',
      }),
      generateTransformJson: async () => {
        legacyCalled = true;
        return { rawText: '{}', usedModel: 'legacy' };
      },
      finalizeMapJson: async () =>
        ({
          title: 'Apply legacy',
          coreIdea: 'Legacy apply path kept intact for non-understand intents.',
          coreSupport: 'Soporte',
          intent: 'apply',
          tldr: [
            { title: 'A', desc: 'a' },
            { title: 'B', desc: 'b' },
            { title: 'C', desc: 'c' },
          ],
          steps: [
            {
              id: 's1',
              shortNav: 'Uno',
              title: 'Paso apply uno',
              time: '~3 min',
              content: [{ type: 'prose', text: 'x' }],
              selfCheck: '?',
            },
            {
              id: 's2',
              shortNav: 'Dos',
              title: 'Paso apply dos',
              time: '~3 min',
              content: [{ type: 'prose', text: 'x' }],
              selfCheck: '?',
            },
            {
              id: 's3',
              shortNav: 'Tres',
              title: 'Paso apply tres',
              time: '~3 min',
              content: [{ type: 'prose', text: 'x' }],
              selfCheck: '?',
            },
          ],
        }) as ActionMapData,
      attachCitations: (m) => m,
      runUnderstandEngine: createRunUnderstandEngineDep({
        generateJson: async () => {
          throw new Error('understand engine must not run for apply');
        },
      }),
      runTransformStream: async () => undefined,
      createJwtPersistFn: () => async () => ({ ok: true as const }),
      describeSecureFetchError: () => null,
      describeGeminiError: () => ({ statusCode: 500, errorMessage: 'e' }),
      isIngestError: (err): err is { httpStatus: number; message: string; code?: string } =>
        Boolean(err && typeof err === 'object' && 'httpStatus' in err),
    };
    registerTransformRoutes(app, deps);

    const ids = createPastedTextOperationIds();
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send({
        type: 'text',
        text: SOURCE,
        textMode: 'source',
        intent: 'apply',
        mapId: ids.mapId,
        sourceId: ids.sourceId,
        sourceVersionId: ids.sourceVersionId,
        sourceRequestId: ids.sourceRequestId,
      } satisfies TransformRequest);

    expect(res.status).toBe(200);
    expect(legacyCalled).toBe(true);
    expect(res.body.understanding).toBeUndefined();
  });

  it('cancelled request returns 499 and does not consolidate', async () => {
    const app = mountS04App({ cancelled: true });
    const ids = createPastedTextOperationIds();
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send({
        type: 'text',
        text: SOURCE,
        textMode: 'source',
        intent: 'understand',
        mapId: ids.mapId,
        sourceId: ids.sourceId,
        sourceVersionId: ids.sourceVersionId,
        sourceRequestId: ids.sourceRequestId,
      } satisfies TransformRequest);
    expect(res.status).toBe(499);
  });
});

describe('S04 HTTP routing spies (legacy vs engine)', () => {
  it('YouTube understand → engine NOT called; legacy JSON called once; kind youtube + URL', async () => {
    const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const { app, spies } = mountSpyApp({
      resolveIngest: async ({ body }) => ({
        kind: 'passthrough' as const,
        body,
        provenance: buildSourceProvenance({
          body,
          originalBody: { type: 'youtube', text: ytUrl },
          ingest: null,
          ingestKind: 'passthrough',
        }),
      }),
    });
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send({
        type: 'youtube',
        text: ytUrl,
        intent: 'understand',
        depth: 'estandar',
      } satisfies TransformRequest);
    expect(res.status).toBe(200);
    expect(spies.understandCalls).toBe(0);
    expect(spies.legacyJsonCalls).toBe(1);
    expect(spies.legacyStreamCalls).toBe(0);
    expect((res.body as ActionMapData).understanding).toBeUndefined();
    expect((res.body as ActionMapData).sourceMetadata?.kind).toBe('youtube');
    expect((res.body as ActionMapData).sourceMetadata?.url).toBe(ytUrl);
  });

  it('passthrough multimodal → S04 not called; legacy called once', async () => {
    const { app, spies } = mountSpyApp({
      resolveIngest: async ({ body }) => ({
        kind: 'passthrough' as const,
        body: { ...body, type: 'image' },
      }),
    });
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send({
        type: 'image',
        text: 'data:image/png;base64,iVBORw0KGgo=',
        intent: 'understand',
        depth: 'estandar',
      } satisfies TransformRequest);
    expect(res.status).toBe(200);
    expect(spies.understandCalls).toBe(0);
    expect(spies.legacyJsonCalls + spies.legacyStreamCalls).toBe(1);
    expect((res.body as ActionMapData).understanding).toBeUndefined();
  });

  it('pasted text source → S04 called once; legacy not called; kind text', async () => {
    const body = pastedUnderstandBody();
    const { app, spies } = mountSpyApp({
      resolveIngest: async ({ body: reqBody }) =>
        buildPastedResolve(reqBody, 'hash-spy-paste'),
    });
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send(body);
    expect(res.status).toBe(200);
    expect(spies.understandCalls).toBe(1);
    expect(spies.legacyJsonCalls).toBe(0);
    expect(spies.legacyStreamCalls).toBe(0);
    expect((res.body as ActionMapData).understanding?.schemaVersion).toMatch(/^s04/);
    expect((res.body as ActionMapData).sourceMetadata?.kind).toBe('text');
  });

  it('web extracted → S04 once; kind link; original URL preserved', async () => {
    const originalUrl = 'https://example.com/memoria-trabajo';
    const { app, spies } = mountSpyApp({
      resolveIngest: async ({ body: reqBody }) =>
        buildWebResolve(reqBody, originalUrl, SOURCE),
    });
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send({
        type: 'link',
        text: originalUrl,
        intent: 'understand',
        depth: 'estandar',
      } satisfies TransformRequest);
    expect(res.status).toBe(200);
    expect(spies.understandCalls).toBe(1);
    expect(spies.legacyJsonCalls).toBe(0);
    const map = res.body as ActionMapData;
    expect(map.sourceMetadata?.kind).toBe('link');
    expect(map.sourceMetadata?.url).toBe(originalUrl);
    expect(map.sourceMetadata?.url).not.toContain('chunk');
    expect(map.understanding?.schemaVersion).toMatch(/^s04/);
  });

  it('PDF extracted → S04 once; kind pdf', async () => {
    const { app, spies } = mountSpyApp({
      resolveIngest: async ({ body: reqBody }) => buildPdfResolve(reqBody, SOURCE),
    });
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send({
        type: 'pdf',
        text: '',
        fileData: 'JVBERi0x',
        mimeType: 'application/pdf',
        intent: 'understand',
        depth: 'estandar',
      } satisfies TransformRequest);
    expect(res.status).toBe(200);
    expect(spies.understandCalls).toBe(1);
    expect(spies.legacyJsonCalls).toBe(0);
    expect((res.body as ActionMapData).sourceMetadata?.kind).toBe('pdf');
    expect((res.body as ActionMapData).understanding?.schemaVersion).toMatch(/^s04/);
  });

  it('PDF fallback → legacy once; zero S04 calls', async () => {
    const { app, spies } = mountSpyApp({
      resolveIngest: async ({ body: reqBody }) =>
        buildPdfResolve(reqBody, SOURCE, { visionFallback: true }),
    });
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send({
        type: 'pdf',
        text: '',
        fileData: 'JVBERi0x',
        mimeType: 'application/pdf',
        intent: 'understand',
        depth: 'estandar',
      } satisfies TransformRequest);
    expect(res.status).toBe(200);
    expect(spies.understandCalls).toBe(0);
    expect(spies.legacyJsonCalls).toBe(1);
    expect((res.body as ActionMapData).understanding).toBeUndefined();
  });

  it('pasted understand JSON/NDJSON parity (engine path)', async () => {
    const body = pastedUnderstandBody();
    const { app, spies } = mountSpyApp({
      resolveIngest: async ({ body: reqBody }) =>
        buildPastedResolve(reqBody, 'hash-spy-parity'),
    });

    const jsonRes = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .set('Authorization', 'Bearer t')
      .send(body);
    expect(jsonRes.status).toBe(200);
    expect(spies.understandCalls).toBe(1);

    const streamRes = await request(app)
      .post(TRANSFORM_HTTP_PATHS.stream)
      .set('Authorization', 'Bearer t')
      .set('Accept', 'application/x-ndjson')
      .send(body);
    expect(streamRes.status).toBe(200);
    expect(spies.understandCalls).toBe(2);

    const lines = String(streamRes.text)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string; map?: ActionMapData });
    const done = lines.find((e) => e.type === 'done');
    expect(done?.map?.understanding?.units.length).toBe(
      (jsonRes.body as ActionMapData).understanding?.units.length
    );
    expect(done?.map?.coreIdea).toBe((jsonRes.body as ActionMapData).coreIdea);
    expect(spies.legacyJsonCalls).toBe(0);
    expect(spies.legacyStreamCalls).toBe(0);
  });
});
