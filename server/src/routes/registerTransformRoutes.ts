/**
 * Productive S03 transform/persist route registration.
 * Production `server.ts` and HTTP tests MUST call `registerTransformRoutes`
 * with the same handler functions — never a parallel router.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { ActionMapData, TransformRequest } from '../../../shared/contracts';
import type { IngestResult } from '../../../shared/types/chunk';
import type { PastedTextSourceMeta } from '../../../shared/pastedText';
import { parsePastedTextOperationIds } from '../../../shared/pastedText';
import type { PdfSourceMeta } from '../../../shared/pdf/types';
import { applyPdfCoverageToMap } from '../../../shared/pdf/applyCoverageToMap';
import {
  canRunUnderstandingEngine,
  type SourceProvenance,
} from '../../../shared/understanding';
import {
  canRunApplicationEngine,
} from '../../../shared/application';
import { mintGenerationRunId } from '../../../shared/generationResult';
import { streamTrace } from '../../../shared/streamTrace';
import {
  resolveTransformIngest,
  setPastedTextResponseHeaders,
  setPdfSourceResponseHeaders,
  type ResolvedTransformIngest,
} from './resolveTransformIngest';
import {
  orchestratePastedTextPersistOnly,
  type PersistPastedTextFn,
} from '../ingestors/pastedTextOrchestration';
import {
  orchestratePdfPersistOnly,
  type PersistPdfFn,
} from '../ingestors/pdfOrchestration';
import { askResultShell } from './transformIngest';
import {
  createGenerationResultStore,
  type GenerationResultStore,
} from '../generation/generationResultStore';
import {
  emitRunEvent,
  persistAndWriteDone,
  startGlobalStreamHeartbeat,
} from '../generation/streamLifecycle';

/** Canonical paths — single source of truth for production + tests. */
export const TRANSFORM_HTTP_PATHS = {
  transform: '/api/transform',
  stream: '/api/transform/stream',
  result: '/api/transform/result',
  persist: '/api/sources/pasted/persist',
  persistPdf: '/api/sources/pdf/persist',
} as const;

type TransformSourceMeta = PastedTextSourceMeta | PdfSourceMeta;

function resolveGenerationIds(body: TransformRequest): {
  mapId: string;
  generationRunId: string;
} {
  const mapId =
    typeof body.mapId === 'string' && body.mapId.trim()
      ? body.mapId.trim()
      : mintGenerationRunId();
  const generationRunId =
    typeof body.generationRunId === 'string' && body.generationRunId.trim()
      ? body.generationRunId.trim()
      : mintGenerationRunId();
  return { mapId, generationRunId };
}

function resolveMapIntent(body: TransformRequest): TransformRequest['intent'] {
  if (body.intent === 'apply' || body.intent === 'study') return body.intent;
  return 'understand';
}

function contentHashFromMeta(
  sourceMeta: TransformSourceMeta | null,
  body: TransformRequest,
  ingest: IngestResult | null,
  provenance?: SourceProvenance
): string | undefined {
  if (sourceMeta?.contentHash) return sourceMeta.contentHash;
  if (provenance?.contentHash) return provenance.contentHash;
  if (ingest?.rawHash) return ingest.rawHash;
  const maybe = (body as { contentHash?: unknown }).contentHash;
  return typeof maybe === 'string' && maybe.trim() ? maybe.trim() : undefined;
}

function withPdfCoverage(
  map: ActionMapData,
  sourceMeta: TransformSourceMeta | null
): ActionMapData {
  if (!sourceMeta || !('kind' in sourceMeta) || sourceMeta.kind !== 'pdf') return map;
  return applyPdfCoverageToMap(map, {
    pageCount: sourceMeta.pageCount,
    textualPages: sourceMeta.textualPages,
    emptyPages: 0,
    imageOnlyPages: 0,
    totalExtractedChars: 0,
    status: sourceMeta.coverageStatus,
    affectedPages: sourceMeta.affectedPages,
    limitations: sourceMeta.limitations,
    summary: sourceMeta.coverageSummary,
  }, { label: map.sourceMetadata?.label || 'PDF', title: map.sourceMetadata?.title });
}

/** PDF partial → S05 isComplete false; only coverageStatus=complete may be true. */
function pdfEvidenceFlags(meta: TransformSourceMeta | null): {
  pastedComplete: boolean;
  partialExtraction: boolean;
} {
  if (!meta || !('kind' in meta) || meta.kind !== 'pdf') {
    return { pastedComplete: Boolean(meta), partialExtraction: false };
  }
  const complete = meta.coverageStatus === 'complete';
  return {
    pastedComplete: complete,
    partialExtraction: !complete,
  };
}

function understandHttpStatus(code: string): number {
  if (
    code === 'UNDERSTAND_CANCELLED' ||
    code === 'CANCELLED' ||
    code === 'EVIDENCE_CANCELLED' ||
    code === 'APPLICATION_CANCELLED'
  ) {
    return 499;
  }
  if (
    code === 'UNDERSTAND_INSUFFICIENT_SOURCE' ||
    code === 'APPLICATION_INSUFFICIENT_SOURCE' ||
    code === 'APPLICATION_NO_SAFE_BASE'
  ) {
    return 400;
  }
  if (
    code === 'UNDERSTAND_INVALID_BLUEPRINT' ||
    code === 'UNDERSTAND_INVALID_UNITS' ||
    code === 'UNDERSTAND_INVALID_CLOSURE' ||
    code === 'UNDERSTAND_REPAIR_FAILED' ||
    code === 'UNDERSTAND_HALLUCINATED_CHUNK' ||
    code === 'UNDERSTAND_COMPILE_FAILED' ||
    code === 'EVIDENCE_CRITICAL_PENDING' ||
    code === 'EVIDENCE_VERIFY_FAILED' ||
    code === 'APPLICATION_INVALID_PLAN' ||
    code === 'APPLICATION_REPAIR_FAILED' ||
    code === 'APPLICATION_COMPILE_FAILED' ||
    code === 'APPLICATION_GENERIC_ADVICE' ||
    code === 'APPLICATION_HIGH_RISK_ABSTAIN' ||
    code === 'APPLICATION_POLICY_REJECT'
  ) {
    return 422;
  }
  return 500;
}

async function finalizeUnderstandMap(
  deps: TransformRouteDeps,
  args: {
    map: ActionMapData;
    body: TransformRequest;
    ingest: IngestResult | null;
    contentHash?: string;
    userId?: string;
    pastedComplete?: boolean;
    partialExtraction?: boolean;
    webFetchSucceeded?: boolean;
    isCancelled: () => boolean;
    onHeartbeat?: (info: { processed: number; total: number }) => void;
  }
): Promise<
  | { ok: true; map: ActionMapData }
  | { ok: false; status: number; error: string; code: string }
