import type {
  EpistemicStatus,
  EvidenceLink,
  EvidenceRelation,
  NucleoSource,
  NucleoSourceType,
  SegmentKind,
  SourceAnchor,
  SourceCoverage,
  SourceSegment,
  SourceStatus,
  ValidationResult,
  VerifierStatus,
  VisualDependency,
} from './types';
import type { SourceChunkLoc } from '../types/chunk';

const SOURCE_TYPES: readonly NucleoSourceType[] = [
  'pasted_text',
  'web_article',
  'pdf',
  'epub',
  'text_file',
  'docx',
  'youtube_transcript',
  'x_content',
  'image',
  'video',
] as const;

const SOURCE_STATUSES: readonly SourceStatus[] = [
  'received',
  'validating',
  'needs_input',
  'extracting',
  'ready',
  'partially_ready',
  'failed',
  'deleting',
  'deleted',
] as const;

const VISUAL_DEPS: readonly VisualDependency[] = [
  'none',
  'low',
  'medium',
  'high',
  'unknown',
] as const;

const SEGMENT_KINDS: readonly SegmentKind[] = [
  'heading',
  'paragraph',
  'list',
  'table',
  'caption',
  'note',
  'chunk',
] as const;

const EVIDENCE_RELATIONS: readonly EvidenceRelation[] = [
  'supports',
  'contradicts',
  'qualifies',
  'illustrates',
] as const;

const VERIFIER_STATUSES: readonly VerifierStatus[] = [
  'pending',
  'verified',
  'rejected',
  'uncertain',
] as const;

