/** Canonical citable chunk produced by IngestorFactory (ADR-002). */

export type SourceChunkLoc = {
  chapterTitle?: string;
  chapterIndex?: number;
  page?: number;
  timestamp?: number;
  imageId?: string;
  bbox?: { x: number; y: number; w: number; h: number };
  /** Char offset within the linear source text (or chapter text for books). */
  start: number;
  end: number;
};

export type SourceChunk = {
  id: string;
  text: string;
  loc: SourceChunkLoc;
  hash: string;
};

/**
 * Verifiable citation attached to a Núcleo after generation.
 * `loc` and `label` are always derived from the original SourceChunk on the
 * server — never from the model — so they cannot be hallucinated.
 */
export type Citation = {
  id: string;
  chunkId: string;
  loc: SourceChunkLoc;
  /** Short chip label: `p.23`, `Cap. 2`, `Foto`, or `Fuente`. */
  label: string;
};

export type ChapterMeta = {
  title: string;
  index: number;
  chunkIds: string[];
};

/** Max cited chunks persisted with a Núcleo (keeps sync payloads small). */
export const MAX_CITED_CHUNKS = 40;

export type IngestResult = {
  chunks: SourceChunk[];
  chapters?: ChapterMeta[];
  metadata: {
    type: string;
    title?: string;
    cover?: string;
    /** S08 PDF coverage status when type=pdf. */
    pdfCoverage?: string;
    pdfPageCount?: string;
    pdfTextualPages?: string;
    pdfExtractionDigest?: string;
    pdfLimitations?: string;
    pdfCoverageSummary?: string;
    pdfSchemaVersion?: string;
    pdfExtractorVersion?: string;
  };
  rawHash: string;
  /**
   * No citable text was recovered, so the chunks carry no source content.
   * Callers should route the original bytes to the multimodal path instead.
   * S08 PDF must NOT set this for scanned/empty — those are hard errors.
   */
  needsVisionFallback?: boolean;
};

/** Free-question lane (no chunks, no citation validator). */
export type AskIngestResult = {
  isAsk: true;
  answer: string;
  disclaimer: "Conocimiento general, sin fuente verificada";
  cta: { label: "Añadir fuente para verificar"; action: "attach_source" };
};

export const CHUNK_SIZE = 500;
export const CHUNK_OVERLAP = 60;
export const MAX_BOOK_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ASK_TEXT_MAX_CHARS = 200;
export const OVERVIEW_CHAPTER_THRESHOLD = 10;
