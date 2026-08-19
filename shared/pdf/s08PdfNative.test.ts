/**
 * S08 PDF native — unit + productive ingest tests (no Gemini).
 */

import { describe, expect, it } from 'vitest';
import {
  assessPdfCoverage,
  excerptExistsOnPage,
  segmentPdfPages,
  sniffPdfMagic,
  validatePdfBuffer,
  looksEncryptedPdf,
  MAX_PDF_BYTES,
} from './index';
import {
  fixtureCorruptPdf,
  fixtureEmptyPagePdf,
  fixtureEncryptedPdf,
  fixtureFakeMimeBytes,
  fixtureMultipagePdf,
  fixtureTextualPdf,
  fixtureUnicodePdf,
} from './fixtures';
import { extractPdfNative } from '../../server/src/ingestors/pdfExtractNative';
import { pdfIngestor } from '../../server/src/ingestors/pdfIngestor';
import { prepareTransformIngest } from '../../server/src/routes/transformIngest';
import type { TransformRequest } from '../contracts';
import { pageHasVerifiableText } from './coverage';

describe('S08 validatePdf', () => {
  it('accepts real PDF magic and rejects fake MIME body', async () => {
    const real = await fixtureTextualPdf();
    expect(sniffPdfMagic(real)).toBe(true);
    const ok = validatePdfBuffer({
      buffer: real,
      declaredMime: 'application/pdf',
      fileName: 'doc.pdf',
    });
    expect(ok.ok).toBe(true);

    const fake = fixtureFakeMimeBytes();
    expect(sniffPdfMagic(fake)).toBe(false);
    const bad = validatePdfBuffer({
      buffer: fake,
      declaredMime: 'application/pdf',
      fileName: 'doc.pdf',
    });
    expect(bad.ok).toBe(false);
    expect(bad).toMatchObject({ ok: false, code: 'PDF_INVALID_SIGNATURE' });
  });

  it('rejects MIME mismatch when bytes are PDF but declared is image', async () => {
    const real = await fixtureTextualPdf();
    const bad = validatePdfBuffer({
      buffer: real,
      declaredMime: 'image/png',
      fileName: 'x.png',
    });
    expect(bad.ok).toBe(false);
    expect(bad).toMatchObject({ ok: false, code: 'PDF_MIME_MISMATCH' });
  });

  it('rejects empty, oversized, encrypted, corrupt', () => {
    expect(validatePdfBuffer({ buffer: Buffer.alloc(0) }).ok).toBe(false);
    const huge = Buffer.alloc(MAX_PDF_BYTES + 1);
    huge.write('%PDF-1.4', 0, 'ascii');
    const over = validatePdfBuffer({ buffer: huge });
    expect(over.ok).toBe(false);
    expect(over).toMatchObject({ ok: false, code: 'PDF_TOO_LARGE' });

    const enc = fixtureEncryptedPdf();
    expect(looksEncryptedPdf(enc)).toBe(true);
    const encV = validatePdfBuffer({ buffer: enc, declaredMime: 'application/pdf' });
    expect(encV.ok).toBe(false);
    expect(encV).toMatchObject({ ok: false, code: 'PDF_ENCRYPTED' });
  });
});

