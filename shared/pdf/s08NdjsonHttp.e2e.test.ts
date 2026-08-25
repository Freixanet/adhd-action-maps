/**
 * S08 NDJSON + fetchTransformWithProgress — coverage on done events.
 */

import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import {
  registerTransformRoutes,
  TRANSFORM_HTTP_PATHS,
  type TransformRouteDeps,
} from '../../server/src/routes/registerTransformRoutes';
import { createPastedTextOperationIds } from '../pastedText';
import { fixtureTextualPdf, fixtureMixedTextAndImagePdf } from './fixtures';
import { fetchTransformWithProgress } from '../transformStream';
import type { ActionMapData, TransformRequest } from '../contracts';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from '../evidence/versions';
import type { PersistPdfFn } from '../../server/src/ingestors/pdfOrchestration';
import type { Server } from 'node:http';

const mapFixture = {
  title: 'PDF NDJSON',
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
  understanding: {
    schemaVersion: 's04.understanding.v1',
    status: 'complete',
    nuclear: { claim: 'La atención sostenida mejora con bloques breves.' },
  },
} as unknown as ActionMapData;

function baseDeps(overrides: Partial<TransformRouteDeps> = {}): TransformRouteDeps {
  const persistPdfFn: PersistPdfFn = async (args) => ({
    ok: true,
    storagePath: `${args.ids.sourceId}/doc.pdf`,
  });
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
    runUnderstandEngine: async ({ ingest }) => ({
      ok: true,
      map: {
        ...mapFixture,
        citedChunks: ingest?.chunks ?? [],
        chunkIdManifest: ingest?.chunks?.map((c) => c.id) ?? [],
      },
      model: 'fake-s04',
    }),
    runEvidenceEngine: async ({ map, ingest, pastedComplete, partialExtraction }) => {
      const isComplete =
        pastedComplete === true && !partialExtraction
          ? true
          : partialExtraction
            ? false
            : null;
      return {
        ok: true,
        map: {
          ...map,
          chunkIdManifest: ingest?.chunks?.map((c) => c.id) ?? map.chunkIdManifest,
          citedChunks: ingest?.chunks ?? map.citedChunks,
          evidence: {
            schemaVersion: EVIDENCE_SCHEMA_VERSION,
            promptVersion: EVIDENCE_PROMPT_VERSION,
            verifierVersion: EVIDENCE_VERIFIER_VERSION,
            compilerVersion: EVIDENCE_COMPILER_VERSION,
            modelVersion: 'fake',
            modelRoute: 'test',
            status: 'complete',
            claims: [],
            links: [],
            assessments: [],
            evidenceCoverage: {
              criticalTotal: 0,
              verified: 0,
              qualified: 0,
              contradicted: 0,
              degraded: 0,
              uncertain: 0,
              unanchored: 0,
              inference: 0,
              summaryLines: ['sin claims en fixture'],
            },
            sourceCoverage: {
              textual: null,
              extractionConfidence: null,
              isComplete,
              limitations: [],
            },
          },
        } as ActionMapData,
        cacheHit: false,
      };
    },
    runApplicationEngine: async ({ map }) => ({
      ok: true,
      map: { ...map, intent: 'apply', application: { status: 'complete' } } as ActionMapData,
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
  };
}

async function listen(app: express.Express): Promise<{ server: Server; base: string }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  return { server, base: `http://127.0.0.1:${addr.port}` };
}

