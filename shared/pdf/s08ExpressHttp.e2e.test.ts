/**
 * S08 HTTP E2E — registerTransformRoutes productive handlers.
 * Model/persist deps may be fakes; route handlers are real.
 */

import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  registerTransformRoutes,
  TRANSFORM_HTTP_PATHS,
  type TransformRouteDeps,
} from '../../server/src/routes/registerTransformRoutes';
import { createPastedTextOperationIds } from '../pastedText';
import { fixtureTextualPdf, fixtureImageOnlyPdf } from './fixtures';
import { consumeTransformStream } from '../transformStream';
import type { ActionMapData, TransformRequest } from '../contracts';
import { applyPdfCoverageToMap } from './applyCoverageToMap';
import type { PersistPdfFn } from '../../server/src/ingestors/pdfOrchestration';

const mapFixture = {
  title: 'PDF E2E',
  coreIdea: 'La atención sostenida mejora con bloques breves.',
  coreSupport: 'La fuente propone un bloque de doce minutos.',
  intent: 'understand',
  tldr: [
    { title: 'Uno', desc: 'Primero.' },
    { title: 'Dos', desc: 'Segundo.' },
    { title: 'Tres', desc: 'Tercero.' },
  ],
  steps: [
    {
      id: 'step-1',
      shortNav: 'Paso 1',
      title: 'Paso 1',
      time: '~3 min',
      content: [{ type: 'prose', text: 'La atención sostenida mejora con bloques breves.' }],
      selfCheck: '?',
    },
  ],
  sourceMetadata: { kind: 'text', label: 'Fuente', detected: [], limitations: [] },
  coverage: { summary: '', notes: [] },
  completionCard: { title: 'Hecho', summary: 'ok', takeaways: ['a'] },
  // Required so finalizeUnderstandMap runs S05 (skips evidence when absent).
  understanding: {
    schemaVersion: 's04.understanding.v1',
    status: 'complete',
    nuclear: { claim: 'La atención sostenida mejora con bloques breves.' },
  },
} as unknown as ActionMapData;

function baseDeps(overrides: Partial<TransformRouteDeps> = {}): TransformRouteDeps {
  const persistCalls: unknown[] = [];
  const persistPdfFn: PersistPdfFn = async (args) => {
    persistCalls.push(args);
    return { ok: true, storagePath: `${args.ids.sourceId}/doc.pdf` };
  };
  return {
    authenticateOptional: async (req) => {
      (req as { userId?: string }).userId = 'user-a';
    },
    requireLlmAccess: async () => true,
    enforceProEntitlements: () => true,
    enforceUsageQuota: () => true,
    consumeTransformRateLimit: () => true,
    isCsvTransformRequest: () => false,
    describeBlockedTransformUrl: () => null,
    isCancelled: () => false,
    getClientIp: () => '127.0.0.1',
    getAccessToken: () => 'token-a',
    getSupabaseConfig: () => ({
      url: 'http://127.0.0.1:54321',
      anonKey: 'anon',
    }),
    persistPdfFnOverride: persistPdfFn,
    generateAskAnswer: async () => 'ask',
    buildTransformContext: async () =>
      ({ error: 'legacy unused', status: 500 }) as never,
    generateTransformJson: async () => ({ rawText: '{}', usedModel: 'fake' }),
    finalizeMapJson: async () => mapFixture,
    attachCitations: (map, ingest) => ({
      ...map,
      citedChunks: ingest?.chunks ?? [],
      chunkIdManifest: ingest?.chunks?.map((c) => c.id) ?? [],
    }),
    runUnderstandEngine: async ({ ingest, body }) => {
      const base = {
        ...mapFixture,
        citedChunks: ingest?.chunks ?? [],
        chunkIdManifest: ingest?.chunks?.map((c) => c.id) ?? [],
      };
      return { ok: true, map: base, model: 'fake-s04' };
    },
    runEvidenceEngine: async ({ map, ingest }) => {
      const chunk = ingest?.chunks?.[0];
      const evidence = {
        schemaVersion: 's05.evidence.v1',
        promptVersion: 's05.prompt.v1',
        verifierVersion: 's05.verify.v1',
        compilerVersion: 's05.compile.v1',
        modelVersion: 'fake',
        modelRoute: 'test',
        status: 'complete' as const,
        claims: [
          {
            id: 'cl1',
            text: map.coreIdea,
            claimType: 'factual',
            criticality: 'critical',
            epistemicStatus: 'supported',
            presentationStatus: 'verified',
            evidenceLinkIds: chunk ? ['el1'] : [],
            abstentionCodes: [],
            slotKey: 'nuclear',
          },
        ],
        links: chunk
          ? [
              {
                id: 'el1',
                claimId: 'cl1',
                chunkId: chunk.id,
                relation: 'supports',
                excerpt: chunk.text.slice(0, 40),
              },
            ]
          : [],
        assessments: [
          {
            claimId: 'cl1',
            verifierStatus: 'verified',
            epistemicStatus: 'supported',
            checkCodes: [],
            abstentionCodes: [],
            allowedChunkIdsUsed: chunk ? [chunk.id] : [],
          },
        ],
        evidenceCoverage: {
          criticalTotal: 1,
          criticalResolved: 1,
          criticalPending: 0,
          status: 'complete',
        },
        sourceCoverage: { status: 'complete', notes: [] },
      };
      return {
        ok: true,
        map: { ...map, evidence } as unknown as ActionMapData,
        cacheHit: false,
      };
    },
    runApplicationEngine: async ({ map }) => ({
      ok: true,
      map: {
        ...map,
        intent: 'apply',
        application: {
          schemaVersion: 's06.application.v1',
          status: 'complete',
          plan: { id: 'plan-1', status: 'ready' },
        },
      } as ActionMapData,
      cacheHit: false,
      model: 'fake-s06',
    }),
    runTransformStream: async () => undefined,
    createJwtPersistFn: () => async () => ({ ok: true }),
    createJwtPersistPdfFn: () => persistPdfFn,
    describeSecureFetchError: () => null,
    describeGeminiError: () => ({ statusCode: 500, errorMessage: 'gemini' }),
    isIngestError: (err): err is { httpStatus: number; message: string } => false,
    ...overrides,
    // expose for assertions
    ...( { persistCalls } as object),
  } as TransformRouteDeps & { persistCalls: unknown[] };
}

