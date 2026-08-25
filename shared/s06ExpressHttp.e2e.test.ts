/**
 * S06 — productive registrar uses Application Engine for intent=apply
 * (same JSON/NDJSON path; no parallel router).
 */

import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  registerTransformRoutes,
  type TransformRouteDeps,
} from '../server/src/routes/registerTransformRoutes';
import type { ResolvedTransformIngest } from '../server/src/routes/resolveTransformIngest';
import type { ActionMapData } from './contracts';
import type { IngestResult } from './types/chunk';
import {
  APPLICATION_COMPILER_VERSION,
  APPLICATION_MODEL_ROUTE,
  APPLICATION_POLICY_VERSION,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
} from './application/versions';

function baseMap(): ActionMapData {
  return {
    title: 'Base',
    intent: 'understand',
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
    evidence: {
      schemaVersion: 's05.evidence.v1',
      promptVersion: 's05.prompt.v1',
      verifierVersion: 's05.verifier.v1',
      compilerVersion: 's05.compile.v1',
      modelVersion: 't',
      modelRoute: 's05.route.gemini-flash-first',
      status: 'complete',
      claims: [
        {
          id: 'c1',
          text: 'Prueba un bloque de 12 minutos sin notificaciones.',
          claimType: 'recommendation',
          criticality: 'critical',
          epistemicStatus: 'faithful_paraphrase',
          presentationStatus: 'verified',
          evidenceLinkIds: [],
          abstentionCodes: [],
          slotKey: 'c1',
        },
      ],
      links: [],
      assessments: [],
      evidenceCoverage: {
        criticalTotal: 1,
        verified: 1,
        qualified: 0,
        contradicted: 0,
        degraded: 0,
        uncertain: 0,
        unanchored: 0,
        inference: 0,
        summaryLines: [],
      },
      sourceCoverage: {
        textual: null,
        extractionConfidence: null,
        isComplete: true,
        limitations: [],
      },
    },
  };
}

function sourceIngest(text: string, intent: 'apply' | 'study'): ResolvedTransformIngest {
  const ingest: IngestResult = {
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
  };
  return {
    kind: 'source',
    body: { type: 'text', text, intent },
    ingest,
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
      throw new Error('legacy path should not run for apply gate');
    },
    generateTransformJson: async () => {
      throw new Error('legacy path should not run');
    },
    finalizeMapJson: async () => baseMap(),
    attachCitations: (map) => map,
    runUnderstandEngine: async () => ({
      ok: true,
      map: baseMap(),
      model: 'understand-test',
    }),
    runEvidenceEngine: async ({ map }) => ({
      ok: true,
      map: { ...map, evidence: baseMap().evidence },
      cacheHit: false,
    }),
    runApplicationEngine: async ({ map, evidence }) => ({
      ok: true,
      map: {
        ...map,
        intent: 'apply',
        title: 'Aplicar',
        application: {
          schemaVersion: APPLICATION_SCHEMA_VERSION,
          promptVersion: APPLICATION_PROMPT_VERSION,
          compilerVersion: APPLICATION_COMPILER_VERSION,
          policyVersion: APPLICATION_POLICY_VERSION,
          modelVersion: 'app-test',
          modelRoute: APPLICATION_MODEL_ROUTE,
          status: 'complete',
          contentHash: 'h',
          depth: 'estandar',
          contextCanonicalHash: 'c',
          context: { goal: 'cerrar borrador' },
          candidates: [],
          plan: {
            id: 'p1',
            status: 'ready',
            selectedCandidateId: null,
            sourceBasis: evidence.claims[0]?.text || 'fuente',
            inference: 'Inferencia de Núcleo',
            adaptation: 'Adaptación para ti',
            assumptions: [],
            action: {
              id: 'a1',
              verbLedInstruction: 'Prueba un bloque de 12 minutos.',
              whenOrTrigger: 'hoy',
              durationOrScope: '12 min',
              obstacle: 'ruido',
              mitigation: 'auriculares',
              successCriterion: 'Tener un párrafo guardado.',
              stopOrChangeCriterion: 'Para si llega una reunión.',
            },
            reviewTrigger: 'Al terminar',
            reviewQuestions: ['¿Qué salió?'],
            risk: 'low',
            sourceChunkIds: [],
          },
          review: null,
          createdAt: new Date().toISOString(),
        },
      },
      cacheHit: false,
      model: 'app-test',
    }),
    runTransformStream: async () => {
      throw new Error('legacy stream should not run');
    },
    createJwtPersistFn: () => async () => ({ ok: true as const }),
    describeSecureFetchError: () => null,
    describeGeminiError: () => ({ statusCode: 500, errorMessage: 'err' }),
    isIngestError: (err: unknown): err is { httpStatus: number; message: string; code?: string } =>
      false,
    resolveIngest: async () =>
      sourceIngest(
        'Fuente pegada con suficiente contenido para aplicar una idea concreta en la tarde.',
        'apply'
      ),
    ...overrides,
  };
}

describe('S06 Express HTTP apply routing', () => {
  it('JSON /api/transform apply uses application engine (not legacy monolith)', async () => {
    const app = express();
    app.use(express.json());
    const d = deps();
    const spy = vi.fn(d.runApplicationEngine!);
    d.runApplicationEngine = spy;
    registerTransformRoutes(app, d);
    const res = await request(app)
      .post('/api/transform')
      .send({
        type: 'text',
        text: 'Fuente pegada con suficiente contenido para aplicar una idea concreta en la tarde.',
        intent: 'apply',
      });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('apply');
    expect(res.body.application?.plan?.sourceBasis).toBeTruthy();
    expect(res.body.application?.plan?.inference).toBeTruthy();
    expect(res.body.application?.plan?.adaptation).toBeTruthy();
    expect(spy).toHaveBeenCalled();
  });

  it('study does not enter application engine', async () => {
    const app = express();
    app.use(express.json());
    let applyCalled = false;
    const d = deps({
      resolveIngest: async () =>
        sourceIngest(
          'Fuente pegada con suficiente contenido para estudiar el material con calma.',
          'study'
        ),
      runApplicationEngine: async () => {
        applyCalled = true;
        return { ok: false, status: 500, error: 'no', code: 'X' };
      },
      buildTransformContext: async () =>
        ({
          contents: [],
          modelChain: ['m'],
          maxOutputTokens: 100,
          resolvedDepth: 'estandar',
        }) as never,
      generateTransformJson: async () => ({ rawText: '{}', usedModel: 'legacy' }),
      finalizeMapJson: async () => ({ ...baseMap(), intent: 'study' }),
    });
    registerTransformRoutes(app, d);
    const res = await request(app)
      .post('/api/transform')
      .send({
        type: 'text',
        text: 'Fuente pegada con suficiente contenido para estudiar el material con calma.',
        intent: 'study',
      });
    expect(applyCalled).toBe(false);
    expect(res.status).toBe(200);
  });
});
