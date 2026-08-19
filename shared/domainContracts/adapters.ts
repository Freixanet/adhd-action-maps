/**
 * Explicit bridges between domain contracts and existing runtime shapes.
 * Does not mutate ActionMapData / SourceChunk pipelines — pure mapping only.
 *
 * Honesty: never invent coverage ratios, completeness, verification, or offsets.
 */

import type { Coverage as MapCoverage, SourceKind, SourceMetadata } from '../contracts';
import type { Citation, SourceChunk, SourceChunkLoc } from '../types/chunk';
import type {
  EvidenceLink,
  NucleoSource,
  NucleoSourceType,
  SourceAnchor,
  SourceCoverage,
  SourceSegment,
  SourceStatus,
} from './types';
import { CHUNK_LOC_METADATA_KEY } from './types';
import {
  validateEvidenceLink,
  validateNucleoSource,
  validateSourceChunkLoc,
  validateSourceSegment,
} from './validate';

export type AdapterResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

function ok<T>(value: T): AdapterResult<T> {
  return { ok: true, value };
}

function fail(errors: string[]): AdapterResult<never> {
  return { ok: false, errors };
}

function cloneChunkLoc(loc: SourceChunkLoc): SourceChunkLoc {
  return {
    start: loc.start,
    end: loc.end,
    ...(loc.chapterTitle !== undefined ? { chapterTitle: loc.chapterTitle } : {}),
    ...(loc.chapterIndex !== undefined ? { chapterIndex: loc.chapterIndex } : {}),
    ...(loc.page !== undefined ? { page: loc.page } : {}),
    ...(loc.timestamp !== undefined ? { timestamp: loc.timestamp } : {}),
    ...(loc.imageId !== undefined ? { imageId: loc.imageId } : {}),
    ...(loc.bbox !== undefined ? { bbox: { ...loc.bbox } } : {}),
  };
}

/**
 * Map ingest SourceKind onto domain NucleoSourceType.
 * image/video map to honest kinds; unknown kinds fail explicitly.
 */
export function nucleoSourceTypeFromKind(
  kind: SourceKind | string | undefined,
  options?: { url?: string; contentKind?: string }
): AdapterResult<NucleoSourceType> {
  const url = options?.url ?? '';
  if (kind === 'youtube' || /youtu\.?be/i.test(url)) return ok('youtube_transcript');
  if (kind === 'pdf') return ok('pdf');
  if (kind === 'epub') return ok('epub');
  if (kind === 'docx') return ok('docx');
  if (kind === 'link') return ok('web_article');
  if (kind === 'image') return ok('image');
  if (kind === 'video') return ok('video');
  if (kind === 'file') return ok('text_file');
  if (kind === 'text') {
    const ck = options?.contentKind;
    if (ck === 'notes' || ck === 'other') return ok('text_file');
    return ok('pasted_text');
  }
  return fail([`source.kind: unsupported or unknown "${String(kind)}"`]);
}

/**
 * Build a domain Source from ActionMapData.sourceMetadata + identity fields.
 * Coverage measurements stay null/unknown unless a real value is supplied.
 */
export function nucleoSourceFromMapMetadata(
  metadata: SourceMetadata | undefined,
  identity: {
    id: string;
    ownerId: string;
    contentHash: string;
    status?: SourceStatus;
    createdAt?: string;
    updatedAt?: string;
    mapCoverage?: MapCoverage;
  }
): AdapterResult<NucleoSource> {
  const now = new Date().toISOString();
  const typeResult = nucleoSourceTypeFromKind(metadata?.kind, {
    url: metadata?.url,
    contentKind: metadata?.contentKind,
  });
  if (typeResult.ok === false) return fail(typeResult.errors);

  const limitations =
    metadata?.limitations?.map((detail, index) => ({
      code: `meta_limit_${index + 1}`,
      detail: String(detail),
    })) ?? [];

  const mapNotes = identity.mapCoverage?.notes ?? [];
  for (const note of mapNotes) {
    limitations.push({
      code: note.tone === 'warning' ? 'map_warning' : 'map_note',
      detail: `${note.label}: ${note.detail}`,
    });
  }

  if (identity.mapCoverage?.summary?.trim()) {
    limitations.unshift({
      code: 'map_summary',
      detail: identity.mapCoverage.summary.trim(),
    });
  }

  const coverage: SourceCoverage = {
    textual: null,
    extractionConfidence: null,
    visualDependency: 'unknown',
    visualsAnalyzed: false,
    isComplete: null,
    limitations,
  };

  return validateNucleoSource({
    id: identity.id,
    ownerId: identity.ownerId,
    type: typeResult.value,
    title: metadata?.title ?? metadata?.label ?? null,
    creator: metadata?.author ?? null,
    originalUrl: metadata?.url ?? null,
    language: metadata?.language ?? null,
    mimeType: null,
    contentHash: identity.contentHash,
    status: identity.status ?? 'ready',
    coverage,
    createdAt: identity.createdAt ?? now,
    updatedAt: identity.updatedAt ?? now,
  });
}