describe('S08 Express HTTP PDF', () => {
  it('PDF → ingest → S04 → S05 with sourceMeta + coverage (productive routes)', async () => {
    const deps = baseDeps();
    const app = express();
    app.use(express.json({ limit: '28mb' }));
    registerTransformRoutes(app, deps);
    const ids = createPastedTextOperationIds();
    const buf = await fixtureTextualPdf();
    const body: TransformRequest = {
      type: 'pdf',
      fileData: buf.toString('base64'),
      mimeType: 'application/pdf',
      sourceLabel: 'e2e.pdf',
      intent: 'understand',
      depth: 'estandar',
      mapId: ids.mapId,
      sourceId: ids.sourceId,
      sourceVersionId: ids.sourceVersionId,
      sourceRequestId: ids.sourceRequestId,
    };
    const res = await request(app).post(TRANSFORM_HTTP_PATHS.transform).send(body);
    expect(res.status).toBe(200);
    expect(res.body.sourceMeta?.kind).toBe('pdf');
    expect(res.body.sourceMeta?.sourceVersionId).toBe(ids.sourceVersionId);
    expect(res.body.sourceMeta?.coverageStatus).toMatch(/complete|partial/);
    expect(res.body.sourceMetadata?.kind).toBe('pdf');
    expect(res.headers['x-nucleo-source-version-id']).toBe(ids.sourceVersionId);
    expect(res.body.citedChunks?.length).toBeGreaterThan(0);
    expect(res.body.citedChunks[0].loc.page).toBe(1);
  });

  it('image-only PDF returns typed PDF_SCANNED (no S04)', async () => {
    const deps = baseDeps();
    const app = express();
    app.use(express.json({ limit: '28mb' }));
    registerTransformRoutes(app, deps);
    const buf = await fixtureImageOnlyPdf();
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .send({
        type: 'pdf',
        fileData: buf.toString('base64'),
        mimeType: 'application/pdf',
        sourceLabel: 'scan.pdf',
        intent: 'understand',
      } satisfies TransformRequest);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PDF_SCANNED');
  });

  it('cancel during extract returns 499', async () => {
    const deps = baseDeps({
      isCancelled: () => true,
    });
    const app = express();
    app.use(express.json({ limit: '28mb' }));
    registerTransformRoutes(app, deps);
    const buf = await fixtureTextualPdf();
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .send({
        type: 'pdf',
        fileData: buf.toString('base64'),
        mimeType: 'application/pdf',
        sourceLabel: 'c.pdf',
        intent: 'understand',
      } satisfies TransformRequest);
    expect(res.status).toBe(499);
    expect(res.body.code).toMatch(/CANCEL/);
    // Must not accept success and cancelled as dual outcomes.
    expect(res.body.ok).not.toBe(true);
    expect(res.body.map).toBeUndefined();
    expect(res.body.pdfPersistRetry).toBeUndefined();
  });
  it('oversized PDF bytes return typed PDF_TOO_LARGE', async () => {
    const deps = baseDeps();
    const app = express();
    app.use(express.json({ limit: '28mb' }));
    registerTransformRoutes(app, deps);
    const { MAX_PDF_BYTES } = await import('./versions');
    const huge = Buffer.alloc(MAX_PDF_BYTES + 1);
    huge.write('%PDF-1.4', 0, 'ascii');
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .send({
        type: 'pdf',
        fileData: huge.toString('base64'),
        mimeType: 'application/pdf',
        sourceLabel: 'big.pdf',
        intent: 'understand',
      } satisfies TransformRequest);
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PDF_TOO_LARGE');
  });

  it('PDF → S06 apply path returns application with sourceMeta', async () => {
    const deps = baseDeps();
    const app = express();
    app.use(express.json({ limit: '28mb' }));
    registerTransformRoutes(app, deps);
    const ids = createPastedTextOperationIds();
    const buf = await fixtureTextualPdf();
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .send({
        type: 'pdf',
        fileData: buf.toString('base64'),
        mimeType: 'application/pdf',
        sourceLabel: 'apply.pdf',
        intent: 'apply',
        mapId: ids.mapId,
        sourceId: ids.sourceId,
        sourceVersionId: ids.sourceVersionId,
        sourceRequestId: ids.sourceRequestId,
      } satisfies TransformRequest);
    expect(res.status).toBe(200);
    expect(res.body.sourceMeta?.kind).toBe('pdf');
    expect(res.body.application || res.body.intent === 'apply').toBeTruthy();
  });

  it('sync_failed returns pdfPersistRetry for persist-only retry', async () => {
    let persistCalls = 0;
    const persistPdfFn: PersistPdfFn = async () => {
      persistCalls += 1;
      return { ok: false, error: 'forced_sync_fail' };
    };
    const deps = baseDeps({ persistPdfFnOverride: persistPdfFn });
    const app = express();
    app.use(express.json({ limit: '28mb' }));
    registerTransformRoutes(app, deps);
    const ids = createPastedTextOperationIds();
    const buf = await fixtureTextualPdf();
    const res = await request(app)
      .post(TRANSFORM_HTTP_PATHS.transform)
      .send({
        type: 'pdf',
        fileData: buf.toString('base64'),
        mimeType: 'application/pdf',
        sourceLabel: 'retry.pdf',
        intent: 'understand',
        mapId: ids.mapId,
        sourceId: ids.sourceId,
        sourceVersionId: ids.sourceVersionId,
        sourceRequestId: ids.sourceRequestId,
      } satisfies TransformRequest);
    expect(res.status).toBe(200);
    expect(res.body.sourceMeta?.persistStatus).toBe('sync_failed');
    expect(res.body.pdfPersistRetry?.segments?.length).toBeGreaterThan(0);
    expect(res.body.pdfPersistRetry?.contentHash).toBe(res.body.sourceMeta.contentHash);
    const afterTransform = persistCalls;

    const persistRes = await request(app)
      .post(TRANSFORM_HTTP_PATHS.persistPdf)
      .send({
        fileData: buf.toString('base64'),
        title: 'retry.pdf',
        mapId: ids.mapId,
        sourceId: ids.sourceId,
        sourceVersionId: ids.sourceVersionId,
        sourceRequestId: ids.sourceRequestId,
        contentHash: res.body.pdfPersistRetry.contentHash,
        extractionDigest: res.body.pdfPersistRetry.extractionDigest,
        pageCount: res.body.pdfPersistRetry.pageCount,
        segments: res.body.pdfPersistRetry.segments,
        coverage: res.body.pdfPersistRetry.coverage,
      });
    // Persist-only route: one more persist call, no re-extract / S04.
    expect(persistCalls).toBe(afterTransform + 1);
    expect(persistRes.status).toBe(200);
    expect(persistRes.body.sourceMeta?.persistStatus).toBe('sync_failed');
  });

  it('applyPdfCoverageToMap is structural (no model note)', () => {
    const covered = applyPdfCoverageToMap(mapFixture, {
      pageCount: 3,
      textualPages: 2,
      emptyPages: 0,
      imageOnlyPages: 1,
      totalExtractedChars: 120,
      status: 'partial',
      affectedPages: [3],
      limitations: ['image_only_pages_present', 'tables_unparsed'],
      summary: 'Texto nativo en 2/3 páginas.',
    });
    expect(covered.sourceMetadata?.kind).toBe('pdf');
    expect(covered.coverage?.notes.some((n) => n.label === 'Páginas')).toBe(true);
    expect(covered.sourceMetadata?.limitations?.some((l) => /imagen/i.test(l))).toBe(true);
  });
});

void consumeTransformStream;