> {
  let map = deps.attachCitations(args.map, args.ingest);
  if (args.ingest?.chunks?.length) {
    map = {
      ...map,
      chunkIdManifest: args.ingest.chunks.map((c) => c.id),
    };
  }

  if (!deps.runEvidenceEngine || !map.understanding) {
    return { ok: true, map };
  }

  if (args.isCancelled()) {
    return {
      ok: false,
      status: 499,
      error: 'Creación cancelada',
      code: 'EVIDENCE_CANCELLED',
    };
  }

  const evidenceResult = await deps.runEvidenceEngine({
    body: args.body,
    map,
    ingest: args.ingest,
    contentHash: args.contentHash,
    userId: args.userId,
    pastedComplete: args.pastedComplete,
    partialExtraction: args.partialExtraction,
    webFetchSucceeded: args.webFetchSucceeded,
    isCancelled: args.isCancelled,
    onHeartbeat: args.onHeartbeat,
  });

  if (evidenceResult.ok === false) {
    return {
      ok: false,
      status: evidenceResult.status || understandHttpStatus(evidenceResult.code),
      error: evidenceResult.error,
      code: evidenceResult.code,
    };
  }

  return { ok: true, map: evidenceResult.map };
}

/**
 * S06 apply pipeline: understand (internal IR) → evidence → application artifact.
 * The visible result is always an S06 map, not Entender disguised as Aplicar.
 */
async function runApplyEnginePipeline(
  deps: TransformRouteDeps,
  args: {
    body: TransformRequest;
    ingest: IngestResult | null;
    contentHash?: string;
    provenance?: SourceProvenance;
    userId?: string;
    pastedComplete?: boolean;
    partialExtraction?: boolean;
    webFetchSucceeded?: boolean;
    isCancelled: () => boolean;
    onStage?: (label: string) => void;
    onEssentialReady?: (partial: ActionMapData) => void;
    onHeartbeat?: (info: { processed: number; total: number }) => void;
  }
): Promise<
  | { ok: true; map: ActionMapData; model: string }
  | { ok: false; status: number; error: string; code: string; essentialPartial?: ActionMapData }
> {
  if (!deps.runUnderstandEngine || !deps.runApplicationEngine) {
    return {
      ok: false,
      status: 500,
      error: 'Motor Aplicar no configurado',
      code: 'APPLICATION_COMPILE_FAILED',
    };
  }

  args.onStage?.('Analizando la fuente…');
  const engineResult = await deps.runUnderstandEngine({
    body: { ...args.body, intent: 'understand' },
    ingest: args.ingest,
    contentHash: args.contentHash,
    provenance: args.provenance,
    userId: args.userId,
    isCancelled: args.isCancelled,
    onStage: args.onStage,
    onEssentialReady: args.onEssentialReady,
  });

  if (args.isCancelled()) {
    return {
      ok: false,
      status: 499,
      error: 'Creación cancelada',
      code: 'APPLICATION_CANCELLED',
    };
  }

  if (engineResult.ok === false) {
    return {
      ok: false,
      status: engineResult.status || understandHttpStatus(engineResult.code),
      error: engineResult.error,
      code: engineResult.code,
      essentialPartial: engineResult.essentialPartial,
    };
  }

  const finalized = await finalizeUnderstandMap(deps, {
    map: engineResult.map,
    body: args.body,
    ingest: args.ingest,
    contentHash: args.contentHash,
    userId: args.userId,
    pastedComplete: args.pastedComplete,
    partialExtraction: args.partialExtraction,
    webFetchSucceeded: args.webFetchSucceeded,
    isCancelled: args.isCancelled,
    onHeartbeat: args.onHeartbeat,
  });

  if (finalized.ok === false) {
    return finalized;
  }

  if (args.isCancelled()) {
    return {
      ok: false,
      status: 499,
      error: 'Creación cancelada',
      code: 'APPLICATION_CANCELLED',
    };
  }

  const evidence = finalized.map.evidence;
  if (!evidence) {
    return {
      ok: false,
      status: 422,
      error: 'No hay evidencia suficiente para aplicar con responsabilidad.',
      code: 'APPLICATION_NO_SAFE_BASE',
    };
  }

  args.onStage?.('Buscando ideas aplicables…');
  const applied = await deps.runApplicationEngine({
    body: { ...args.body, intent: 'apply' },
    map: finalized.map,
    evidence,
    contentHash: args.contentHash || 'local',
    userId: args.userId,
    isCancelled: args.isCancelled,
    onStage: args.onStage,
  });

  if (applied.ok === false) {
    return {
      ok: false,
      status: applied.status || understandHttpStatus(applied.code),
      error: applied.error,
      code: applied.code,
    };
  }

  return { ok: true, map: applied.map, model: applied.model };
}

export type TransformRouteRequest = Request & {
  userId?: string;
  isPro?: boolean;
};

export type TransformContextLike = {
  contents: unknown;
  modelChain: string[];
  maxOutputTokens: number;
  resolvedDepth: string;
  generationMode?: string;
};

