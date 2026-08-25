/**
 * Domain contracts for Source / Segment / Anchor / Coverage / Evidence.
 *
 * Isolated from ActionMapData runtime shapes. Use adapters.ts to bridge
 * SourceChunk, Citation, and map Coverage — do not duplicate pipeline state.
 *
 * Honesty rules:
 * - Do not invent coverage ratios, completeness, or extraction confidence.
 * - A Citation proves chunk addressing, not entailment verification.
 * - Unknown measurements use null (or explicit "unknown" enums).
 */

export type SourceStatus =
  | 'received'
  | 'validating'
  | 'needs_input'
  | 'extracting'
  | 'ready'
  | 'partially_ready'
  | 'failed'
  | 'deleting'
  | 'deleted';

/** Includes image/video as honest kinds matching existing ingestors. */
export type NucleoSourceType =
  | 'pasted_text'
  | 'web_article'
  | 'pdf'
  | 'epub'
  | 'text_file'
  | 'docx'
  | 'youtube_transcript'
  | 'x_content'
  | 'image'
  | 'video';

export type VisualDependency = 'none' | 'low' | 'medium' | 'high' | 'unknown';

export type CoverageLimitation = {
  code: string;
  detail: string;
};

/**
 * Spec Coverage for sources — named SourceCoverage to avoid clashing with ActionMapData.Coverage.
 * `isComplete: null` means completeness is unknown (absence of warnings ≠ complete).
 */
export type SourceCoverage = {
  textual: number | null;
  extractionConfidence: number | null;
  visualDependency: VisualDependency;
  visualsAnalyzed: boolean;
  /** true | false when known; null when unknown. */
  isComplete: boolean | null;
  limitations: CoverageLimitation[];
};

export type BoundingBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SourceAnchor =
  | { type: 'paragraph'; paragraph: number }
  | { type: 'page'; page: number; box?: BoundingBox }
  | { type: 'chapter'; chapter: string; paragraph?: number }
  | { type: 'timestamp'; startSeconds: number; endSeconds?: number }
  | { type: 'post'; postId: string; url: string }
  | { type: 'line'; startLine: number; endLine?: number }
  | { type: 'char_range'; start: number; end: number };

export type SegmentKind = 'heading' | 'paragraph' | 'list' | 'table' | 'caption' | 'note' | 'chunk';

export type SourceSegment = {
  id: string;
  sourceId: string;
  ordinal: number;
  kind: SegmentKind;
  rawText: string;
  normalizedText: string;
  hierarchy: string[];
  anchor: SourceAnchor;
  /** null when the upstream pipeline did not measure confidence. */
  extractionConfidence: number | null;
  metadata: Record<string, unknown>;
};

export type NucleoSource = {
  id: string;
  ownerId: string;
  type: NucleoSourceType;
  title: string | null;
  creator: string | null;
  originalUrl: string | null;
  language: string | null;
  mimeType: string | null;
  contentHash: string;
  status: SourceStatus;
  coverage: SourceCoverage;
  createdAt: string;
  updatedAt: string;
};

export type EpistemicStatus =
  | 'direct_source'
  | 'faithful_paraphrase'
  | 'inference'
  | 'source_recommendation'
  | 'nucleo_adaptation'
  | 'insufficient_information';

export type EvidenceRelation = 'supports' | 'contradicts' | 'qualifies' | 'illustrates';

export type VerifierStatus = 'pending' | 'verified' | 'rejected' | 'uncertain';

export type EvidenceLink = {
  id: string;
  contentNodeId: string;
  segmentId: string;
  relation: EvidenceRelation;
  verifierStatus: VerifierStatus;
  /** null = confidence unknown (not yet verified). */
  confidence: number | null;
  /** Optional bridge to persisted Citation / chunk id. */
  chunkId?: string;
  epistemicStatus?: EpistemicStatus;
};

export type ValidationOk<T> = { ok: true; value: T };
export type ValidationFail = { ok: false; errors: string[] };
export type ValidationResult<T> = ValidationOk<T> | ValidationFail;

/** Metadata key storing the exact SourceChunkLoc for lossless round-trips. */
export const CHUNK_LOC_METADATA_KEY = 'chunkLoc';