/** MapCoverage (ActionMapData) → SourceCoverage. Never invents ratios or completeness. */
export function sourceCoverageFromMapCoverage(mapCoverage: MapCoverage | undefined): SourceCoverage {
  const limitations =
    mapCoverage?.notes?.map((note) => ({
      code: note.tone === 'warning' ? 'map_warning' : 'map_note',
      detail: `${note.label}: ${note.detail}`,
    })) ?? [];

  if (mapCoverage?.summary?.trim()) {
    limitations.unshift({ code: 'map_summary', detail: mapCoverage.summary.trim() });
  }

  return {
    textual: null,
    extractionConfidence: null,
    visualDependency: 'unknown',
    visualsAnalyzed: false,
    isComplete: null,
    limitations,
  };
}

/** SourceCoverage → MapCoverage (lossy). Does not invent completeness claims. */
export function mapCoverageFromSourceCoverage(coverage: SourceCoverage): MapCoverage {
  const notes = coverage.limitations
    .filter((item) => item.code !== 'map_summary')
    .map((item) => ({
      label: item.code,
      detail: item.detail,
      tone: item.code === 'map_warning' ? ('warning' as const) : ('neutral' as const),
    }));

  const summaryNote = coverage.limitations.find((item) => item.code === 'map_summary');
  let summary = summaryNote?.detail;
  if (!summary) {
    if (coverage.isComplete === true) {
      summary = 'Cobertura marcada como completa.';
    } else if (coverage.isComplete === false) {
      summary = 'Cobertura marcada como incompleta.';
    } else {
      summary = 'Completitud de cobertura desconocida.';
    }
  }

  return { summary, notes };
}

/** Prefer chapter/page/timestamp when present; else char_range from loc offsets. */
export function sourceAnchorFromChunkLoc(loc: SourceChunkLoc): SourceAnchor {
  if (typeof loc.timestamp === 'number' && Number.isFinite(loc.timestamp)) {
    return { type: 'timestamp', startSeconds: loc.timestamp };
  }
  if (typeof loc.page === 'number' && loc.page >= 1) {
    if (loc.bbox) {
      return {
        type: 'page',
        page: loc.page,
        box: { x: loc.bbox.x, y: loc.bbox.y, w: loc.bbox.w, h: loc.bbox.h },
      };
    }
    return { type: 'page', page: loc.page };
  }
  if (loc.chapterTitle?.trim()) {
    return { type: 'chapter', chapter: loc.chapterTitle.trim() };
  }
  return { type: 'char_range', start: loc.start, end: loc.end };
}

/**
 * Rebuild loc from anchor + explicit offsets only.
 * Offsets must be non-negative integers with end >= start (same as chunkText).
 */
export function chunkLocFromSourceAnchor(
  anchor: SourceAnchor,
  offsets: { start: number; end: number }
): AdapterResult<SourceChunkLoc> {
  if (
    !Number.isInteger(offsets.start) ||
    offsets.start < 0 ||
    !Number.isInteger(offsets.end) ||
    offsets.end < 0
  ) {
    return fail(['offsets: start/end must be non-negative integers']);
  }
  if (offsets.end < offsets.start) {
    return fail(['offsets: end must be >= start']);
  }

  const base: SourceChunkLoc = { start: offsets.start, end: offsets.end };
  let loc: SourceChunkLoc;
  switch (anchor.type) {
    case 'page':
      loc = {
        ...base,
        page: anchor.page,
        ...(anchor.box ? { bbox: { ...anchor.box } } : {}),
      };
      break;
    case 'chapter':
      loc = { ...base, chapterTitle: anchor.chapter };
      break;
    case 'timestamp':
      loc = { ...base, timestamp: anchor.startSeconds };
      break;
    case 'char_range':
      loc = { start: anchor.start, end: anchor.end };
      break;
    default:
      loc = base;
  }

  const validated = validateSourceChunkLoc(loc);
  if (validated.ok === false) return fail(validated.errors);
  return ok(validated.value);
}

