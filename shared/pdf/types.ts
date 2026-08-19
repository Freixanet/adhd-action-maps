/**
 * S08 PDF native — typed results and error codes.
 */

import type { SourceChunk, SourceChunkLoc } from '../types/chunk';
import type { PastedTextPersistStatus, PastedTextSourceStatus } from '../pastedText';

export type PdfErrorCode =
  | 'PDF_EMPTY'
  | 'PDF_TOO_LARGE'
  | 'PDF_TOO_MANY_PAGES'
  | 'PDF_INVALID_SIGNATURE'
  | 'PDF_MIME_MISMATCH'
  | 'PDF_CORRUPT'
  | 'PDF_ENCRYPTED'
  | 'PDF_SCANNED'
  | 'PDF_INSUFFICIENT_TEXT'
  | 'PDF_CANCELLED'
  | 'PDF_EXTRACT_FAILED'
  | 'PDF_PERSIST_FAILED';

export type PdfLimitationCode =
  | 'tables_unparsed'
  | 'multi_column_order_uncertain'
  | 'formulas_as_text'
  | 'diagrams_not_interpreted'
  | 'images_not_ocr'
  | 'partial_text_only'
  | 'scanned_pages_present'
  | 'image_only_pages_present'
  | 'empty_pages_present'
  | 'reading_order_best_effort';

export type PdfPageKind = 'textual' | 'empty' | 'image_only';

export type PdfPageExtraction = {
  page: number; // 1..N
  text: string;
  /** Char count after canonicalize. */
  charCount: number;
  /** True when page has verifiable extractable text above threshold. */
  hasText: boolean;
  /** True when paint-image operators were observed (measured). */
  hasImages: boolean;
  /** Classification of the page. */
  kind: PdfPageKind;
  /**
   * Measured text-item geometries with offsets in `text` (pre-canonicalize join).
   * Used to compute per-chunk bbox — never invent page-wide regions for citations.
   */
  textItems?: import('./textItemBbox').PdfTextItemGeom[];
};

export type PdfCoverage = {
  pageCount: number;
  textualPages: number;
  emptyPages: number;
  imageOnlyPages: number;
  totalExtractedChars: number;
  status: 'complete' | 'partial' | 'scanned' | 'empty' | 'insufficient';
  /** 1-based page numbers that are empty or image-only. */
  affectedPages: number[];
  limitations: PdfLimitationCode[];
  summary: string;
};

export type PdfValidationOk = {
  ok: true;
  byteLength: number;
  declaredMime: string | null;
  sniffedMime: 'application/pdf';
  pdfVersion: string | null;
  looksEncrypted: boolean;
};

export type PdfValidationFail = {
  ok: false;
  code: PdfErrorCode;
  message: string;
};

export type PdfValidationResult = PdfValidationOk | PdfValidationFail;

export type PdfExtractOk = {
  ok: true;
  title: string | null;
  pages: PdfPageExtraction[];
  coverage: PdfCoverage;
  rawHash: string;
  extractionDigest: string;
  schemaVersion: string;
  extractorVersion: string;
  validatorVersion: string;
};

export type PdfExtractFail = {
  ok: false;
  code: PdfErrorCode;
  message: string;
  coverage?: PdfCoverage;
};

export type PdfExtractResult = PdfExtractOk | PdfExtractFail;

export type PdfSegment = SourceChunk & {
  loc: SourceChunkLoc & { page: number };
};

export type PdfIngestArtifact = {
  segments: PdfSegment[];
  coverage: PdfCoverage;
  title: string | null;
  rawHash: string;
  extractionDigest: string;
  pageCount: number;
};

/** Safe client metadata (no bytes / tokens). */
export type PdfSourceMeta = {
  kind: 'pdf';
  sourceId: string;
  sourceVersionId: string;
  sourceRequestId: string;
  sourceStatus: PastedTextSourceStatus;
  persistStatus: PastedTextPersistStatus;
  contentHash: string;
  extractionDigest: string;
  segmentCount: number;
  pageCount: number;
  textualPages: number;
  coverageStatus: PdfCoverage['status'];
  limitations: PdfLimitationCode[];
  coverageSummary: string;
  affectedPages: number[];
  storagePath?: string;
  /** SAFE machine code when persistStatus is sync_failed — never raw provider text. */
  persistFailureCode?: string;
  schemaVersion: string;
};

/** Segment payload for persist_pdf_source RPC (shared client/server). */
export type PdfSegmentPayload = {
  ordinal: number;
  kind: string;
  raw_text: string;
  normalized_text: string;
  chunk_id: string;
  anchor: {
    type: 'page_char_range';
    page: number;
    start: number;
    end: number;
  };
};

/** Client pending-queue / persist-only retry (no re-extract). */
export type PdfPersistRetryPayload = {
  segments: PdfSegmentPayload[];
  coverage: PdfCoverage;
  contentHash: string;
  extractionDigest: string;
  pageCount: number;
  storagePath?: string;
};