export type TransformRouteDeps = {
  authenticateOptional: (req: TransformRouteRequest) => Promise<void>;
  requireLlmAccess: (req: TransformRouteRequest, res: Response) => Promise<boolean>;
  enforceProEntitlements: (
    req: TransformRouteRequest,
    res: Response,
    body: TransformRequest
  ) => boolean;
  enforceUsageQuota: (
    req: TransformRouteRequest,
    res: Response,
    kind: 'transform'
  ) => boolean;
  consumeTransformRateLimit: (ip: string, mapId?: string) => boolean;
  isCsvTransformRequest: (body: TransformRequest) => boolean;
  describeBlockedTransformUrl: (
    body: TransformRequest
  ) => { statusCode: number; errorMessage: string } | null;
  isCancelled: (req: Request, res: Response) => boolean;
  getClientIp: (req: Request) => string;
  getAccessToken: (req: Request) => string | undefined;
  getSupabaseConfig: () => { url?: string; anonKey?: string };

  /** Optional test override; production leaves undefined (JWT persist). */
  persistFnOverride?: PersistPastedTextFn;
  persistPdfFnOverride?: PersistPdfFn;

  resolveIngest?: typeof resolveTransformIngest;

  generateAskAnswer: (
    text: string,
    depth?: TransformRequest['depth'],
    userDisplayName?: string
  ) => Promise<string>;

  buildTransformContext: (
    body: TransformRequest,
    opts: { isPro: boolean; skipSourceTruncate?: boolean }
  ) => Promise<TransformContextLike | { error: string; status: number }>;

  generateTransformJson: (
    context: TransformContextLike,
    req: Request,
    res: Response
  ) => Promise<{ rawText: string; usedModel: string }>;

  finalizeMapJson: (
    rawText: string,
    context: TransformContextLike,
    usedModel: string,
    opts: { req: Request; res: Response }
  ) => Promise<ActionMapData>;

  attachCitations: (map: ActionMapData, ingest: IngestResult | null) => ActionMapData;

  /**
   * S04 Understanding Engine for intent=understand.
   * When set, JSON/stream handlers use this instead of the monolithic map prompt.
   * Apply/study keep the legacy generateTransformJson / runTransformStream path.
   */
  runUnderstandEngine?: (args: {
    body: TransformRequest;
    ingest: IngestResult | null;
    contentHash?: string;
    provenance?: SourceProvenance;
    userId?: string;
    isCancelled: () => boolean;
    onStage?: (label: string) => void;
    onEssentialReady?: (partial: ActionMapData) => void;
  }) => Promise<
    | { ok: true; map: ActionMapData; model: string }
    | { ok: false; status: number; error: string; code: string; essentialPartial?: ActionMapData }
  >;

  /**
   * S05 Evidence Engine — runs after S04 compile + attachCitations.
   * Optional: when absent, maps keep pending refs without verification badges.
   */
  runEvidenceEngine?: (args: {
    body: TransformRequest;
    map: ActionMapData;
    ingest: IngestResult | null;
    contentHash?: string;
    userId?: string;
    pastedComplete?: boolean;
    partialExtraction?: boolean;
    webFetchSucceeded?: boolean;
    isCancelled: () => boolean;
    onHeartbeat?: (info: { processed: number; total: number }) => void;
  }) => Promise<
    | { ok: true; map: ActionMapData; cacheHit: boolean }
    | { ok: false; status: number; error: string; code: string }
  >;

  /**
   * S06 Application Engine — after understanding + evidence for intent=apply.
   * Result is an ApplicationArtifact map, not an Entender map in disguise.
   */
  runApplicationEngine?: (args: {
    body: TransformRequest;
    map: ActionMapData;
    evidence: NonNullable<ActionMapData['evidence']>;
    contentHash: string;
    userId?: string;
    isCancelled: () => boolean;
    onStage?: (label: string) => void;
  }) => Promise<
    | { ok: true; map: ActionMapData; cacheHit: boolean; model: string }
    | { ok: false; status: number; error: string; code: string }
  >;

  runTransformStream: (
    context: TransformContextLike,
    res: Response,
    req: Request,
    ingest: IngestResult | null,
    sourceMeta: TransformSourceMeta | null,
    generation?: {
      mapId: string;
      generationRunId: string;
      resultStore: GenerationResultStore;
      stopHeartbeat?: () => void;
    }
  ) => Promise<void>;

  /** Durable mapId/generationRunId result store (defaults to file-backed). */
  generationResultStore?: GenerationResultStore;

  createJwtPersistFn: (args: {
    accessToken: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
  }) => PersistPastedTextFn;

  createJwtPersistPdfFn?: (args: {
    accessToken: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
  }) => PersistPdfFn;

  describeSecureFetchError: (
    err: unknown
  ) => { statusCode: number; errorMessage: string } | null;
  describeGeminiError: (err: unknown) => { statusCode: number; errorMessage: string };
  isIngestError: (err: unknown) => err is { httpStatus: number; message: string; code?: string };

  logTransformEntryDebug?: (
    body: TransformRequest,
    context: TransformContextLike,
    path: string
  ) => void;
  writeStreamError?: (res: Response, error: string) => void;
};

function resolveIngest(
  deps: TransformRouteDeps,
  args: Parameters<typeof resolveTransformIngest>[0]
): Promise<ResolvedTransformIngest> {
  const fn = deps.resolveIngest ?? resolveTransformIngest;
  return fn({
    ...args,
    persistFn: args.persistFn ?? deps.persistFnOverride,
    persistPdfFn: args.persistPdfFn ?? deps.persistPdfFnOverride,
  });
}

/** Shared handler — registered by production and tests. */
export async function handlePastedPersistRoute(
  deps: TransformRouteDeps,
  req: TransformRouteRequest,
  res: Response
): Promise<void> {
  try {
    await deps.authenticateOptional(req);
    if (!req.userId) {
      res.status(401).json({ error: 'Autenticación requerida', code: 'AUTH_REQUIRED' });
      return;
    }
    const accessToken = deps.getAccessToken(req);
    if (!accessToken) {
      res.status(401).json({ error: 'Autenticación requerida', code: 'AUTH_REQUIRED' });
      return;
    }
    const { url: supabaseUrl, anonKey: supabaseAnonKey } = deps.getSupabaseConfig();
    const persistFn =
      deps.persistFnOverride ??
      (supabaseUrl && supabaseAnonKey
        ? deps.createJwtPersistFn({
            accessToken,
            supabaseUrl,
            supabaseAnonKey,
          })
        : undefined);
    if (!persistFn) {
      res
        .status(503)
        .json({ error: 'Persistencia no disponible', code: 'SOURCE_PERSIST_FAILED' });
      return;
    }

    const body = req.body as {
      text?: string;
      title?: string;
      mapId?: string;
      sourceId?: string;
      sourceVersionId?: string;
      sourceRequestId?: string;
    };
    const ids = parsePastedTextOperationIds({
      mapId: body.mapId,
      sourceId: body.sourceId,
      sourceVersionId: body.sourceVersionId,
      sourceRequestId: body.sourceRequestId,
    });
    if (!ids) {
      res.status(400).json({ error: 'IDs de fuente incompletos', code: 'TEXT_INVALID' });
      return;
    }
    if (typeof body.text !== 'string' || !body.text.trim()) {
      res.status(400).json({ error: 'Texto requerido', code: 'TEXT_EMPTY' });
      return;
    }

    const outcome = await orchestratePastedTextPersistOnly({
      text: body.text,
      ids,
      title: typeof body.title === 'string' ? body.title : undefined,
      isCancelled: () => deps.isCancelled(req, res),
      persistFn,
    });

    if (outcome.ok === false) {
      if (outcome.code === 'CANCELLED') {
        res.status(499).json({ error: outcome.error, code: outcome.code });
        return;
      }
      res.status(outcome.status).json({ error: outcome.error, code: outcome.code });
      return;
    }

    setPastedTextResponseHeaders(res, outcome);
    res.json({ ok: true, sourceMeta: outcome.sourceMeta });
  } catch (err) {
    console.error('[sources/pasted/persist]', err);
    res.status(500).json({ error: 'No se pudo sincronizar la fuente', code: 'SOURCE_PERSIST_FAILED' });
  }
}

