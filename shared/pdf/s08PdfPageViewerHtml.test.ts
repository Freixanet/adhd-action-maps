import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertNoRemoteViewerAssets,
  buildPdfPageViewerHtml,
  PDF_PAGE_VIEWER_MAX_BYTES,
  viewerHtmlHasRemoteHost,
} from './buildPdfPageViewerHtml';
import { MAX_PDF_BYTES } from './versions';

describe('buildPdfPageViewerHtml (local-only)', () => {
  it('embeds local relative assets and the requested page — no remote hosts', () => {
    const html = buildPdfPageViewerHtml({
      page: 2,
      pdfSrc: 'document.pdf',
      pdfJsSrc: 'pdf.min.js',
      pdfWorkerSrc: 'pdf.worker.min.js',
    });
    expect(html).toContain('var pageNumber = 2;');
    expect(html).toContain('document.pdf');
    expect(html).toContain('pdf.min.js');
    expect(html).not.toContain('cdnjs');
    expect(html).not.toContain('unpkg');
    expect(viewerHtmlHasRemoteHost(html)).toBe(false);
    expect(() =>
      assertNoRemoteViewerAssets('document.pdf', 'pdf.min.js', 'pdf.worker.min.js')
    ).not.toThrow();
  });

  it('rejects remote script/pdf URLs', () => {
    expect(() =>
      buildPdfPageViewerHtml({
        page: 1,
        pdfSrc: 'document.pdf',
        pdfJsSrc: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        pdfWorkerSrc: 'pdf.worker.min.js',
      })
    ).toThrow(/remote viewer asset forbidden/);
  });

  it('viewer max bytes matches S08 ingest ceiling', () => {
    expect(PDF_PAGE_VIEWER_MAX_BYTES).toBe(MAX_PDF_BYTES);
    expect(PDF_PAGE_VIEWER_MAX_BYTES).toBe(20 * 1024 * 1024);
  });

  it('vendored mobile pdfjs assets must not reference script CDNs', () => {
    const dir = join(process.cwd(), 'mobile/assets/pdfjs');
    const files = readdirSync(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const text = readFileSync(join(dir, name), 'utf8');
      expect(text).not.toMatch(/cdnjs\.cloudflare\.com/i);
      expect(text).not.toMatch(/unpkg\.com/i);
      expect(text).not.toMatch(/jsdelivr\.net/i);
      expect(text).not.toMatch(/https:\/\/cdn\./i);
    }
  });
});