export function sourceSegmentFromChunk(
  chunk: SourceChunk,
  sourceId: string,
  ordinal: number
): AdapterResult<SourceSegment> {
  const text = chunk.text?.trim();
  if (!text) return fail(['chunk.text: empty']);
  if (!chunk.id?.trim()) return fail(['chunk.id: required']);

  const locResult = validateSourceChunkLoc(chunk.loc);
  if (locResult.ok === false) return fail(locResult.errors);

  const hierarchy =
    locResult.value.chapterTitle?.trim() != null && locResult.value.chapterTitle.trim() !== ''
      ? [locResult.value.chapterTitle.trim()]
      : [];

  return validateSourceSegment({
    id: chunk.id,
    sourceId,
    ordinal,
    kind: 'chunk',
    rawText: chunk.text,
    normalizedText: text,
    hierarchy,
    anchor: sourceAnchorFromChunkLoc(locResult.value),
    extractionConfidence: null,
    metadata: {
      hash: chunk.hash,
      chunkId: chunk.id,
      [CHUNK_LOC_METADATA_KEY]: cloneChunkLoc(locResult.value),
    },
  });
}

export function sourceChunkFromSegment(segment: SourceSegment): AdapterResult<SourceChunk> {
  const validated = validateSourceSegment(segment);
  if (validated.ok === false) return fail(validated.errors);

  const value = validated.value;
  const storedLoc = value.metadata[CHUNK_LOC_METADATA_KEY];
  const locResult = validateSourceChunkLoc(storedLoc);
  if (locResult.ok === false) {
    return fail(
      locResult.errors.map((err) =>
        err.startsWith('chunkLoc')
          ? err.replace(/^chunkLoc/, `segment.metadata.${CHUNK_LOC_METADATA_KEY}`)
          : `segment.metadata.${CHUNK_LOC_METADATA_KEY}: ${err}`
      )
    );
  }

  const hash =
    typeof value.metadata.hash === 'string' && value.metadata.hash.trim()
      ? String(value.metadata.hash)
      : undefined;
  if (!hash) {
    return fail(['segment.metadata.hash: required for SourceChunk round-trip']);
  }

  return ok({
    id: value.id,
    text: value.rawText,
    loc: cloneChunkLoc(locResult.value),
    hash,
  });
}

/**
 * Citation → EvidenceLink.
 * A citation validates chunk addressing only — not entailment.
 * Defaults: verifierStatus pending, confidence null (unknown).
 */
export function evidenceLinkFromCitation(
  citation: Citation,
  contentNodeId: string
): AdapterResult<EvidenceLink> {
  if (!citation?.id?.trim()) return fail(['citation.id: required']);
  if (!citation.chunkId?.trim()) return fail(['citation.chunkId: required']);
  if (!contentNodeId?.trim()) return fail(['contentNodeId: required']);

  return validateEvidenceLink({
    id: `ev:${citation.id}`,
    contentNodeId: contentNodeId.trim(),
    segmentId: citation.chunkId.trim(),
    relation: 'supports',
    verifierStatus: 'pending',
    confidence: null,
    chunkId: citation.chunkId.trim(),
  });
}

/** EvidenceLink → Citation-shaped payload (label/loc must be supplied from the chunk). */
export function citationDraftFromEvidenceLink(
  evidence: EvidenceLink,
  locAndLabel: { loc: SourceChunkLoc; label: string }
): AdapterResult<Citation> {
  const validated = validateEvidenceLink(evidence);
  if (validated.ok === false) return fail(validated.errors);
  const chunkId = validated.value.chunkId ?? validated.value.segmentId;
  if (!chunkId) return fail(['evidence: chunkId or segmentId required for citation']);
  if (!locAndLabel.label?.trim()) return fail(['label: required']);

  return ok({
    id: validated.value.id.replace(/^ev:/, '') || validated.value.id,
    chunkId,
    loc: locAndLabel.loc,
    label: locAndLabel.label.trim(),
  });
}