/** Shared handler — registered by production and tests. */
export async function handleTransformJsonRoute(
  deps: TransformRouteDeps,
  req: TransformRouteRequest,
  res: Response
): Promise<void> {
  try {
    let body = req.body as TransformRequest;
    if (deps.isCsvTransformRequest(body)) {
      res.status(410).json({ error: 'CSV no soportado en beta' });
      return;
    }
    const blockedUrl = deps.describeBlockedTransformUrl(body);
    if (blockedUrl) {
      res.status(blockedUrl.statusCode).json({ error: blockedUrl.errorMessage });
      return;
    }
    const ip = deps.getClientIp(req);
    const mapId =
      typeof body?.mapId === 'string' ? body.mapId : undefined;
    if (!deps.consumeTransformRateLimit(ip, mapId)) {
      res
        .status(429)
        .json({ error: 'Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.' });
      return;
    }
    if (!(await deps.requireLlmAccess(req, res))) return;
    if (!deps.enforceProEntitlements(req, res, body)) return;
    if (!deps.enforceUsageQuota(req, res, 'transform')) return;

    let transformIngest: IngestResult | null = null;
    let skipSourceTruncate = false;
    let boundSourceMeta: TransformSourceMeta | null = null;
    let boundPdfPersistRetry: import('../../../shared/pdf/types').PdfPersistRetryPayload | null =
      null;
    let ingestKind: 'ask' | 'source' | 'passthrough' | 'none' = 'none';
    let provenance: SourceProvenance | undefined;
    const accessToken = deps.getAccessToken(req);
    const { url: supabaseUrl, anonKey: supabaseAnonKey } = deps.getSupabaseConfig();

    const ingestOutcome = await resolveIngest(deps, {
      body,
      userId: req.userId,
      accessToken: req.userId ? accessToken : undefined,
      supabaseUrl,
      supabaseAnonKey,
      isCancelled: () => deps.isCancelled(req, res),
      persistFn: deps.persistFnOverride,
      persistPdfFn: deps.persistPdfFnOverride,
    });

    if (ingestOutcome.kind === 'cancelled') {
      res.status(499).json({ error: ingestOutcome.error, code: 'CANCELLED' });
      return;
    }
    if (ingestOutcome.kind === 'error') {
      res.status(ingestOutcome.status).json({
        error: ingestOutcome.error,
        code: ingestOutcome.code,
      });
      return;
    }
    if (ingestOutcome.kind === 'ask') {
      ingestKind = 'ask';
      const answer = await deps.generateAskAnswer(
        body.text || '',
        body.depth,
        body.userDisplayName
      );
      res.json(askResultShell(answer));
      return;
    }
    if (ingestOutcome.kind === 'passthrough') {
      ingestKind = 'passthrough';
      body = ingestOutcome.body;
      provenance = ingestOutcome.provenance;
    }
    if (ingestOutcome.kind === 'source') {
      ingestKind = 'source';
      body = ingestOutcome.body;
      transformIngest = ingestOutcome.ingest;
      skipSourceTruncate = ingestOutcome.skipSourceTruncate;
      provenance = ingestOutcome.provenance;
      if (ingestOutcome.pasted) {
        setPastedTextResponseHeaders(res, ingestOutcome.pasted);
        boundSourceMeta = ingestOutcome.pasted.sourceMeta;
      }
      if (ingestOutcome.pdf) {
        if (!res.headersSent) {
          setPdfSourceResponseHeaders(res, ingestOutcome.pdf);
        }
        boundSourceMeta = ingestOutcome.pdf.sourceMeta;
        boundPdfPersistRetry = ingestOutcome.pdf.persistRetry ?? null;
      }
      if (ingestOutcome.overviewOnly && ingestOutcome.ingest.chapters) {
        res.setHeader('X-Nucleo-Overview', '1');
        res.setHeader(
          'X-Nucleo-Chapter-Count',
          String(ingestOutcome.ingest.chapters.length)
        );
      }
    }

    if (deps.isCancelled(req, res)) {
      res.status(499).json({ error: 'Creación cancelada', code: 'CANCELLED' });
      return;
    }

    const intent = resolveMapIntent(body);
    const applyGate = canRunApplicationEngine({
      intent,
      body,
      ingestKind,
      ingest: transformIngest,
    });
    const understandGate = canRunUnderstandingEngine({
      intent,
      body,
      ingestKind,
      ingest: transformIngest,
    });

    // S06: Aplicar on extracted canonical text → understand+evidence internally, ApplicationArtifact out.
    if (applyGate.run && deps.runApplicationEngine && deps.runUnderstandEngine) {
      const contentHash = contentHashFromMeta(
        boundSourceMeta,
        body,
        transformIngest,
        provenance
      );
      const applied = await runApplyEnginePipeline(deps, {
        body,
        ingest: transformIngest,
        contentHash,
        provenance,
        userId: req.userId,
        ...pdfEvidenceFlags(boundSourceMeta),
        webFetchSucceeded: provenance?.extractionKind === 'web_fetch',
        isCancelled: () => deps.isCancelled(req, res),
      });

      if (deps.isCancelled(req, res)) {
        res.status(499).json({ error: 'Creación cancelada', code: 'CANCELLED' });
        return;
      }

      if (applied.ok === false) {
        res.status(applied.status || understandHttpStatus(applied.code)).json({
          error: applied.error,
          code: applied.code,
          ...(applied.essentialPartial
            ? { essentialPartial: applied.essentialPartial }
            : {}),
        });
        return;
      }

      res.setHeader('X-Gemini-Model-Used', applied.model);
      res.json(
        boundSourceMeta
          ? {
              ...withPdfCoverage(applied.map, boundSourceMeta),
              sourceMeta: boundSourceMeta,
              ...(boundPdfPersistRetry ? { pdfPersistRetry: boundPdfPersistRetry } : {}),
            }
          : applied.map
      );
      return;
    }

    // S04: only when we have real extracted canonical text.
    if (understandGate.run && deps.runUnderstandEngine) {
      const engineResult = await deps.runUnderstandEngine({
        body: { ...body, intent: 'understand' },
        ingest: transformIngest,
        contentHash: contentHashFromMeta(
          boundSourceMeta,
          body,
          transformIngest,
          provenance
        ),
        provenance,
        userId: req.userId,
        isCancelled: () => deps.isCancelled(req, res),
      });

      if (deps.isCancelled(req, res)) {
        res.status(499).json({ error: 'Creación cancelada', code: 'CANCELLED' });
        return;
      }

      if (engineResult.ok === false) {
        res.status(engineResult.status || understandHttpStatus(engineResult.code)).json({
          error: engineResult.error,
          code: engineResult.code,
          ...(engineResult.essentialPartial
            ? { essentialPartial: engineResult.essentialPartial }
            : {}),
        });
        return;
      }

      res.setHeader('X-Gemini-Model-Used', engineResult.model);
      const contentHash = contentHashFromMeta(
        boundSourceMeta,
        body,
        transformIngest,
        provenance
      );
      const finalized = await finalizeUnderstandMap(deps, {
        map: engineResult.map,
        body,
        ingest: transformIngest,
        contentHash,
        userId: req.userId,
        ...pdfEvidenceFlags(boundSourceMeta),
        webFetchSucceeded: provenance?.extractionKind === 'web_fetch',
        isCancelled: () => deps.isCancelled(req, res),
      });
      if (finalized.ok === false) {
        res.status(finalized.status).json({
          error: finalized.error,
          code: finalized.code,
        });
        return;
      }
      if (deps.isCancelled(req, res)) {
        res.status(499).json({ error: 'Creación cancelada', code: 'CANCELLED' });
        return;
      }
      res.json(
        boundSourceMeta
          ? {
              ...withPdfCoverage(finalized.map, boundSourceMeta),
              sourceMeta: boundSourceMeta,
              ...(boundPdfPersistRetry ? { pdfPersistRetry: boundPdfPersistRetry } : {}),
            }
          : finalized.map
      );
      return;
    }

    const contextResult = await deps.buildTransformContext(body, {
      isPro: Boolean(req.isPro),
      skipSourceTruncate,
    });
    if ('error' in contextResult) {
      res.status(contextResult.status).json({ error: contextResult.error });
      return;
    }

    deps.logTransformEntryDebug?.(body, contextResult, TRANSFORM_HTTP_PATHS.transform);

    if (deps.isCancelled(req, res)) {
      res.status(499).json({ error: 'Creación cancelada', code: 'CANCELLED' });
      return;
    }

    const { rawText, usedModel } = await deps.generateTransformJson(
      contextResult,
      req,
      res
    );

    if (deps.isCancelled(req, res)) {
      res.status(499).json({ error: 'Creación cancelada', code: 'CANCELLED' });
      return;
    }

    res.setHeader('X-Gemini-Model-Used', usedModel);

    const normalized = deps.attachCitations(
      await deps.finalizeMapJson(rawText, contextResult, usedModel, { req, res }),
      transformIngest
    );
    if (deps.isCancelled(req, res)) {
      res.status(499).json({ error: 'Creación cancelada', code: 'CANCELLED' });
      return;
    }
    res.json(
      boundSourceMeta
        ? {
            ...withPdfCoverage(normalized, boundSourceMeta),
            sourceMeta: boundSourceMeta,
            ...(boundPdfPersistRetry ? { pdfPersistRetry: boundPdfPersistRetry } : {}),
          }
        : normalized
    );
  } catch (err: unknown) {
    console.error(err);
    if (deps.isIngestError(err)) {
      res.status(err.httpStatus).json({ error: err.message, code: err.code });
      return;
    }
    const secureFetchError = deps.describeSecureFetchError(err);
    if (secureFetchError) {
      res
        .status(secureFetchError.statusCode)
        .json({ error: secureFetchError.errorMessage });
      return;
    }
    const { statusCode, errorMessage } = deps.describeGeminiError(err);
    res.status(statusCode).json({ error: errorMessage });
  }
}

