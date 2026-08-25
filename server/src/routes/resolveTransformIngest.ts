/**
 * Shared ingest resolution for /api/transform and /api/transform/stream (S03 + S08).
 */

import type { TransformRequest } from '../../../shared/contracts';
import type { IngestResult } from '../../../shared/types/chunk';
import {
  buildSourceProvenance,
  type SourceProvenance,
} from '../../../shared/understanding/provenance';
import {
  prepareTransformIngest,
  type PrepareIngestOutcome,
} from './transformIngest';
import {
  orchestratePastedTextTransform,
  type PastedTextOrchestrationOk,
} from '../ingestors/pastedTextOrchestration';
import { persistPastedTextWithUserJwt } from '../ingestors/pastedTextPersist';
import {
  orchestratePdfTransform,
  type PdfOrchestrationOk,
  type PersistPdfFn,
} from '../ingestors/pdfOrchestration';
import { persistPdfSourceWithUserJwt } from '../ingestors/pdfPersist';
import { isAskLaneInput } from '../ingestors/askLane';

function looksLikeHttpUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPdfRequest(body: TransformRequest): boolean {
  if (body.type === 'pdf') return true;
  const mime = (body.mimeType || '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true;
  const label = (body.sourceLabel || '').toLowerCase();
  return Boolean(body.fileData) && label.endsWith('.pdf');
}

type OriginalBodySnap = Pick<TransformRequest, 'type' | 'text' | 'sourceLabel' | 'mimeType'>;

function snapOriginalBody(body: TransformRequest): OriginalBodySnap {
  return {
    type: body.type,
    text: body.text,
    sourceLabel: body.sourceLabel,
    mimeType: body.mimeType,
  };
}

export type ResolvedTransformIngest =
  | { kind: 'ask' }
  | {
      kind: 'passthrough';
      body: TransformRequest;
      provenance?: SourceProvenance;
    }
  | {
      kind: 'source';
      body: TransformRequest;
      ingest: IngestResult;
      overviewOnly: boolean;
      pasted?: PastedTextOrchestrationOk;
      pdf?: PdfOrchestrationOk;
      skipSourceTruncate: boolean;
      provenance: SourceProvenance;
    }
  | { kind: 'error'; status: number; error: string; code?: string }
  | { kind: 'cancelled'; error: string };

export async function resolveTransformIngest(args: {
  body: TransformRequest;
  userId?: string;
  accessToken?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  isCancelled?: () => boolean;
  persistFn?: Parameters<typeof orchestratePastedTextTransform>[0]['persistFn'];
  persistPdfFn?: PersistPdfFn;
}): Promise<ResolvedTransformIngest> {
  const {
    body,
    userId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
    isCancelled,
    persistFn,
    persistPdfFn,
  } = args;
  const originalBody = snapOriginalBody(body);

  if (isCancelled?.()) {
    return { kind: 'cancelled', error: 'Creación cancelada' };
  }

  // S08 PDF orchestration (before generic factory).
  if (isPdfRequest(body)) {
    let abortTimer: ReturnType<typeof setInterval> | undefined;
    const ac =
      typeof AbortController !== 'undefined' && isCancelled
        ? (() => {
            const controller = new AbortController();
            const tick = () => {
              if (isCancelled()) controller.abort();
            };
            tick();
            abortTimer = setInterval(tick, 40);
            return controller;
          })()
        : undefined;

    const resolvedPdfPersist: PersistPdfFn | undefined =
      persistPdfFn ??
      (userId && accessToken && supabaseUrl && supabaseAnonKey
        ? async (persistArgs) => {
            const result = await persistPdfSourceWithUserJwt({
              accessToken,
              supabaseUrl,
              supabaseAnonKey,
              ...persistArgs,
            });
            if (result.ok === false) return result;
            return { ok: true, storagePath: result.storagePath };
          }
        : undefined);

    let outcome: Awaited<ReturnType<typeof orchestratePdfTransform>>;
    try {
      outcome = await orchestratePdfTransform({
        body,
        persistFn: resolvedPdfPersist,
        isCancelled,
        signal: ac?.signal,
      });
    } finally {
      if (abortTimer) clearInterval(abortTimer);
    }

    if (outcome.ok === false) {
      if (outcome.code === 'PDF_CANCELLED' || outcome.code === 'CANCELLED') {
        return { kind: 'cancelled', error: outcome.error };
      }
      return {
        kind: 'error',
        status: outcome.status,
        error: outcome.error,
        code: outcome.code,
      };
    }

    const provenance = buildSourceProvenance({
      body: outcome.body,
      originalBody,
      ingest: outcome.ingest,
      contentHash: outcome.contentHash,
      sourceId: outcome.ids.sourceId,
      sourceVersionId: outcome.ids.sourceVersionId,
    });

    return {
      kind: 'source',
      body: outcome.body,
      ingest: outcome.ingest,
      overviewOnly: false,
      pdf: outcome,
      skipSourceTruncate: true,
      provenance,
    };
  }

  // Pasted / plain text (not URL, not ask lane) → S03 orchestration.
  if (
    body.type === 'text' &&
    typeof body.text === 'string' &&
    body.text.length > 0 &&
    !looksLikeHttpUrl(body.text) &&
    !isAskLaneInput(body)
  ) {
    const resolvedPersist =
      persistFn ??
      (userId && accessToken && supabaseUrl && supabaseAnonKey
        ? async (persistArgs: Parameters<
            NonNullable<
              Parameters<typeof orchestratePastedTextTransform>[0]['persistFn']
            >
          >[0]) =>
            persistPastedTextWithUserJwt({
              accessToken,
              supabaseUrl,
              supabaseAnonKey,
              ...persistArgs,
            })
        : undefined);

    const outcome = await orchestratePastedTextTransform({
      body,
      persistFn: resolvedPersist,
      isCancelled,
    });

    if (outcome.ok === false) {
      if (outcome.code === 'CANCELLED') {
        return { kind: 'cancelled', error: outcome.error };
      }
      return {
        kind: 'error',
        status: outcome.status,
        error: outcome.error,
        code: outcome.code,
      };
    }

    const provenance = buildSourceProvenance({
      body: outcome.body,
      originalBody,
      ingest: outcome.ingest,
      contentHash: outcome.contentHash,
      sourceId: outcome.ids.sourceId,
      sourceVersionId: outcome.ids.sourceVersionId,
    });

    return {
      kind: 'source',
      body: outcome.body,
      ingest: outcome.ingest,
      overviewOnly: false,
      pasted: outcome,
      skipSourceTruncate: true,
      provenance,
    };
  }

  let abortTimer: ReturnType<typeof setInterval> | undefined;
  const abortFromCancel =
    typeof AbortController !== 'undefined' && isCancelled
      ? (() => {
          const controller = new AbortController();
          const tick = () => {
            if (isCancelled()) controller.abort();
          };
          tick();
          abortTimer = setInterval(tick, 50);
          return controller;
        })()
      : undefined;

  let ingestOutcome: PrepareIngestOutcome;
  try {
    ingestOutcome = await prepareTransformIngest(body, {
      signal: abortFromCancel?.signal,
    });
  } finally {
    if (abortTimer) clearInterval(abortTimer);
  }
  if (isCancelled?.()) {
    return { kind: 'cancelled', error: 'Creación cancelada' };
  }
  if (ingestOutcome.kind === 'error') {
    if (ingestOutcome.code === 'PDF_CANCELLED') {
      return { kind: 'cancelled', error: ingestOutcome.error };
    }
    return {
      kind: 'error',
      status: ingestOutcome.status,
      error: ingestOutcome.error,
      code: ingestOutcome.code,
    };
  }
  if (ingestOutcome.kind === 'ask') return { kind: 'ask' };
  if (ingestOutcome.kind === 'passthrough') {
    const provenance = buildSourceProvenance({
      body,
      originalBody,
      ingest: null,
      ingestKind: 'passthrough',
    });
    return { kind: 'passthrough', body, provenance };
  }
  const provenance = buildSourceProvenance({
    body: ingestOutcome.body,
    originalBody,
    ingest: ingestOutcome.ingest,
    contentHash: ingestOutcome.ingest.rawHash,
    sourceId: ingestOutcome.body.sourceId,
    sourceVersionId: ingestOutcome.body.sourceVersionId,
  });
  return {
    kind: 'source',
    body: ingestOutcome.body,
    ingest: ingestOutcome.ingest,
    overviewOnly: ingestOutcome.overviewOnly,
    skipSourceTruncate: true,
    provenance,
  };
}

export function setPastedTextResponseHeaders(
  res: { setHeader: (k: string, v: string) => void },
  pasted: PastedTextOrchestrationOk
) {
  res.setHeader('X-Nucleo-Source-Id', pasted.ids.sourceId);
  res.setHeader('X-Nucleo-Source-Version-Id', pasted.ids.sourceVersionId);
  res.setHeader('X-Nucleo-Source-Request-Id', pasted.ids.sourceRequestId);
  res.setHeader('X-Nucleo-Source-Status', pasted.sourceStatus);
  res.setHeader('X-Nucleo-Persist-Status', pasted.persistStatus);
  res.setHeader('X-Nucleo-Segment-Count', String(pasted.ingest.chunks.length));
  res.setHeader('X-Nucleo-Content-Hash', pasted.contentHash);
  if (pasted.sourceMeta.persistFailureCode) {
    res.setHeader(
      'X-Nucleo-Persist-Failure-Code',
      pasted.sourceMeta.persistFailureCode
    );
  }
}

export function setPdfSourceResponseHeaders(
  res: { setHeader: (k: string, v: string) => void },
  pdf: PdfOrchestrationOk
) {
  res.setHeader('X-Nucleo-Source-Id', pdf.ids.sourceId);
  res.setHeader('X-Nucleo-Source-Version-Id', pdf.ids.sourceVersionId);
  res.setHeader('X-Nucleo-Source-Request-Id', pdf.ids.sourceRequestId);
  res.setHeader('X-Nucleo-Source-Status', pdf.sourceStatus);
  res.setHeader('X-Nucleo-Persist-Status', pdf.persistStatus);
  res.setHeader('X-Nucleo-Segment-Count', String(pdf.ingest.chunks.length));
  res.setHeader('X-Nucleo-Content-Hash', pdf.contentHash);
  res.setHeader('X-Nucleo-Extraction-Digest', pdf.extractionDigest);
  res.setHeader('X-Nucleo-Pdf-Coverage', pdf.coverage.status);
  res.setHeader(
    'X-Nucleo-Pdf-Pages',
    `${pdf.coverage.textualPages}/${pdf.coverage.pageCount}`
  );
  if (pdf.storagePath) {
    res.setHeader('X-Nucleo-Storage-Path', pdf.storagePath);
  }
  if (pdf.sourceMeta.persistFailureCode) {
    res.setHeader('X-Nucleo-Persist-Failure-Code', pdf.sourceMeta.persistFailureCode);
  }
}
