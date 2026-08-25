/**
 * S08 PDF ingest + optional cloud persist orchestration.
 * Guest → local only. Auth → Storage + persist_pdf_source RPC.
 * Persist-only retry never re-extracts when segments+digests are supplied.
 */

import type { TransformRequest } from '../../../shared/contracts';
import type { IngestResult, SourceChunk } from '../../../shared/types/chunk';
import {
  createPastedTextOperationIds,
  parsePastedTextOperationIds,
  type PastedTextOperationIds,
  type PastedTextPersistStatus,
  type PastedTextSourceStatus,
} from '../../../shared/pastedText';
import { labelledChunkText } from './chunkUtils';
import { pdfIngestor } from './pdfIngestor';
import { extractPdfNative } from './pdfExtractNative';
import { pdfInspectorMetadataStrings } from './pdfInspectorAdapter';
import { segmentPdfPages, asSourceChunks } from '../../../shared/pdf/segmentPdf';
import { validateIngestChunks } from './validateChunks';
import { pdfSourceMetaFromCoverage } from '../../../shared/pdf/applyCoverageToMap';
import type {
  PdfCoverage,
  PdfSourceMeta,
  PdfSegmentPayload,
  PdfPersistRetryPayload,
} from '../../../shared/pdf/types';
import { PDF_SCHEMA_VERSION } from '../../../shared/pdf/versions';
import { sanitizePersistFailureCode } from '../../../shared/persistFailureCodes';

export type { PdfPersistRetryPayload };

export type PdfOrchestrationOk = {
  ok: true;
  body: TransformRequest;
  ingest: IngestResult;
  buffer: Buffer;
  contentHash: string;
  extractionDigest: string;
  ids: PastedTextOperationIds;
  sourceStatus: PastedTextSourceStatus;
  persistStatus: PastedTextPersistStatus;
  sourceMeta: PdfSourceMeta;
  coverage: PdfCoverage;
  storagePath?: string;
  /** Present when persistStatus is sync_failed so retry skips extract/Gemini. */
  persistRetry?: PdfPersistRetryPayload;
};

export type PdfOrchestrationFail = {
  ok: false;
  status: number;
  code: string;
  error: string;
  coverage?: PdfCoverage;
};

export type PdfOrchestrationResult = PdfOrchestrationOk | PdfOrchestrationFail;

export type PersistPdfFn = (args: {
  ids: PastedTextOperationIds;
  contentHash: string;
  extractionDigest: string;
  title: string | undefined;
  buffer: Buffer;
  byteSize: number;
  mimeType?: string;
  pageCount: number;
  segments: PdfSegmentPayload[];
  coverage: PdfCoverage;
  storagePath?: string;
}) => Promise<{ ok: true; storagePath: string } | { ok: false; error: string }>;

