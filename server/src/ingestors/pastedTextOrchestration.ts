/**
 * Shared pasted-text ingest + optional cloud persist orchestration (S03).
 * Used by /api/transform and /api/transform/stream so both routes stay in parity.
 */

import type { TransformRequest } from '../../../shared/contracts';
import type { IngestResult, SourceChunk } from '../../../shared/types/chunk';
import {
  canonicalizePastedText,
  createPastedTextOperationIds,
  parsePastedTextOperationIds,
  pastedTextErrorMessage,
  validatePastedText,
  type PastedTextOperationIds,
  type PastedTextPersistStatus,
  type PastedTextSourceMeta,
  type PastedTextSourceStatus,
} from '../../../shared/pastedText';
import { hashCanonicalPastedText } from '../../../shared/pastedTextHash';
import { labelledChunkText } from './chunkUtils';
import { textIngestor } from './textIngestor';
import { validateIngestChunks } from './validateChunks';
import { sanitizePersistFailureCode } from '../../../shared/persistFailureCodes';

export type PastedTextOrchestrationOk = {
  ok: true;
  body: TransformRequest;
  ingest: IngestResult;
  canonical: string;
  contentHash: string;
  ids: PastedTextOperationIds;
  sourceStatus: PastedTextSourceStatus;
  persistStatus: PastedTextPersistStatus;
  sourceMeta: PastedTextSourceMeta;
};

export type PastedTextOrchestrationFail = {
  ok: false;
  status: number;
  code: string;
  error: string;
};

export type PastedTextOrchestrationResult =
  | PastedTextOrchestrationOk
  | PastedTextOrchestrationFail;


function assertCanonicalSegmentAnchors(canonical: string, chunks: SourceChunk[]) {
  if (!chunks.length) {
    throw new Error('segments must be non-empty');
  }
  const seen = new Set<string>();
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]!;
    if (!chunk.id?.trim()) throw new Error(`chunk_id required at ${i}`);
    if (seen.has(chunk.id)) throw new Error(`duplicate chunk_id at ${i}`);
    seen.add(chunk.id);
    const { start, end } = chunk.loc;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      end > canonical.length
    ) {
      throw new Error(`anchor out of range at ${i}`);
    }
    if (canonical.slice(start, end) !== chunk.text) {
      throw new Error(`anchor/text mismatch at ${i}`);
    }
  }
}

function segmentsPayload(chunks: SourceChunk[]) {
  return chunks.map((chunk, ordinal) => ({
    ordinal,
    kind: 'chunk',
    raw_text: chunk.text,
    normalized_text: chunk.text,
    chunk_id: chunk.id,
    anchor: {
      type: 'char_range',
      start: chunk.loc.start,
      end: chunk.loc.end,
    },
  }));
}

export type PersistPastedTextFn = (args: {
  ids: PastedTextOperationIds;
  contentHash: string;
  rawText: string;
  title: string | undefined;
  segments: ReturnType<typeof segmentsPayload>;
}) => Promise<{ ok: true } | { ok: false; error: string }>;

/**
 * Validate → canonicalize → ingest → (optional) atomic persist.
 * Guest callers omit persistFn → persistStatus local.
 */