describe('S08 extract + segment', () => {
  it('textual PDF → pages 1..N, stable ids, excerpt on page', async () => {
    const buf = await fixtureTextualPdf();
    const extracted = await extractPdfNative({
      buffer: buf,
      declaredMime: 'application/pdf',
      fileName: 't.pdf',
    });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    expect(extracted.pages.length).toBeGreaterThanOrEqual(1);
    expect(extracted.pages[0]!.page).toBe(1);
    expect(extracted.coverage.status).toBe('complete');
    // Bbox only when measured from text item transforms — never invented.
    // Per-chunk bbox measured from text items (not page-wide).
    const segs = segmentPdfPages({
      pages: extracted.pages,
      rawHash: extracted.rawHash,
      coverage: extracted.coverage,
      title: extracted.title,
      extractionDigest: extracted.extractionDigest,
    });
    if (segs.segments.length >= 2) {
      const a = segs.segments[0]!;
      const b = segs.segments[1]!;
      if (a.loc.page === b.loc.page && a.loc.bbox && b.loc.bbox) {
        expect(
          a.loc.bbox.x !== b.loc.bbox.x ||
            a.loc.bbox.y !== b.loc.bbox.y ||
            a.loc.bbox.w !== b.loc.bbox.w ||
            a.loc.bbox.h !== b.loc.bbox.h
        ).toBe(true);
      }
    }
    // Page must not carry a shared textBbox field.
    expect((extracted.pages[0] as { textBbox?: unknown }).textBbox).toBeUndefined();

    const artifact = segmentPdfPages({
      pages: extracted.pages,
      rawHash: extracted.rawHash,
      coverage: extracted.coverage,
      title: extracted.title,
      extractionDigest: extracted.extractionDigest,
    });
    expect(artifact.segments.length).toBeGreaterThan(0);
    expect(artifact.segments[0]!.loc.page).toBe(1);
    const again = segmentPdfPages({
      pages: extracted.pages,
      rawHash: extracted.rawHash,
      coverage: extracted.coverage,
      title: extracted.title,
      extractionDigest: extracted.extractionDigest,
    });
    expect(again.segments.map((s) => s.id)).toEqual(artifact.segments.map((s) => s.id));

    const sample = artifact.segments[0]!.text.slice(0, 40);
    expect(excerptExistsOnPage(extracted.pages[0]!.text, sample)).toBe(true);
  });

  it('multipage PDF preserves page anchors', async () => {
    const buf = await fixtureMultipagePdf();
    const extracted = await extractPdfNative({ buffer: buf, declaredMime: 'application/pdf' });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    expect(extracted.pages.length).toBe(3);
    expect(extracted.pages.map((p) => p.page)).toEqual([1, 2, 3]);
    const artifact = segmentPdfPages({
      pages: extracted.pages,
      rawHash: extracted.rawHash,
      coverage: extracted.coverage,
      title: null,
      extractionDigest: extracted.extractionDigest,
    });
    const pages = new Set(artifact.segments.map((s) => s.loc.page));
    expect(pages.has(1) && pages.has(2) && pages.has(3)).toBe(true);
  });

  it('unicode / emoji survives extraction', async () => {
    const buf = await fixtureUnicodePdf();
    const extracted = await extractPdfNative({ buffer: buf, declaredMime: 'application/pdf' });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    expect(extracted.pages[0]!.text).toMatch(/café|emoji|UTF-16|🧠|☕/i);
  });

  it('empty PDF fails as PDF_INSUFFICIENT_TEXT (not scanned)', async () => {
    const empty = fixtureEmptyPagePdf();
    const extracted = await extractPdfNative({
      buffer: empty,
      declaredMime: 'application/pdf',
    });
    expect(extracted.ok).toBe(false);
    expect(extracted).toMatchObject({ ok: false, code: 'PDF_INSUFFICIENT_TEXT' });
  });

  it('image-only PDF fails exactly as PDF_SCANNED', async () => {
    const { fixtureImageOnlyPdf } = await import('./fixtures');
    const buf = await fixtureImageOnlyPdf();
    const extracted = await extractPdfNative({
      buffer: buf,
      declaredMime: 'application/pdf',
    });
    expect(extracted.ok).toBe(false);
    expect(extracted).toMatchObject({ ok: false, code: 'PDF_SCANNED' });
    if (extracted.ok === false) {
      expect(extracted.coverage?.status).toBe('scanned');
      expect(extracted.coverage?.imageOnlyPages).toBeGreaterThan(0);
    }
  });

  it('mixed text+image yields partial coverage (ok)', async () => {
    const { fixtureMixedTextAndImagePdf } = await import('./fixtures');
    const buf = await fixtureMixedTextAndImagePdf();
    const extracted = await extractPdfNative({
      buffer: buf,
      declaredMime: 'application/pdf',
    });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    expect(extracted.coverage.status).toBe('partial');
    expect(extracted.coverage.imageOnlyPages).toBeGreaterThan(0);
    expect(extracted.coverage.textualPages).toBeGreaterThan(0);
    expect(extracted.coverage.affectedPages.length).toBeGreaterThan(0);
  });

  it('corrupt PDF fails typed', async () => {
    const extracted = await extractPdfNative({
      buffer: fixtureCorruptPdf(),
      declaredMime: 'application/pdf',
    });
    expect(extracted.ok).toBe(false);
  });

  it('encrypted PDF rejected at validate or extract', async () => {
    const extracted = await extractPdfNative({
      buffer: fixtureEncryptedPdf(),
      declaredMime: 'application/pdf',
    });
    expect(extracted.ok).toBe(false);
    expect(extracted).toMatchObject({ ok: false, code: 'PDF_ENCRYPTED' });
  });

  it('cancels when AbortSignal is already aborted (no late-discard)', async () => {
    const buf = await fixtureMultipagePdf();
    const ac = new AbortController();
    ac.abort();
    const extracted = await extractPdfNative({
      buffer: buf,
      declaredMime: 'application/pdf',
      signal: ac.signal,
    });
    expect(extracted.ok).toBe(false);
    expect(extracted).toMatchObject({ ok: false, code: 'PDF_CANCELLED' });
  });

  it('cancels mid-extract when barrier aborts between pages', async () => {
    const { setPdfExtractPageBarrier } = await import(
      '../../server/src/ingestors/pdfExtractNative'
    );
    const buf = await fixtureMultipagePdf();
    const ac = new AbortController();
    setPdfExtractPageBarrier(async (pageNum) => {
      if (pageNum >= 2) ac.abort();
    });
    try {
      const extracted = await extractPdfNative({
        buffer: buf,
        declaredMime: 'application/pdf',
        signal: ac.signal,
      });
      expect(extracted.ok).toBe(false);
      if (extracted.ok === false) {
        expect(extracted.code).toBe('PDF_CANCELLED');
      } else {
        throw new Error('unexpected success after mid-extract abort');
      }
      expect(extracted).not.toMatchObject({ ok: true });
    } finally {
      setPdfExtractPageBarrier(null);
    }
  });

  it('rejects >400 pages before extracting page text (PDF_TOO_MANY_PAGES)', async () => {
    const { fixtureTooManyPagesPdf } = await import('./fixtures');
    const buf = await fixtureTooManyPagesPdf(401);
    const extracted = await extractPdfNative({
      buffer: buf,
      declaredMime: 'application/pdf',
    });
    expect(extracted.ok).toBe(false);
    expect(extracted).toMatchObject({ ok: false, code: 'PDF_TOO_MANY_PAGES' });
  }, 120_000);

  it('rejects exact MAX_PDF_BYTES+1 with PDF_TOO_LARGE', () => {
    const huge = Buffer.alloc(MAX_PDF_BYTES + 1);
    huge.write('%PDF-1.4', 0, 'ascii');
    const over = validatePdfBuffer({ buffer: huge, declaredMime: 'application/pdf' });
    expect(over.ok).toBe(false);
    expect(over).toMatchObject({ ok: false, code: 'PDF_TOO_LARGE' });
  });

  it('accepts boundary MAX_PDF_BYTES when magic is PDF (raw ceiling)', () => {
    const edge = Buffer.alloc(MAX_PDF_BYTES);
    edge.write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 0, 'ascii');
    const ok = validatePdfBuffer({ buffer: edge, declaredMime: 'application/pdf' });
    // May fail as corrupt/encrypted, but must NOT be PDF_TOO_LARGE at exact ceiling.
    if (ok.ok === false) {
      expect(ok.code).not.toBe('PDF_TOO_LARGE');
    }
  });
});

