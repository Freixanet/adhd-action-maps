import { describe, expect, it } from 'vitest';
import {
  pdfViewerUriForPage,
  resolvePdfDocumentUrl,
} from './resolveDocumentUrl';

describe('resolvePdfDocumentUrl', () => {
  it('returns not_applicable without cloud storagePath', async () => {
    expect(
      await resolvePdfDocumentUrl({
        sourceMeta: { kind: 'pdf', persistStatus: 'local' },
        createSignedUrl: async () => ({ ok: true, url: 'https://x' }),
      })
    ).toEqual({ status: 'not_applicable' });
  });

  it('signs owned cloud path → ready', async () => {
    const createSignedUrl = async () => ({
      ok: true as const,
      url: 'https://signed.example/doc.pdf',
    });
    const result = await resolvePdfDocumentUrl({
      sourceMeta: {
        kind: 'pdf',
        sourceId: '11111111-1111-4111-8111-111111111111',
        sourceVersionId: '22222222-2222-4222-8222-222222222222',
        sourceRequestId: '33333333-3333-4333-8333-333333333333',
        sourceStatus: 'ready',
        persistStatus: 'cloud',
        contentHash: 'abc',
        extractionDigest: 'def',
        segmentCount: 1,
        pageCount: 2,
        textualPages: 2,
        coverageStatus: 'complete',
        limitations: [],
        coverageSummary: 'ok',
        affectedPages: [],
        storagePath: 'owner/src/doc.pdf',
        schemaVersion: 's08.pdf.v1',
      },
      createSignedUrl,
    });
    expect(result).toEqual({ status: 'ready', url: 'https://signed.example/doc.pdf' });
  });

  it('pdfViewerUriForPage appends #page=N (legacy helper)', () => {
    expect(pdfViewerUriForPage('https://x/doc.pdf', 3)).toBe('https://x/doc.pdf#page=3');
    expect(pdfViewerUriForPage('https://x/doc.pdf#page=1', 5)).toBe(
      'https://x/doc.pdf#page=5'
    );
    expect(pdfViewerUriForPage('https://x/doc.pdf', null)).toBe('https://x/doc.pdf');
  });
});