function bufferFromBody(body: TransformRequest): Buffer | null {
  if (!body.fileData) return null;
  try {
    const buf = Buffer.from(body.fileData, 'base64');
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

export function pdfSegmentsPayload(chunks: SourceChunk[]): PdfSegmentPayload[] {
  return chunks.map((chunk, ordinal) => ({
    ordinal,
    kind: 'chunk',
    raw_text: chunk.text,
    normalized_text: chunk.text,
    chunk_id: chunk.id,
    anchor: {
      type: 'page_char_range' as const,
      page: chunk.loc.page ?? 1,
      start: chunk.loc.start,
      end: chunk.loc.end,
    },
  }));
}

function coveragePreface(coverage: PdfCoverage): string {
  return [
    `LIMITACIONES PDF: ${coverage.summary}`,
    `Páginas con texto: ${coverage.textualPages}/${coverage.pageCount}.`,
    coverage.affectedPages.length
      ? `Páginas afectadas: ${coverage.affectedPages.join(', ')}.`
      : '',
    `Códigos: ${coverage.limitations.join(',')}.`,
    'No inventes tablas, diagramas ni texto de páginas sin chunk.',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Validate → extract → segment → optional persist.
 */
export async function orchestratePdfTransform(args: {
  body: TransformRequest;
  persistFn?: PersistPdfFn;
  isCancelled?: () => boolean;
  signal?: AbortSignal;
}): Promise<PdfOrchestrationResult> {
  const { body, persistFn, isCancelled } = args;
  const buffer = bufferFromBody(body);
  if (!buffer) {
    return {
      ok: false,
      status: 400,
      code: 'PDF_EMPTY',
      error: 'El archivo PDF está vacío o no se pudo leer.',
    };
  }

  if (isCancelled?.() || args.signal?.aborted) {
    return { ok: false, status: 499, code: 'PDF_CANCELLED', error: 'Creación cancelada' };
  }

  const parsed = parsePastedTextOperationIds(body);
  const minted = createPastedTextOperationIds();
  const ids: PastedTextOperationIds = parsed ?? {
    mapId: body.mapId?.trim() ? body.mapId.trim() : minted.mapId,
    sourceId: minted.sourceId,
    sourceVersionId: minted.sourceVersionId,
    sourceRequestId: minted.sourceRequestId,
  };

  const extracted = await extractPdfNative({
    buffer,
    declaredMime: body.mimeType,
    fileName: body.sourceLabel,
    signal: args.signal,
  });

  if (extracted.ok === false) {
    const status =
      extracted.code === 'PDF_TOO_LARGE' || extracted.code === 'PDF_TOO_MANY_PAGES'
        ? 413
        : extracted.code === 'PDF_CANCELLED'
          ? 499
          : 422;
    return {
      ok: false,
      status,
      code: extracted.code,
      error: extracted.message,
      coverage: extracted.coverage,
    };
  }

  if (isCancelled?.() || args.signal?.aborted) {
    return { ok: false, status: 499, code: 'PDF_CANCELLED', error: 'Creación cancelada' };
  }

  const artifact = segmentPdfPages({
    pages: extracted.pages,
    rawHash: extracted.rawHash,
    coverage: extracted.coverage,
    title: extracted.title,
    extractionDigest: extracted.extractionDigest,
  });
  const chunks = asSourceChunks(artifact.segments);
  if (!chunks.length) {
    return {
      ok: false,
      status: 422,
      code: 'PDF_INSUFFICIENT_TEXT',
      error: 'No quedó texto verificable tras segmentar el PDF.',
      coverage: extracted.coverage,
    };
  }

  const ingest: IngestResult = {
    chunks,
    metadata: {
      type: 'pdf',
      title: extracted.title || body.sourceLabel || undefined,
      pdfCoverage: extracted.coverage.status,
      pdfPageCount: String(extracted.coverage.pageCount),
      pdfTextualPages: String(extracted.coverage.textualPages),
      pdfExtractionDigest: extracted.extractionDigest,
      pdfLimitations: extracted.coverage.limitations.join(','),
      pdfCoverageSummary: extracted.coverage.summary,
      pdfSchemaVersion: PDF_SCHEMA_VERSION,
      pdfExtractorVersion: extracted.extractorVersion,
      ...pdfInspectorMetadataStrings(extracted.inspector),
    },
    rawHash: extracted.rawHash,
  };
  validateIngestChunks(ingest);

  let persistStatus: PastedTextPersistStatus = persistFn ? 'syncing' : 'local';
  let sourceStatus: PastedTextSourceStatus = 'ready';
  let storagePath: string | undefined;
  let persistFailureCode: string | undefined;
  const segments = pdfSegmentsPayload(chunks);

  if (persistFn) {
    if (isCancelled?.()) {
      return { ok: false, status: 499, code: 'PDF_CANCELLED', error: 'Creación cancelada' };
    }
    const persisted = await persistFn({
      ids,
      contentHash: extracted.rawHash,
      extractionDigest: extracted.extractionDigest,
      title: body.sourceLabel,
      buffer,
      byteSize: buffer.length,
      mimeType: body.mimeType || 'application/pdf',
      pageCount: extracted.coverage.pageCount,
      segments,
      coverage: extracted.coverage,
    });
    if (isCancelled?.() || args.signal?.aborted) {
      return { ok: false, status: 499, code: 'PDF_CANCELLED', error: 'Creación cancelada' };
    }
    if (persisted.ok === false) {
      persistStatus = 'sync_failed';
      persistFailureCode = sanitizePersistFailureCode(persisted.error);
    } else {
      persistStatus = 'cloud';
      storagePath = persisted.storagePath;
    }
  }

  const preface = coveragePreface(extracted.coverage);
  const nextBody: TransformRequest = {
    ...body,
    type: 'text',
    text: `${preface}${labelledChunkText(chunks)}`,
    textMode: 'source',
    fileData: undefined,
    mimeType: undefined,
    mapId: ids.mapId,
    sourceId: ids.sourceId,
    sourceVersionId: ids.sourceVersionId,
    sourceRequestId: ids.sourceRequestId,
    sourceLabel: extracted.title || body.sourceLabel,
  };

  const persistRetry: PdfPersistRetryPayload | undefined =
    persistStatus === 'sync_failed'
      ? {
          segments,
          coverage: extracted.coverage,
          contentHash: extracted.rawHash,
          extractionDigest: extracted.extractionDigest,
          pageCount: extracted.coverage.pageCount,
          ...(storagePath ? { storagePath } : {}),
        }
      : undefined;

  return {
    ok: true,
    body: nextBody,
    ingest,
    buffer,
    contentHash: extracted.rawHash,
    extractionDigest: extracted.extractionDigest,
    ids,
    sourceStatus,
    persistStatus,
    coverage: extracted.coverage,
    storagePath,
    persistRetry,
    sourceMeta: pdfSourceMetaFromCoverage({
      sourceId: ids.sourceId,
      sourceVersionId: ids.sourceVersionId,
      sourceRequestId: ids.sourceRequestId,
      sourceStatus,
      persistStatus,
      ...(persistFailureCode ? { persistFailureCode } : {}),
      contentHash: extracted.rawHash,
      extractionDigest: extracted.extractionDigest,
      segmentCount: chunks.length,
      coverage: extracted.coverage,
      storagePath,
    }),
  };
}

/**
 * Persist-only: uses precomputed segments + digests. Does NOT call extract/Gemini/S04.
 */
export async function orchestratePdfPersistOnly(args: {
  ids: PastedTextOperationIds;
  contentHash: string;
  extractionDigest: string;
  title?: string;
  buffer: Buffer;
  pageCount: number;
  segments: PdfSegmentPayload[];
  coverage: PdfCoverage;
  storagePath?: string;
  persistFn: PersistPdfFn;
  isCancelled?: () => boolean;
}): Promise<PdfOrchestrationResult> {
  if (args.isCancelled?.()) {
    return { ok: false, status: 499, code: 'PDF_CANCELLED', error: 'Creación cancelada' };
  }
  if (!args.segments.length) {
    return {
      ok: false,
      status: 400,
      code: 'PDF_INSUFFICIENT_TEXT',
      error: 'No hay segmentos para persistir.',
    };
  }

  const persisted = await args.persistFn({
    ids: args.ids,
    contentHash: args.contentHash,
    extractionDigest: args.extractionDigest,
    title: args.title,
    buffer: args.buffer,
    byteSize: args.buffer.length,
    mimeType: 'application/pdf',
    pageCount: args.pageCount,
    segments: args.segments,
    coverage: args.coverage,
    storagePath: args.storagePath,
  });

  const persistStatus: PastedTextPersistStatus =
    persisted.ok === true ? 'cloud' : 'sync_failed';
  const persistFailureCode =
    persisted.ok === false ? sanitizePersistFailureCode(persisted.error) : undefined;
  const chunks: SourceChunk[] = args.segments.map((s) => ({
    id: s.chunk_id,
    text: s.raw_text,
    hash: s.chunk_id.replace(/^chunk_/, ''),
    loc: {
      page: s.anchor.page,
      start: s.anchor.start,
      end: s.anchor.end,
    },
  }));

  return {
    ok: true,
    body: {
      type: 'text',
      text: labelledChunkText(chunks),
      mapId: args.ids.mapId,
      sourceId: args.ids.sourceId,
      sourceVersionId: args.ids.sourceVersionId,
      sourceRequestId: args.ids.sourceRequestId,
      textMode: 'source',
    },
    ingest: {
      chunks,
      metadata: { type: 'pdf' },
      rawHash: args.contentHash,
    },
    buffer: args.buffer,
    contentHash: args.contentHash,
    extractionDigest: args.extractionDigest,
    ids: args.ids,
    sourceStatus: 'ready',
    persistStatus,
    coverage: args.coverage,
    storagePath: persisted.ok ? persisted.storagePath : args.storagePath,
    sourceMeta: pdfSourceMetaFromCoverage({
      sourceId: args.ids.sourceId,
      sourceVersionId: args.ids.sourceVersionId,
      sourceRequestId: args.ids.sourceRequestId,
      sourceStatus: 'ready',
      persistStatus,
      contentHash: args.contentHash,
      extractionDigest: args.extractionDigest,
      segmentCount: args.segments.length,
      coverage: args.coverage,
      storagePath: persisted.ok ? persisted.storagePath : args.storagePath,
      ...(persistFailureCode ? { persistFailureCode } : {}),
    }),
  };
}

// Keep pdfIngestor import for factory parity (side-effect free).
void pdfIngestor;
