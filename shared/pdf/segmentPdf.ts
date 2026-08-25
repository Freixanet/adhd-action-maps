/**
 * Stable PDF segments with page anchors. Offsets are within canonical page text.
 * Bbox is per-chunk from overlapping text items — never copies a page-wide box.
 */

import { sha256Hex } from '../sha256Hex';
import {
  canonicalizePastedText,
  canonicalizePastedTextWithMap,
  canonicalRangeToRawRange,
} from '../pastedText';
import { CHUNK_OVERLAP, CHUNK_SIZE, type SourceChunk } from '../types/chunk';
import type { PdfIngestArtifact, PdfPageExtraction, PdfSegment } from './types';
import type { PdfCoverage } from './types';
import { measureBboxForCharRange } from './textItemBbox';

function stableChunkId(parts: string[]): string {
  return `chunk_${sha256Hex(parts.join('\u0001')).slice(0, 16)}`;
}

/**
 * Segment one page's text into overlapping chunks with loc.page = pageNumber.
 * Loc offsets are canonical; bbox uses exact raw→canonical map for item overlap.
 */
export function segmentPdfPage(args: {
  page: PdfPageExtraction;
  rawHash: string;
  size?: number;
  overlap?: number;
}): PdfSegment[] {
  const size = args.size ?? CHUNK_SIZE;
  const overlap = args.overlap ?? CHUNK_OVERLAP;
  const rawText = args.page.text;
  const { text: cleaned, rawToCanonical } = canonicalizePastedTextWithMap(rawText);
  if (!cleaned || !args.page.hasText) return [];

  const out: PdfSegment[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + size, cleaned.length);
    const slice = cleaned.slice(start, end);
    const id = stableChunkId([
      'pdf',
      args.rawHash,
      String(args.page.page),
      String(start),
      String(end),
      slice,
    ]);
    const rawRange = canonicalRangeToRawRange(rawToCanonical, start, end);
    const bbox = rawRange
      ? measureBboxForCharRange(args.page.textItems, rawRange.start, rawRange.end)
      : undefined;
    const loc: PdfSegment['loc'] = {
      page: args.page.page,
      start,
      end,
      ...(bbox ? { bbox } : {}),
    };
    out.push({
      id,
      text: slice,
      hash: id.replace(/^chunk_/, ''),
      loc,
    });
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return out;
}

export function segmentPdfPages(args: {
  pages: PdfPageExtraction[];
  rawHash: string;
  coverage: PdfCoverage;
  title: string | null;
  extractionDigest: string;
}): PdfIngestArtifact {
  const segments: PdfSegment[] = [];
  for (const page of args.pages) {
    segments.push(...segmentPdfPage({ page, rawHash: args.rawHash }));
  }
  return {
    segments,
    coverage: args.coverage,
    title: args.title,
    rawHash: args.rawHash,
    extractionDigest: args.extractionDigest,
    pageCount: args.pages.length,
  };
}

/** Cross-page fragment: verify excerpt appears on declared page text. */
export function excerptExistsOnPage(
  pageText: string,
  excerpt: string
): boolean {
  const body = canonicalizePastedText(pageText);
  const q = canonicalizePastedText(excerpt);
  if (!q) return false;
  return body.toLowerCase().includes(q.toLowerCase());
}

export function asSourceChunks(segments: PdfSegment[]): SourceChunk[] {
  return segments.map((s) => ({
    id: s.id,
    text: s.text,
    hash: s.hash,
    loc: { ...s.loc },
  }));
}