describe('S08 NDJSON fetchTransformWithProgress', () => {
  it('done event carries structural PDF coverage via productive stream route', async () => {
    const deps = baseDeps();
    const app = express();
    app.use(express.json({ limit: '28mb' }));
    registerTransformRoutes(app, deps);
    const { server, base } = await listen(app);
    const ids = createPastedTextOperationIds();
    const buf = await fixtureTextualPdf();
    const body: TransformRequest = {
      type: 'pdf',
      fileData: buf.toString('base64'),
      mimeType: 'application/pdf',
      sourceLabel: 'ndjson.pdf',
      intent: 'understand',
      mapId: ids.mapId,
      sourceId: ids.sourceId,
      sourceVersionId: ids.sourceVersionId,
      sourceRequestId: ids.sourceRequestId,
    };
    const onDone = vi.fn();
    try {
      await fetchTransformWithProgress({
        streamUrl: `${base}${TRANSFORM_HTTP_PATHS.stream}`,
        fallbackUrl: `${base}${TRANSFORM_HTTP_PATHS.transform}`,
        body,
        handlers: {
          onDone: (map, _model, meta) => {
            onDone(map, meta);
          },
          onError: (message) => {
            throw new Error(message);
          },
        },
      });
      expect(onDone).toHaveBeenCalled();
      const [map, meta] = onDone.mock.calls[0]!;
      expect(meta?.kind).toBe('pdf');
      expect(map.sourceMetadata?.kind).toBe('pdf');
      expect(map.coverage?.notes?.some((n: { label?: string }) => n.label === 'Páginas')).toBe(
        true
      );
      expect(map.evidence?.sourceCoverage?.isComplete).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    }
  });

  it('partial PDF → evidence isComplete false', async () => {
    const deps = baseDeps();
    const app = express();
    app.use(express.json({ limit: '28mb' }));
    registerTransformRoutes(app, deps);
    const { server, base } = await listen(app);
    const ids = createPastedTextOperationIds();
    const buf = await fixtureMixedTextAndImagePdf();
    try {
      const onDone = vi.fn();
      await fetchTransformWithProgress({
        streamUrl: `${base}${TRANSFORM_HTTP_PATHS.stream}`,
        fallbackUrl: `${base}${TRANSFORM_HTTP_PATHS.transform}`,
        body: {
          type: 'pdf',
          fileData: buf.toString('base64'),
          mimeType: 'application/pdf',
          sourceLabel: 'partial.pdf',
          intent: 'understand',
          mapId: ids.mapId,
          sourceId: ids.sourceId,
          sourceVersionId: ids.sourceVersionId,
          sourceRequestId: ids.sourceRequestId,
        },
        handlers: {
          onDone: (map) => onDone(map),
          onError: (message) => {
            throw new Error(message);
          },
        },
      });
      const map = onDone.mock.calls[0]![0] as ActionMapData;
      expect(map.sourceMetadata?.kind).toBe('pdf');
      expect(map.evidence?.sourceCoverage?.isComplete).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    }
  });

  it('Aplicar NDJSON done also carries structural PDF coverage', async () => {
    const deps = baseDeps();
    const app = express();
    app.use(express.json({ limit: '28mb' }));
    registerTransformRoutes(app, deps);
    const { server, base } = await listen(app);
    const ids = createPastedTextOperationIds();
    const buf = await fixtureTextualPdf();
    try {
      const onDone = vi.fn();
      await fetchTransformWithProgress({
        streamUrl: `${base}${TRANSFORM_HTTP_PATHS.stream}`,
        fallbackUrl: `${base}${TRANSFORM_HTTP_PATHS.transform}`,
        body: {
          type: 'pdf',
          fileData: buf.toString('base64'),
          mimeType: 'application/pdf',
          sourceLabel: 'apply-ndjson.pdf',
          intent: 'apply',
          mapId: ids.mapId,
          sourceId: ids.sourceId,
          sourceVersionId: ids.sourceVersionId,
          sourceRequestId: ids.sourceRequestId,
        },
        handlers: {
          onDone: (map, _model, meta) => onDone(map, meta),
          onError: (message) => {
            throw new Error(message);
          },
        },
      });
      expect(onDone).toHaveBeenCalled();
      const [map, meta] = onDone.mock.calls[0]!;
      expect(meta?.kind).toBe('pdf');
      expect(map.sourceMetadata?.kind).toBe('pdf');
      expect(map.coverage?.notes?.some((n: { label?: string }) => n.label === 'Páginas')).toBe(
        true
      );
      expect(map.intent === 'apply' || map.application).toBeTruthy();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    }
  });
});