export async function orchestratePastedTextTransform(args: {
  body: TransformRequest;
  /** When provided (authenticated JWT-bound), persist source graph. */
  persistFn?: PersistPastedTextFn;
  /** Abort check — if true before persist, skip writes. */
  isCancelled?: () => boolean;
}): Promise<PastedTextOrchestrationResult> {
  const { body, persistFn, isCancelled } = args;
  const validation = validatePastedText(body.text ?? '');
  if (validation.ok === false) {
    return {
      ok: false,
      status: validation.code === 'TEXT_TOO_LARGE' ? 413 : 400,
      code: validation.code,
      error: pastedTextErrorMessage(validation.code),
    };
  }

  const parsed = parsePastedTextOperationIds(body);
  const minted = createPastedTextOperationIds();
  const ids: PastedTextOperationIds = parsed ?? {
    mapId: body.mapId?.trim() && body.mapId.trim() ? body.mapId.trim() : minted.mapId,
    sourceId: minted.sourceId,
    sourceVersionId: minted.sourceVersionId,
    sourceRequestId: minted.sourceRequestId,
  };

  if (isCancelled?.()) {
    return {
      ok: false,
      status: 499,
      code: 'CANCELLED',
      error: 'Creación cancelada',
    };
  }

  const canonical = validation.canonical;
  const contentHash = hashCanonicalPastedText(canonical);
  const ingest = await textIngestor.ingest({ text: canonical });
  validateIngestChunks(ingest);
  assertCanonicalSegmentAnchors(canonical, ingest.chunks);

  // Hash must match the exact canonical string we persist / segment.
  if (ingest.rawHash !== contentHash) {
    ingest.rawHash = contentHash;
  }

  let persistStatus: PastedTextPersistStatus = persistFn ? 'syncing' : 'local';
  let sourceStatus: PastedTextSourceStatus = 'ready';
  let persistFailureCode: string | undefined;

  if (persistFn) {
    if (isCancelled?.()) {
      return {
        ok: false,
        status: 499,
        code: 'CANCELLED',
        error: 'Creación cancelada',
      };
    }
    const persisted = await persistFn({
      ids,
      contentHash,
      rawText: canonical,
      title: body.sourceLabel,
      segments: segmentsPayload(ingest.chunks),
    });
    if (persisted.ok === false) {
      persistStatus = 'sync_failed';
      // Source graph failed — generation may still proceed; surface sync_failed.
      persistFailureCode = sanitizePersistFailureCode(persisted.error);
    } else {
      persistStatus = 'cloud';
    }
  }

  const labelled = labelledChunkText(ingest.chunks);
  const nextBody: TransformRequest = {
    ...body,
    type: 'text',
    text: labelled,
    textMode: 'source',
    mapId: ids.mapId,
    sourceId: ids.sourceId,
    sourceVersionId: ids.sourceVersionId,
    sourceRequestId: ids.sourceRequestId,
  };

  return {
    ok: true,
    body: nextBody,
    ingest,
    canonical,
    contentHash,
    ids,
    sourceStatus,
    persistStatus,
    sourceMeta: {
      sourceId: ids.sourceId,
      sourceVersionId: ids.sourceVersionId,
      sourceRequestId: ids.sourceRequestId,
      sourceStatus,
      persistStatus,
      contentHash,
      segmentCount: ingest.chunks.length,
      ...(persistFailureCode ? { persistFailureCode } : {}),
    },
  };
}

/** Re-export for tests. */
export { canonicalizePastedText, segmentsPayload };

/**
 * Persist-only retry: canon → deterministic segments → RPC.
 * No Gemini / no generation.
 */
export async function orchestratePastedTextPersistOnly(args: {
  text: string;
  ids: PastedTextOperationIds;
  title?: string;
  persistFn: PersistPastedTextFn;
  isCancelled?: () => boolean;
}): Promise<PastedTextOrchestrationResult> {
  const validation = validatePastedText(args.text);
  if (validation.ok === false) {
    return {
      ok: false,
      status: validation.code === 'TEXT_TOO_LARGE' ? 413 : 400,
      code: validation.code,
      error: pastedTextErrorMessage(validation.code),
    };
  }
  if (args.isCancelled?.()) {
    return { ok: false, status: 499, code: 'CANCELLED', error: 'Creación cancelada' };
  }

  const canonical = validation.canonical;
  const contentHash = hashCanonicalPastedText(canonical);
  const ingest = await textIngestor.ingest({ text: canonical });
  validateIngestChunks(ingest);
  assertCanonicalSegmentAnchors(canonical, ingest.chunks);
  if (ingest.rawHash !== contentHash) {
    ingest.rawHash = contentHash;
  }

  if (args.isCancelled?.()) {
    return { ok: false, status: 499, code: 'CANCELLED', error: 'Creación cancelada' };
  }

  const persisted = await args.persistFn({
    ids: args.ids,
    contentHash,
    rawText: canonical,
    title: args.title,
    segments: segmentsPayload(ingest.chunks),
  });

  const persistStatus: PastedTextPersistStatus = persisted.ok ? 'cloud' : 'sync_failed';
  const sourceStatus: PastedTextSourceStatus = 'ready';
  return {
    ok: true,
    body: {
      type: 'text',
      text: labelledChunkText(ingest.chunks),
      mapId: args.ids.mapId,
      sourceId: args.ids.sourceId,
      sourceVersionId: args.ids.sourceVersionId,
      sourceRequestId: args.ids.sourceRequestId,
      textMode: 'source',
    },
    ingest,
    canonical,
    contentHash,
    ids: args.ids,
    sourceStatus,
    persistStatus,
    sourceMeta: {
      sourceId: args.ids.sourceId,
      sourceVersionId: args.ids.sourceVersionId,
      sourceRequestId: args.ids.sourceRequestId,
      sourceStatus,
      persistStatus,
      contentHash,
      segmentCount: ingest.chunks.length,
    },
  };
}