/** Shared handler — registered by production and tests. */
export async function handleTransformStreamRoute(
  deps: TransformRouteDeps,
  req: TransformRouteRequest,
  res: Response
): Promise<void> {
  let generationIds: { mapId: string; generationRunId: string } | null = null;
  let resultStore: GenerationResultStore | null = null;
  let preflightStreamStarted = false;
  let preflightStopHeartbeat: (() => void) | null = null;
  try {
    let body = req.body as TransformRequest;
    if (deps.isCsvTransformRequest(body)) {
      res.status(410).json({ error: 'CSV no soportado en beta' });
      return;
    }
    const blockedUrl = deps.describeBlockedTransformUrl(body);
    if (blockedUrl) {
      res.status(blockedUrl.statusCode).json({ error: blockedUrl.errorMessage });
      return;
    }
    const ip = deps.getClientIp(req);
    const mapId =
      typeof body?.mapId === 'string' ? body.mapId : undefined;
    if (!deps.consumeTransformRateLimit(ip, mapId)) {
      res
        .status(429)
        .json({ error: 'Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.' });
      return;
    }
    if (!(await deps.requireLlmAccess(req, res))) return;
    if (!deps.enforceProEntitlements(req, res, body)) return;
    if (!deps.enforceUsageQuota(req, res, 'transform')) return;

    // PDF extraction and authenticated persistence can take longer than the
    // client's response-header timeout. Commit the NDJSON response first so
    // one request stays alive instead of triggering a duplicate REST retry.
    if (body.type === 'pdf') {
      const ids = resolveGenerationIds(body);
      generationIds = ids;
      body = { ...body, mapId: ids.mapId, generationRunId: ids.generationRunId };
      resultStore = deps.generationResultStore ?? createGenerationResultStore();

      res.status(200);
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === 'function') {
        (res as Response & { flushHeaders: () => void }).flushHeaders();
      }
      emitRunEvent(res, ids);
      preflightStopHeartbeat = startGlobalStreamHeartbeat(res, ids);
      preflightStreamStarted = true;

      const existing = resultStore.get(ids.mapId, ids.generationRunId);
      if (existing?.status === 'complete' && existing.map) {
        persistAndWriteDone(res, resultStore, {
          ...ids,
          map: existing.map,
          model: existing.model,
        });
        res.end();
        preflightStopHeartbeat();
        preflightStopHeartbeat = null;
        return;
      }
      resultStore.ensureRunning(ids);
    }

    const finishPreflightError = (error: string, code: string): boolean => {
      if (!preflightStreamStarted || !generationIds || !resultStore) return false;
      if (code === 'CANCELLED') {
        resultStore.markCancelled(generationIds);
      } else {
        resultStore.markFailed({ ...generationIds, error, code });
      }
      if (!res.writableEnded) {
        res.write(`${JSON.stringify({ type: 'error', error, code })}\n`);
        res.end();
      }
      preflightStopHeartbeat?.();
      preflightStopHeartbeat = null;
      return true;
    };

    let transformIngest: IngestResult | null = null;
    let skipSourceTruncate = false;
    let boundSourceMeta: TransformSourceMeta | null = null;
    let boundPdfPersistRetry: import('../../../shared/pdf/types').PdfPersistRetryPayload | null =
      null;
    let ingestKind: 'ask' | 'source' | 'passthrough' | 'none' = 'none';
    let provenance: SourceProvenance | undefined;
    const accessToken = deps.getAccessToken(req);
    const { url: supabaseUrl, anonKey: supabaseAnonKey } = deps.getSupabaseConfig();

    const ingestOutcome = await resolveIngest(deps, {
      body,
      userId: req.userId,
      accessToken: req.userId ? accessToken : undefined,
      supabaseUrl,
      supabaseAnonKey,
      isCancelled: () => deps.isCancelled(req, res),
      persistFn: deps.persistFnOverride,
      persistPdfFn: deps.persistPdfFnOverride,
    });

    if (ingestOutcome.kind === 'cancelled') {
      if (finishPreflightError(ingestOutcome.error, 'CANCELLED')) return;
      res.status(499).json({ error: ingestOutcome.error, code: 'CANCELLED' });
      return;
    }
    if (ingestOutcome.kind === 'error') {
      if (
        finishPreflightError(
          ingestOutcome.error,
          ingestOutcome.code ?? 'INGEST_FAILED'
        )
      ) {
        return;
      }
      res.status(ingestOutcome.status).json({
        error: ingestOutcome.error,
        code: ingestOutcome.code,
      });
      return;
    }
    if (ingestOutcome.kind === 'ask') {
      ingestKind = 'ask';
      const answer = await deps.generateAskAnswer(
        body.text || '',
        body.depth,
        body.userDisplayName
      );
      res.json(askResultShell(answer));
      return;
    }
    if (ingestOutcome.kind === 'passthrough') {
      ingestKind = 'passthrough';
      body = ingestOutcome.body;
      provenance = ingestOutcome.provenance;
    }
    if (ingestOutcome.kind === 'source') {
      ingestKind = 'source';
      body = ingestOutcome.body;
      transformIngest = ingestOutcome.ingest;
      skipSourceTruncate = ingestOutcome.skipSourceTruncate;
      provenance = ingestOutcome.provenance;
      if (ingestOutcome.pasted) {
        setPastedTextResponseHeaders(res, ingestOutcome.pasted);
        boundSourceMeta = ingestOutcome.pasted.sourceMeta;
      }
      if (ingestOutcome.pdf) {
        if (!preflightStreamStarted) {
          setPdfSourceResponseHeaders(res, ingestOutcome.pdf);
        }
        boundSourceMeta = ingestOutcome.pdf.sourceMeta;
        boundPdfPersistRetry = ingestOutcome.pdf.persistRetry ?? null;
      }
      if (ingestOutcome.overviewOnly && ingestOutcome.ingest.chapters) {
        res.setHeader('X-Nucleo-Overview', '1');
        res.setHeader(
          'X-Nucleo-Chapter-Count',
          String(ingestOutcome.ingest.chapters.length)
        );
      }
    }

    if (deps.isCancelled(req, res)) {
      if (finishPreflightError('Creación cancelada', 'CANCELLED')) return;
      res.status(499).json({ error: 'Creación cancelada', code: 'CANCELLED' });
      return;
    }

    const generationIdsResolved = generationIds ?? resolveGenerationIds(body);
    generationIds = generationIdsResolved;
    body = {
      ...body,
      mapId: generationIdsResolved.mapId,
      generationRunId: generationIdsResolved.generationRunId,
    };
    resultStore = resultStore ?? deps.generationResultStore ?? createGenerationResultStore();
    streamTrace('request_started', {
      mapId: generationIdsResolved.mapId,
      generationRunId: generationIdsResolved.generationRunId,
    });

    // If this run already completed (client lost done / retry), return immediately.
    const existing = preflightStreamStarted
      ? null
      : resultStore.get(
          generationIdsResolved.mapId,
          generationIdsResolved.generationRunId
        );
    if (existing?.status === 'complete' && existing.map) {
      res.status(200);
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      emitRunEvent(res, generationIdsResolved);
      persistAndWriteDone(res, resultStore, {
        mapId: generationIdsResolved.mapId,
        generationRunId: generationIdsResolved.generationRunId,
        map: existing.map,
        model: existing.model,
      });
      res.end();
      return;
    }
    const runIds = generationIdsResolved;
    const store = resultStore!;
    store.ensureRunning(runIds);

    const intent = resolveMapIntent(body);
    const applyGate = canRunApplicationEngine({
      intent,
      body,
      ingestKind,
      ingest: transformIngest,
    });
    const understandGate = canRunUnderstandingEngine({
      intent,
      body,
      ingestKind,
      ingest: transformIngest,
    });

    // S06: Aplicar NDJSON — same engine as JSON; stages before application_ready/done.
    if (applyGate.run && deps.runApplicationEngine && deps.runUnderstandEngine) {
      if (!preflightStreamStarted) {
        res.status(200);
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === 'function') {
          (res as Response & { flushHeaders: () => void }).flushHeaders();
        }
        emitRunEvent(res, runIds);
      }
      streamTrace('headers_flushed', {
        mapId: runIds.mapId,
        generationRunId: runIds.generationRunId,
      });
      const stopHeartbeat =
        preflightStopHeartbeat ?? startGlobalStreamHeartbeat(res, runIds);
      preflightStopHeartbeat = null;
      const onClose = () => {
        streamTrace('response_close', {
          mapId: runIds.mapId,
          generationRunId: runIds.generationRunId,
        });
      };
      const onFinish = () => {
        streamTrace('response_finish', {
          mapId: runIds.mapId,
          generationRunId: runIds.generationRunId,
        });
      };
      const onAborted = () => {
        streamTrace('request_aborted', {
          mapId: runIds.mapId,
          generationRunId: runIds.generationRunId,
        });
        store.markCancelled(runIds);
      };
      res.on('close', onClose);
      res.on('finish', onFinish);
      req.on('aborted', onAborted);

      try {
        if (boundSourceMeta) {
          res.write(
            `${JSON.stringify({
              type: 'source_meta',
              sourceMeta: boundSourceMeta,
              ...(boundPdfPersistRetry ? { pdfPersistRetry: boundPdfPersistRetry } : {}),
            })}\n`
          );
        }

        const contentHash = contentHashFromMeta(
          boundSourceMeta,
          body,
          transformIngest,
          provenance
        );

        const applied = await runApplyEnginePipeline(deps, {
          body,
          ingest: transformIngest,
          contentHash,
          provenance,
          userId: req.userId,
          ...pdfEvidenceFlags(boundSourceMeta),
          webFetchSucceeded: provenance?.extractionKind === 'web_fetch',
          isCancelled: () => deps.isCancelled(req, res),
          onStage: (label) => {
            if (deps.isCancelled(req, res) || res.writableEnded) return;
            res.write(`${JSON.stringify({ type: 'stage', stageLabel: label })}\n`);
          },
          onHeartbeat: () => {
            // Global heartbeat already covers the socket; S05 ticks stay no-ops here.
          },
        });

        if (deps.isCancelled(req, res)) {
          store.markCancelled(runIds);
          if (!res.writableEnded) {
            deps.writeStreamError?.(res, 'Creación cancelada');
            if (!res.writableEnded) res.end();
          }
          return;
        }

        if (applied.ok === false) {
          store.markFailed({
            ...runIds,
            error: applied.error,
            code: applied.code,
          });
          streamTrace(
            'generation_failed',
            {
              mapId: runIds.mapId,
              generationRunId: runIds.generationRunId,
              detail: applied.code,
            },
            'error'
          );
          if (!res.writableEnded) {
            res.write(
              `${JSON.stringify({
                type: 'error',
                error: applied.error,
                code: applied.code,
              })}\n`
            );
            res.end();
          }
          return;
        }

        const doneMap = boundSourceMeta
          ? withPdfCoverage(applied.map, boundSourceMeta)
          : applied.map;
        persistAndWriteDone(res, resultStore, {
          ...runIds,
          map: doneMap,
          model: applied.model,
          sourceMeta: boundSourceMeta ?? undefined,
          pdfPersistRetry: boundPdfPersistRetry ?? undefined,
        });
        res.end();
        return;
      } finally {
        stopHeartbeat();
        res.off?.('close', onClose);
        res.off?.('finish', onFinish);
        req.off?.('aborted', onAborted);
      }
    }

    // S04: staged Understanding Engine for Entender (NDJSON stages + essential_ready).
    if (understandGate.run && deps.runUnderstandEngine) {
      if (!preflightStreamStarted) {
        res.status(200);
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === 'function') {
          (res as Response & { flushHeaders: () => void }).flushHeaders();
        }
        emitRunEvent(res, runIds);
      }
      streamTrace('headers_flushed', {
        mapId: runIds.mapId,
        generationRunId: runIds.generationRunId,
      });
      const stopHeartbeat =
        preflightStopHeartbeat ?? startGlobalStreamHeartbeat(res, runIds);
      preflightStopHeartbeat = null;
      const onClose = () => {
        streamTrace('response_close', {
          mapId: runIds.mapId,
          generationRunId: runIds.generationRunId,
        });
      };
      const onFinish = () => {
        streamTrace('response_finish', {
          mapId: runIds.mapId,
          generationRunId: runIds.generationRunId,
        });
      };
      const onAborted = () => {
        streamTrace('request_aborted', {
          mapId: runIds.mapId,
          generationRunId: runIds.generationRunId,
        });
        store.markCancelled(runIds);
      };
      res.on('close', onClose);
      res.on('finish', onFinish);
      req.on('aborted', onAborted);
      try {
        if (boundSourceMeta) {
          res.write(
            `${JSON.stringify({
              type: 'source_meta',
              sourceMeta: boundSourceMeta,
              ...(boundPdfPersistRetry ? { pdfPersistRetry: boundPdfPersistRetry } : {}),
            })}\n`
          );
        }

        const engineResult = await deps.runUnderstandEngine({
          body: { ...body, intent: 'understand' },
          ingest: transformIngest,
          contentHash: contentHashFromMeta(
            boundSourceMeta,
            body,
            transformIngest,
            provenance
          ),
          provenance,
          userId: req.userId,
          isCancelled: () => deps.isCancelled(req, res),
          onStage: (label) => {
            if (deps.isCancelled(req, res) || res.writableEnded) return;
            res.write(`${JSON.stringify({ type: 'stage', stageLabel: label })}\n`);
          },
          onEssentialReady: (partial) => {
            if (deps.isCancelled(req, res) || res.writableEnded) return;
            res.write(
              `${JSON.stringify({
                type: 'essential_ready',
                map: partial,
                essential: {
                  title: partial.title,
                  coreIdea: partial.coreIdea,
                  coreSupport: partial.coreSupport ?? '',
                  layer0: partial.layer0,
                },
              })}\n`
            );
          },
        });

        if (deps.isCancelled(req, res)) {
          store.markCancelled(runIds);
          if (!res.writableEnded) {
            deps.writeStreamError?.(res, 'Creación cancelada');
            if (!res.writableEnded) res.end();
          }
          return;
        }

        if (engineResult.ok === false) {
          store.markFailed({
            ...runIds,
            error: engineResult.error,
            code: engineResult.code,
          });
          streamTrace(
            'generation_failed',
            {
              mapId: runIds.mapId,
              generationRunId: runIds.generationRunId,
              detail: engineResult.code,
            },
            'error'
          );
          if (!res.writableEnded) {
            res.write(
              `${JSON.stringify({
                type: 'error',
                error: engineResult.error,
                code: engineResult.code,
              })}\n`
            );
            res.end();
          }
          return;
        }

        if (deps.isCancelled(req, res)) {
          store.markCancelled(runIds);
          if (!res.writableEnded) {
            deps.writeStreamError?.(res, 'Creación cancelada');
            if (!res.writableEnded) res.end();
          }
          return;
        }

        const contentHash = contentHashFromMeta(
          boundSourceMeta,
          body,
          transformIngest,
          provenance
        );
        const finalized = await finalizeUnderstandMap(deps, {
          map: engineResult.map,
          body,
          ingest: transformIngest,
          contentHash,
          userId: req.userId,
          ...pdfEvidenceFlags(boundSourceMeta),
          webFetchSucceeded: provenance?.extractionKind === 'web_fetch',
          isCancelled: () => deps.isCancelled(req, res),
          onHeartbeat: () => undefined,
        });
        if (finalized.ok === false) {
          store.markFailed({
            ...runIds,
            error: finalized.error,
            code: finalized.code,
          });
          if (!res.writableEnded) {
            res.write(
              `${JSON.stringify({
                type: 'error',
                error: finalized.error,
                code: finalized.code,
              })}\n`
            );
            res.end();
          }
          return;
        }
        if (deps.isCancelled(req, res)) {
          store.markCancelled(runIds);
          if (!res.writableEnded) {
            deps.writeStreamError?.(res, 'Creación cancelada');
            if (!res.writableEnded) res.end();
          }
          return;
        }

        const doneMap = boundSourceMeta
          ? withPdfCoverage(finalized.map, boundSourceMeta)
          : finalized.map;
        persistAndWriteDone(res, resultStore, {
          ...runIds,
          map: doneMap,
          model: engineResult.model,
          sourceMeta: boundSourceMeta ?? undefined,
          pdfPersistRetry: boundPdfPersistRetry ?? undefined,
        });
        res.end();
        return;
      } finally {
        stopHeartbeat();
        res.off?.('close', onClose);
        res.off?.('finish', onFinish);
        req.off?.('aborted', onAborted);
      }
    }

    // Legacy stream runner (non-S04/S06 engines).
    {
      // The legacy runner owns its response headers and initial source event.
      // Sending an early heartbeat here would commit the response first and
      // break that contract. The production runner starts its own heartbeat.
      const contextResult = await deps.buildTransformContext(body, {
        isPro: Boolean(req.isPro),
        skipSourceTruncate,
      });
      if ('error' in contextResult) {
        store.markFailed({
          ...runIds,
          error: contextResult.error,
          code: 'CONTEXT_FAILED',
        });
        res.status(contextResult.status).json({ error: contextResult.error });
        return;
      }

      deps.logTransformEntryDebug?.(body, contextResult, TRANSFORM_HTTP_PATHS.stream);

      if (deps.isCancelled(req, res)) {
        store.markCancelled(runIds);
        res.status(499).json({ error: 'Creación cancelada', code: 'CANCELLED' });
        return;
      }

      const inheritedStopHeartbeat = preflightStopHeartbeat;
      preflightStopHeartbeat = null;
      await deps.runTransformStream(
        contextResult,
        res,
        req,
        transformIngest,
        boundSourceMeta,
        {
          ...runIds,
          resultStore: store,
          ...(inheritedStopHeartbeat
            ? { stopHeartbeat: inheritedStopHeartbeat }
            : {}),
        }
      );
      return;
    }
  } catch (err) {
    preflightStopHeartbeat?.();
    preflightStopHeartbeat = null;
    console.error('[transform/stream]', err);
    if (generationIds && resultStore) {
      resultStore.markFailed({
        ...generationIds,
        error: 'Error al generar el Núcleo',
        code: 'STREAM_CRASH',
      });
      streamTrace(
        'generation_failed',
        {
          mapId: generationIds.mapId,
          generationRunId: generationIds.generationRunId,
          detail: 'STREAM_CRASH',
        },
        'error'
      );
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar el Núcleo' });
    } else if (!res.writableEnded) {
      try {
        res.write(
          `${JSON.stringify({ type: 'error', error: 'Error al generar el Núcleo' })}\n`
        );
      } catch {
        // ignore
      }
      res.end();
    }
  }
}