describe('S08 coverage honesty', () => {
  it('distinguishes empty vs image-only vs scanned', () => {
    const empty = assessPdfCoverage([
      { page: 1, text: '', charCount: 0, hasText: false, hasImages: false, kind: 'empty' },
    ]);
    expect(empty.status).toBe('empty');

    const scanned = assessPdfCoverage([
      {
        page: 1,
        text: '',
        charCount: 0,
        hasText: false,
        hasImages: true,
        kind: 'image_only',
      },
    ]);
    expect(scanned.status).toBe('scanned');
    expect(pageHasVerifiableText('abc')).toBe(false);
    expect(pageHasVerifiableText('texto verificable suficiente aquí')).toBe(true);
  });
});

describe('S08 productive pdfIngestor + prepareTransformIngest', () => {
  it('ingests textual PDF into chunks with page loc', async () => {
    const buf = await fixtureTextualPdf();
    const result = await pdfIngestor.ingest({
      buffer: buf,
      mime: 'application/pdf',
      ext: 'pdf',
      fileName: 'nativo.pdf',
      size: buf.length,
    });
    expect(result.metadata.type).toBe('pdf');
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks.every((c) => typeof c.loc.page === 'number' && c.loc.page >= 1)).toBe(
      true
    );
    expect(result.metadata.pdfCoverage).toBe('complete');
    expect(result.needsVisionFallback).toBeFalsy();
  });

  it('prepareTransformIngest does not passthrough scanned/empty PDF to Gemini', async () => {
    const empty = fixtureEmptyPagePdf();
    const outcome = await prepareTransformIngest({
      type: 'pdf',
      fileData: empty.toString('base64'),
      mimeType: 'application/pdf',
      sourceLabel: 'scan.pdf',
    } as TransformRequest);
    expect(outcome.kind).toBe('error');
    if (outcome.kind !== 'error') return;
    expect(outcome.code).not.toBe('passthrough');
    expect(String(outcome.code)).toMatch(/PDF_|INGEST/);
  });

  it('prepareTransformIngest succeeds for textual PDF as source (not passthrough)', async () => {
    const buf = await fixtureTextualPdf();
    const outcome = await prepareTransformIngest({
      type: 'pdf',
      fileData: buf.toString('base64'),
      mimeType: 'application/pdf',
      sourceLabel: 'ok.pdf',
    } as TransformRequest);
    expect(outcome.kind).toBe('source');
    if (outcome.kind !== 'source') return;
    expect(outcome.body.type).toBe('text');
    expect(outcome.ingest.chunks[0]!.loc.page).toBe(1);
    expect(outcome.body.fileData).toBeUndefined();
  });

  it('identical retry yields same extraction digest', async () => {
    const buf = await fixtureTextualPdf();
    const a = await extractPdfNative({ buffer: buf, declaredMime: 'application/pdf' });
    const b = await extractPdfNative({ buffer: buf, declaredMime: 'application/pdf' });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.extractionDigest).toBe(b.extractionDigest);
    expect(a.rawHash).toBe(b.rawHash);
  });

  it('partially textual PDF is partial with limitations; not silent OCR', async () => {
    const { fixturePartialScannedPdf } = await import('./fixtures');
    const buf = await fixturePartialScannedPdf();
    const extracted = await extractPdfNative({ buffer: buf, declaredMime: 'application/pdf' });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    expect(extracted.coverage.status).toBe('partial');
    expect(extracted.coverage.limitations).toContain('partial_text_only');
    expect(extracted.coverage.limitations).toContain('tables_unparsed');
  });

  it('long page segments across boundaries with stable page anchors', async () => {
    const { fixtureLongPagePdf } = await import('./fixtures');
    const buf = await fixtureLongPagePdf();
    const extracted = await extractPdfNative({ buffer: buf, declaredMime: 'application/pdf' });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    const artifact = segmentPdfPages({
      pages: extracted.pages,
      rawHash: extracted.rawHash,
      coverage: extracted.coverage,
      title: null,
      extractionDigest: extracted.extractionDigest,
    });
    expect(artifact.segments.length).toBeGreaterThan(1);
    expect(artifact.segments.every((s) => s.loc.page === 1)).toBe(true);
    // Overlap region: end of first meets start of second
    const a = artifact.segments[0]!;
    const b = artifact.segments[1]!;
    expect(a.loc.end).toBeGreaterThan(a.loc.start!);
    expect(b.loc.start).toBeLessThan(a.loc.end!);
    expect(excerptExistsOnPage(extracted.pages[0]!.text, a.text.slice(-20))).toBe(true);
  });

  it('repeated text on different pages gets distinct chunk ids + page locs', async () => {
    const { fixtureRepeatedTextPdf } = await import('./fixtures');
    const buf = await fixtureRepeatedTextPdf();
    const extracted = await extractPdfNative({ buffer: buf, declaredMime: 'application/pdf' });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    const artifact = segmentPdfPages({
      pages: extracted.pages,
      rawHash: extracted.rawHash,
      coverage: extracted.coverage,
      title: null,
      extractionDigest: extracted.extractionDigest,
    });
    const p1 = artifact.segments.find((s) => s.loc.page === 1)!;
    const p2 = artifact.segments.find((s) => s.loc.page === 2)!;
    expect(p1.text).toBe(p2.text);
    expect(p1.id).not.toBe(p2.id);
  });
});
