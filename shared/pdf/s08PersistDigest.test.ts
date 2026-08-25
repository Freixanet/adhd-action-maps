/**
 * Unit tests for PDF persist payload digest (TS mirror of SQL).
 */

import { describe, expect, it } from 'vitest';
import {
  canonicalizePdfPersistPayload,
  computePdfPersistPayloadDigest,
} from './persistDigest';
import type { PdfCoverage, PdfSegmentPayload } from './types';

const coverage: PdfCoverage = {
  pageCount: 2,
  textualPages: 2,
  emptyPages: 0,
  imageOnlyPages: 0,
  totalExtractedChars: 40,
  status: 'complete',
  affectedPages: [],
  limitations: [],
  summary: 'Texto nativo en 2/2 páginas.',
};

const segments: PdfSegmentPayload[] = [
  {
    ordinal: 0,
    kind: 'paragraph',
    raw_text: 'Hola mundo',
    normalized_text: 'hola mundo',
    chunk_id: 'pdf:abc:p1:0-10',
    anchor: { type: 'page_char_range', page: 1, start: 0, end: 10 },
  },
  {
    ordinal: 1,
    kind: 'paragraph',
    raw_text: 'Segunda',
    normalized_text: 'segunda',
    chunk_id: 'pdf:abc:p2:0-7',
    anchor: { type: 'page_char_range', page: 2, start: 0, end: 7 },
  },
];

const base = {
  sourceId: '11111111-1111-4111-8111-111111111111',
  sourceVersionId: '22222222-2222-4222-8222-222222222222',
  sourceRequestId: '33333333-3333-4333-8333-333333333333',
  contentHash: 'a'.repeat(64),
  extractionDigest: 'b'.repeat(64),
  pageCount: 2,
  byteSize: 1200,
  mimeType: 'application/pdf',
  title: 'Doc',
  coverage,
  segments,
};

describe('computePdfPersistPayloadDigest', () => {
  it('is stable for identical payloads', () => {
    const d1 = computePdfPersistPayloadDigest(base);
    const d2 = computePdfPersistPayloadDigest({ ...base, segments: [...segments] });
    expect(d1).toBe(d2);
    expect(d1).toMatch(/^[a-f0-9]{64}$/);
    expect(canonicalizePdfPersistPayload(base).endsWith('\n')).toBe(true);
  });

  it('changes when title or any authoritative field differs', () => {
    const d0 = computePdfPersistPayloadDigest(base);
    expect(computePdfPersistPayloadDigest({ ...base, title: 'Other' })).not.toBe(d0);
    expect(computePdfPersistPayloadDigest({ ...base, pageCount: 3 })).not.toBe(d0);
    expect(computePdfPersistPayloadDigest({ ...base, byteSize: 1201 })).not.toBe(d0);
    expect(
      computePdfPersistPayloadDigest({
        ...base,
        coverage: { ...coverage, status: 'partial' },
      })
    ).not.toBe(d0);
    expect(
      computePdfPersistPayloadDigest({
        ...base,
        segments: segments.map((s, i) =>
          i === 0 ? { ...s, normalized_text: `${s.normalized_text}x` } : s
        ),
      })
    ).not.toBe(d0);
  });
});