export async function handlePdfPersistRoute(
  deps: TransformRouteDeps,
  req: TransformRouteRequest,
  res: Response
): Promise<void> {
  try {
    await deps.authenticateOptional(req);
    if (!req.userId) {
      res.status(401).json({ error: 'Autenticación requerida', code: 'AUTH_REQUIRED' });
      return;
    }
    const accessToken = deps.getAccessToken(req);
    if (!accessToken) {
      res.status(401).json({ error: 'Autenticación requerida', code: 'AUTH_REQUIRED' });
      return;
    }
    const { url: supabaseUrl, anonKey: supabaseAnonKey } = deps.getSupabaseConfig();
    const persistFn =
      deps.persistPdfFnOverride ??
      (deps.createJwtPersistPdfFn && supabaseUrl && supabaseAnonKey
        ? deps.createJwtPersistPdfFn({
            accessToken,
            supabaseUrl,
            supabaseAnonKey,
          })
        : undefined);
    if (!persistFn) {
      res
        .status(503)
        .json({ error: 'Persistencia PDF no disponible', code: 'PDF_PERSIST_FAILED' });
      return;
    }

    const body = req.body as {
      fileData?: string;
      title?: string;
      mapId?: string;
      sourceId?: string;
      sourceVersionId?: string;
      sourceRequestId?: string;
      contentHash?: string;
      extractionDigest?: string;
      pageCount?: number;
      storagePath?: string;
      segments?: unknown;
      coverage?: unknown;
    };
    const ids = parsePastedTextOperationIds({
      mapId: body.mapId,
      sourceId: body.sourceId,
      sourceVersionId: body.sourceVersionId,
      sourceRequestId: body.sourceRequestId,
    });
    if (!ids) {
      res.status(400).json({ error: 'IDs de fuente incompletos', code: 'PDF_EXTRACT_FAILED' });
      return;
    }
    if (typeof body.fileData !== 'string' || !body.fileData) {
      res.status(400).json({ error: 'PDF requerido', code: 'PDF_EMPTY' });
      return;
    }
    if (
      typeof body.contentHash !== 'string' ||
      typeof body.extractionDigest !== 'string' ||
      !Array.isArray(body.segments) ||
      typeof body.pageCount !== 'number' ||
      !body.coverage ||
      typeof body.coverage !== 'object'
    ) {
      res.status(400).json({
        error: 'Payload de retry PDF incompleto',
        code: 'PDF_PERSIST_FAILED',
      });
      return;
    }

    const buffer = Buffer.from(body.fileData, 'base64');
    const outcome = await orchestratePdfPersistOnly({
      ids,
      contentHash: body.contentHash,
      extractionDigest: body.extractionDigest,
      title: typeof body.title === 'string' ? body.title : undefined,
      buffer,
      pageCount: body.pageCount,
      segments: body.segments as import('../ingestors/pdfPersist').PdfSegmentPayload[],
      coverage: body.coverage as import('../../../shared/pdf/types').PdfCoverage,
      storagePath: typeof body.storagePath === 'string' ? body.storagePath : undefined,
      isCancelled: () => deps.isCancelled(req, res),
      persistFn,
    });

    if (outcome.ok === false) {
      if (outcome.code === 'PDF_CANCELLED' || outcome.code === 'CANCELLED') {
        res.status(499).json({ error: outcome.error, code: outcome.code });
        return;
      }
      res.status(outcome.status).json({ error: outcome.error, code: outcome.code });
      return;
    }

    setPdfSourceResponseHeaders(res, outcome);
    res.json({ ok: true, sourceMeta: outcome.sourceMeta });
  } catch (err) {
    console.error('[sources/pdf/persist]', err);
    res.status(500).json({ error: 'Error al persistir PDF', code: 'PDF_PERSIST_FAILED' });
  }
}

