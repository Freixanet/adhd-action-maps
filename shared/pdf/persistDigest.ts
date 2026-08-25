/**
 * Canonical PDF persist payload digest — same string in TS and SQL.
 * Server/DB recomputes with pgcrypto; client digest is advisory (mismatch → reject).
 *
 * Contract (immutable for a source_request_id):
 * - sourceId, sourceVersionId, sourceRequestId
 * - contentHash, extractionDigest
 * - pageCount, byteSize, mimeType
 * - title (trimmed; empty → empty field) — part of the request identity
 * - coverage object fields in fixed key order
 * - every segment: ordinal|kind|raw|norm|chunk_id|anchor
 *
 * Any difference → conflict (not idempotent:true).
 */

import { sha256Hex } from '../sha256Hex';
import type { PdfCoverage, PdfSegmentPayload } from './types';

export type PdfPersistPayloadDigestInput = {
  sourceId: string;
  sourceVersionId: string;
  sourceRequestId: string;
  contentHash: string;
  extractionDigest: string;
  pageCount: number;
  byteSize: number;
  mimeType: string;
  title?: string | null;
  coverage: PdfCoverage;
  segments: PdfSegmentPayload[];
};

function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\|/g, '\\|');
}

function coverageLine(coverage: PdfCoverage): string {
  const lim = [...(coverage.limitations ?? [])].map(String).sort().join(',');
  const aff = [...(coverage.affectedPages ?? [])]
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .join(',');
  return [
    'COV',
    esc(String(coverage.pageCount)),
    esc(String(coverage.textualPages)),
    esc(String(coverage.emptyPages)),
    esc(String(coverage.imageOnlyPages)),
    esc(String(coverage.totalExtractedChars)),
    esc(coverage.status),
    esc(aff),
    esc(lim),
    esc(coverage.summary),
  ].join('|');
}

/**
 * Line-oriented canonical form (must match SQL pdf_persist_payload_canonical).
 */
export function canonicalizePdfPersistPayload(
  input: PdfPersistPayloadDigestInput
): string {
  const title = (input.title ?? '').trim();
  const lines: string[] = [
    `sourceId=${esc(input.sourceId)}`,
    `sourceVersionId=${esc(input.sourceVersionId)}`,
    `sourceRequestId=${esc(input.sourceRequestId)}`,
    `contentHash=${esc(input.contentHash)}`,
    `extractionDigest=${esc(input.extractionDigest)}`,
    `pageCount=${esc(String(input.pageCount))}`,
    `byteSize=${esc(String(input.byteSize))}`,
    `mimeType=${esc(input.mimeType || 'application/pdf')}`,
    `title=${esc(title)}`,
    coverageLine(input.coverage),
  ];

  const segments = [...input.segments].sort((a, b) => a.ordinal - b.ordinal);
  for (const s of segments) {
    lines.push(
      [
        'SEG',
        esc(String(s.ordinal)),
        esc(s.kind),
        esc(s.raw_text),
        esc(s.normalized_text),
        esc(s.chunk_id),
        esc(s.anchor.type),
        esc(String(s.anchor.page)),
        esc(String(s.anchor.start)),
        esc(String(s.anchor.end)),
      ].join('|')
    );
  }

  return `${lines.join('\n')}\n`;
}

/** Client-side mirror of DB digest — never authoritative alone. */
export function computePdfPersistPayloadDigest(
  input: PdfPersistPayloadDigestInput
): string {
  return sha256Hex(canonicalizePdfPersistPayload(input));
}