const EPISTEMIC_STATUSES: readonly EpistemicStatus[] = [
  'direct_source',
  'faithful_paraphrase',
  'inference',
  'source_recommendation',
  'nucleo_adaptation',
  'insufficient_information',
] as const;

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Non-negative integer (0, 1, 2, …) — char offsets, chapterIndex, ordinal. */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Positive integer (1, 2, …) — page, paragraph, line numbers. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isUnitIntervalOrNull(value: unknown): value is number | null {
  if (value === null) return true;
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function fail(errors: string[]): ValidationResult<never> {
  return { ok: false, errors };
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/**
 * Runtime validation for SourceChunkLoc.
 * Invariants confirmed from producers (chunkUtils, pdf/epub/image ingestors):
 * - start/end: non-negative integers, end >= start (string offsets from chunkText)
 * - page: positive integer when set (pdf: pageIndex+1)
 * - chapterIndex: non-negative integer when set (epub: 0-based)
 * - chapterTitle / imageId: non-empty strings when set
 * - timestamp: finite >= 0 (decimals allowed; no current ingest producer, YouTube-shaped)
 * - bbox: when present, full finite {x,y,w,h} with w>=0, h>=0 (no ingest producer yet;
 *   mapData passes through — we reject null/partial/non-finite)
 */
export function validateSourceChunkLoc(input: unknown): ValidationResult<SourceChunkLoc> {
  if (input === null || Array.isArray(input) || !isRecord(input)) {
    return fail(['chunkLoc: must be a plain object']);
  }

  const errors: string[] = [];
  if (!isNonNegativeInteger(input.start)) {
    errors.push('chunkLoc.start: non-negative integer required');
  }
  if (!isNonNegativeInteger(input.end)) {
    errors.push('chunkLoc.end: non-negative integer required');
  }
  if (
    isNonNegativeInteger(input.start) &&
    isNonNegativeInteger(input.end) &&
    input.end < input.start
  ) {
    errors.push('chunkLoc.end: must be >= start');
  }

  if (input.page !== undefined && !isPositiveInteger(input.page)) {
    errors.push('chunkLoc.page: positive integer when set');
  }
  if (input.chapterIndex !== undefined && !isNonNegativeInteger(input.chapterIndex)) {
    errors.push('chunkLoc.chapterIndex: non-negative integer when set');
  }
  if (input.timestamp !== undefined) {
    if (!isFiniteNumber(input.timestamp) || input.timestamp < 0) {
      errors.push('chunkLoc.timestamp: finite number >= 0 when set');
    }
  }
  if (input.chapterTitle !== undefined && !isNonEmptyString(input.chapterTitle)) {
    errors.push('chunkLoc.chapterTitle: non-empty string when set');
  }
  if (input.imageId !== undefined && !isNonEmptyString(input.imageId)) {
    errors.push('chunkLoc.imageId: non-empty string when set');
  }

  if (input.bbox !== undefined) {
    if (input.bbox === null || Array.isArray(input.bbox) || !isRecord(input.bbox)) {
      errors.push('chunkLoc.bbox: object required when set (not null/array)');
    } else {
      const { x, y, w, h } = input.bbox;
      if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) {
        errors.push('chunkLoc.bbox: x,y,w,h must be finite numbers');
      } else if (w < 0 || h < 0) {
        errors.push('chunkLoc.bbox: w and h must be >= 0');
      }
    }
  }

  if (errors.length) return fail(errors);

  const value: SourceChunkLoc = {
    start: input.start as number,
    end: input.end as number,
  };
  if (input.chapterTitle !== undefined) value.chapterTitle = String(input.chapterTitle);
  if (input.chapterIndex !== undefined) value.chapterIndex = input.chapterIndex as number;
  if (input.page !== undefined) value.page = input.page as number;
  if (input.timestamp !== undefined) value.timestamp = input.timestamp as number;
  if (input.imageId !== undefined) value.imageId = String(input.imageId);
  if (input.bbox !== undefined && isRecord(input.bbox)) {
    value.bbox = {
      x: input.bbox.x as number,
      y: input.bbox.y as number,
      w: input.bbox.w as number,
      h: input.bbox.h as number,
    };
  }
  return { ok: true, value };
}

export function validateSourceCoverage(input: unknown): ValidationResult<SourceCoverage> {
  if (!isRecord(input)) return fail(['coverage: must be an object']);
  const errors: string[] = [];

  if (!isUnitIntervalOrNull(input.textual)) {
    errors.push('coverage.textual: number 0..1 or null');
  }
  if (!isUnitIntervalOrNull(input.extractionConfidence)) {
    errors.push('coverage.extractionConfidence: number 0..1 or null');
  }
  if (!includes(VISUAL_DEPS, input.visualDependency)) {
    errors.push('coverage.visualDependency: invalid');
  }
  if (typeof input.visualsAnalyzed !== 'boolean') {
    errors.push('coverage.visualsAnalyzed: boolean required');
  }
  if (!(input.isComplete === null || typeof input.isComplete === 'boolean')) {
    errors.push('coverage.isComplete: boolean or null (null = unknown)');
  }
  if (!Array.isArray(input.limitations)) {
    errors.push('coverage.limitations: array required');
  } else {
    input.limitations.forEach((item, index) => {
      if (!isRecord(item) || !isNonEmptyString(item.code) || !isNonEmptyString(item.detail)) {
        errors.push(`coverage.limitations[${index}]: { code, detail } strings required`);
      }
    });
  }

  if (errors.length) return fail(errors);
  return {
    ok: true,
    value: {
      textual: input.textual as number | null,
      extractionConfidence: input.extractionConfidence as number | null,
      visualDependency: input.visualDependency as VisualDependency,
      visualsAnalyzed: input.visualsAnalyzed as boolean,
      isComplete: input.isComplete as boolean | null,
      limitations: (input.limitations as { code: string; detail: string }[]).map((item) => ({
        code: String(item.code),
        detail: String(item.detail),
      })),
    },
  };
}

export function validateSourceAnchor(input: unknown): ValidationResult<SourceAnchor> {
  if (!isRecord(input) || typeof input.type !== 'string') {
    return fail(['anchor: object with type required']);
  }

  switch (input.type) {
    case 'paragraph':
      if (!isPositiveInteger(input.paragraph)) {
        return fail(['anchor.paragraph: positive integer required']);
      }
      return { ok: true, value: { type: 'paragraph', paragraph: input.paragraph } };
    case 'page': {
      if (!isPositiveInteger(input.page)) {
        return fail(['anchor.page: positive integer required']);
      }
      const box = input.box;
      if (box !== undefined) {
        if (box === null || Array.isArray(box) || !isRecord(box)) {
          return fail(['anchor.box: object required when set']);
        }
        if (
          !isFiniteNumber(box.x) ||
          !isFiniteNumber(box.y) ||
          !isFiniteNumber(box.w) ||
          !isFiniteNumber(box.h) ||
          box.w < 0 ||
          box.h < 0
        ) {
          return fail(['anchor.box: finite x,y,w,h with w,h >= 0']);
        }
        return {
          ok: true,
          value: {
            type: 'page',
            page: input.page,
            box: { x: box.x, y: box.y, w: box.w, h: box.h },
          },
        };
      }
      return { ok: true, value: { type: 'page', page: input.page } };
    }
    case 'chapter':
      if (!isNonEmptyString(input.chapter)) {
        return fail(['anchor.chapter: non-empty string required']);
      }
      if (input.paragraph !== undefined && !isPositiveInteger(input.paragraph)) {
        return fail(['anchor.paragraph: positive integer when set']);
      }
      return {
        ok: true,
        value: {
          type: 'chapter',
          chapter: input.chapter.trim(),
          ...(input.paragraph !== undefined ? { paragraph: input.paragraph as number } : {}),
        },
      };
    case 'timestamp':
      if (!isFiniteNumber(input.startSeconds) || input.startSeconds < 0) {
        return fail(['anchor.startSeconds: finite number >= 0 required']);
      }
      if (
        input.endSeconds !== undefined &&
        (!isFiniteNumber(input.endSeconds) || input.endSeconds < input.startSeconds)
      ) {
        return fail(['anchor.endSeconds: must be >= startSeconds']);
      }
      return {
        ok: true,
        value: {
          type: 'timestamp',
          startSeconds: input.startSeconds,
          ...(input.endSeconds !== undefined ? { endSeconds: input.endSeconds as number } : {}),
        },
      };
    case 'post':
      if (!isNonEmptyString(input.postId) || !isNonEmptyString(input.url)) {
        return fail(['anchor.post: postId and url required']);
      }
      return {
        ok: true,
        value: { type: 'post', postId: input.postId.trim(), url: input.url.trim() },
      };
    case 'line':
      if (!isPositiveInteger(input.startLine)) {
        return fail(['anchor.startLine: positive integer required']);
      }
      if (input.endLine !== undefined) {
        if (!isPositiveInteger(input.endLine) || input.endLine < input.startLine) {
          return fail(['anchor.endLine: positive integer >= startLine when set']);
        }
      }
      return {
        ok: true,
        value: {
          type: 'line',
          startLine: input.startLine,
          ...(input.endLine !== undefined ? { endLine: input.endLine as number } : {}),
        },
      };
    case 'char_range':
      if (!isNonNegativeInteger(input.start) || !isNonNegativeInteger(input.end)) {
        return fail(['anchor.char_range: start/end non-negative integers required']);
      }
      if (input.end < input.start) {
        return fail(['anchor.char_range: end must be >= start']);
      }
      return { ok: true, value: { type: 'char_range', start: input.start, end: input.end } };
    default:
      return fail([`anchor.type: unsupported "${String(input.type)}"`]);
  }
}

export function validateSourceSegment(input: unknown): ValidationResult<SourceSegment> {
  if (!isRecord(input)) return fail(['segment: must be an object']);
  const errors: string[] = [];

  if (!isNonEmptyString(input.id)) errors.push('segment.id: required');
  if (!isNonEmptyString(input.sourceId)) errors.push('segment.sourceId: required');
  if (!isNonNegativeInteger(input.ordinal)) {
    errors.push('segment.ordinal: non-negative integer required');
  }
  if (!includes(SEGMENT_KINDS, input.kind)) errors.push('segment.kind: invalid');
  if (typeof input.rawText !== 'string' || !input.rawText.trim()) {
    errors.push('segment.rawText: non-empty string required');
  }
  if (typeof input.normalizedText !== 'string' || !input.normalizedText.trim()) {
    errors.push('segment.normalizedText: non-empty string required');
  }
  if (!Array.isArray(input.hierarchy) || !input.hierarchy.every((h) => typeof h === 'string')) {
    errors.push('segment.hierarchy: string[] required');
  }
  if (!isUnitIntervalOrNull(input.extractionConfidence)) {
    errors.push('segment.extractionConfidence: number 0..1 or null');
  }
  if (!isRecord(input.metadata)) errors.push('segment.metadata: object required');

  let anchor: SourceAnchor | undefined;
  const anchorResult = validateSourceAnchor(input.anchor);
  if (anchorResult.ok === false) {
    errors.push(...anchorResult.errors);
  } else {
    anchor = anchorResult.value;
  }

  if (errors.length || !anchor) return fail(errors.length ? errors : ['segment.anchor: required']);
  return {
    ok: true,
    value: {
      id: String(input.id).trim(),
      sourceId: String(input.sourceId).trim(),
      ordinal: input.ordinal as number,
      kind: input.kind as SegmentKind,
      rawText: String(input.rawText),
      normalizedText: String(input.normalizedText),
      hierarchy: (input.hierarchy as string[]).map(String),
      anchor,
      extractionConfidence: input.extractionConfidence as number | null,
      metadata: { ...(input.metadata as Record<string, unknown>) },
    },
  };
}

export function validateNucleoSource(input: unknown): ValidationResult<NucleoSource> {
  if (!isRecord(input)) return fail(['source: must be an object']);
  const errors: string[] = [];

  if (!isNonEmptyString(input.id)) errors.push('source.id: required');
  if (!isNonEmptyString(input.ownerId)) errors.push('source.ownerId: required');
  if (!includes(SOURCE_TYPES, input.type)) errors.push('source.type: invalid');
  if (!isStringOrNull(input.title)) errors.push('source.title: string or null');
  if (!isStringOrNull(input.creator)) errors.push('source.creator: string or null');
  if (!isStringOrNull(input.originalUrl)) errors.push('source.originalUrl: string or null');
  if (!isStringOrNull(input.language)) errors.push('source.language: string or null');
  if (!isStringOrNull(input.mimeType)) errors.push('source.mimeType: string or null');
  if (!isNonEmptyString(input.contentHash)) errors.push('source.contentHash: required');
  if (!includes(SOURCE_STATUSES, input.status)) errors.push('source.status: invalid');
  if (!isNonEmptyString(input.createdAt)) errors.push('source.createdAt: required');
  if (!isNonEmptyString(input.updatedAt)) errors.push('source.updatedAt: required');

  let coverage: SourceCoverage | undefined;
  const coverageResult = validateSourceCoverage(input.coverage);
  if (coverageResult.ok === false) {
    errors.push(...coverageResult.errors);
  } else {
    coverage = coverageResult.value;
  }

  if (errors.length || !coverage) return fail(errors.length ? errors : ['source.coverage: required']);
  return {
    ok: true,
    value: {
      id: String(input.id).trim(),
      ownerId: String(input.ownerId).trim(),
      type: input.type as NucleoSourceType,
      title: input.title as string | null,
      creator: input.creator as string | null,
      originalUrl: input.originalUrl as string | null,
      language: input.language as string | null,
      mimeType: input.mimeType as string | null,
      contentHash: String(input.contentHash).trim(),
      status: input.status as SourceStatus,
      coverage,
      createdAt: String(input.createdAt),
      updatedAt: String(input.updatedAt),
    },
  };
}

export function validateEvidenceLink(input: unknown): ValidationResult<EvidenceLink> {
  if (!isRecord(input)) return fail(['evidence: must be an object']);
  const errors: string[] = [];

  if (!isNonEmptyString(input.id)) errors.push('evidence.id: required');
  if (!isNonEmptyString(input.contentNodeId)) errors.push('evidence.contentNodeId: required');
  if (!isNonEmptyString(input.segmentId)) errors.push('evidence.segmentId: required');
  if (!includes(EVIDENCE_RELATIONS, input.relation)) errors.push('evidence.relation: invalid');
  if (!includes(VERIFIER_STATUSES, input.verifierStatus)) {
    errors.push('evidence.verifierStatus: invalid');
  }
  if (!isUnitIntervalOrNull(input.confidence)) {
    errors.push('evidence.confidence: number 0..1 or null (null = unknown)');
  }
  if (input.chunkId !== undefined && !isNonEmptyString(input.chunkId)) {
    errors.push('evidence.chunkId: non-empty string when set');
  }
  if (input.epistemicStatus !== undefined && !includes(EPISTEMIC_STATUSES, input.epistemicStatus)) {
    errors.push('evidence.epistemicStatus: invalid');
  }

  if (errors.length) return fail(errors);
  return {
    ok: true,
    value: {
      id: String(input.id).trim(),
      contentNodeId: String(input.contentNodeId).trim(),
      segmentId: String(input.segmentId).trim(),
      relation: input.relation as EvidenceRelation,
      verifierStatus: input.verifierStatus as VerifierStatus,
      confidence: input.confidence as number | null,
      ...(input.chunkId !== undefined ? { chunkId: String(input.chunkId).trim() } : {}),
      ...(input.epistemicStatus !== undefined
        ? { epistemicStatus: input.epistemicStatus as EpistemicStatus }
        : {}),
    },
  };
}