/** GET durable generation result — never re-runs models. */
export async function handleTransformResultRoute(
  deps: TransformRouteDeps,
  req: TransformRouteRequest,
  res: Response
): Promise<void> {
  const mapId =
    typeof req.query.mapId === 'string' ? req.query.mapId.trim() : '';
  const generationRunId =
    typeof req.query.generationRunId === 'string'
      ? req.query.generationRunId.trim()
      : '';
  if (!mapId || !generationRunId) {
    res.status(400).json({ error: 'mapId y generationRunId son obligatorios' });
    return;
  }
  const store = deps.generationResultStore ?? createGenerationResultStore();
  const record = store.get(mapId, generationRunId);
  if (!record) {
    res.status(404).json({
      mapId,
      generationRunId,
      status: 'pending',
      updatedAt: Date.now(),
    });
    return;
  }
  res.status(200).json({
    mapId: record.mapId,
    generationRunId: record.generationRunId,
    status: record.status,
    ...(record.map ? { map: record.map } : {}),
    ...(record.model ? { model: record.model } : {}),
    ...(record.error ? { error: record.error } : {}),
    ...(record.code ? { code: record.code } : {}),
    updatedAt: record.updatedAt,
  });
}

export function registerTransformRoutes(
  app: Express,
  deps: TransformRouteDeps
): {
  paths: typeof TRANSFORM_HTTP_PATHS;
  handlers: {
    persist: (req: Request, res: Response, next?: NextFunction) => void;
    persistPdf: (req: Request, res: Response, next?: NextFunction) => void;
    transform: (req: Request, res: Response, next?: NextFunction) => void;
    stream: (req: Request, res: Response, next?: NextFunction) => void;
    result: (req: Request, res: Response, next?: NextFunction) => void;
  };
} {
  const persist = (req: Request, res: Response) => {
    void handlePastedPersistRoute(deps, req as TransformRouteRequest, res);
  };
  const persistPdf = (req: Request, res: Response) => {
    void handlePdfPersistRoute(deps, req as TransformRouteRequest, res);
  };
  const transform = (req: Request, res: Response) => {
    void handleTransformJsonRoute(deps, req as TransformRouteRequest, res);
  };
  const stream = (req: Request, res: Response) => {
    void handleTransformStreamRoute(deps, req as TransformRouteRequest, res);
  };
  const result = (req: Request, res: Response) => {
    void handleTransformResultRoute(deps, req as TransformRouteRequest, res);
  };

  app.post(TRANSFORM_HTTP_PATHS.persist, persist);
  app.post(TRANSFORM_HTTP_PATHS.persistPdf, persistPdf);
  app.post(TRANSFORM_HTTP_PATHS.transform, transform);
  app.post(TRANSFORM_HTTP_PATHS.stream, stream);
  app.get(TRANSFORM_HTTP_PATHS.result, result);

  return {
    paths: TRANSFORM_HTTP_PATHS,
    handlers: { persist, persistPdf, transform, stream, result },
  };
}

/** Marker symbol used by parity tests — must appear in production server.ts. */
export const REGISTER_TRANSFORM_ROUTES_MARKER = 'registerTransformRoutes';
