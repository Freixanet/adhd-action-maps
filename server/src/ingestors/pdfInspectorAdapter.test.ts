import { describe, expect, it } from 'vitest';
import { fixtureTextualPdf } from '../../../shared/pdf/fixtures';
import { assessPdfCoverage } from '../../../shared/pdf/coverage';
import type { PdfPageExtraction } from '../../../shared/pdf/types';
import {
  inspectPdfStructure,
  mergePdfInspectorAnalysis,
  pdfInspectorMetadataStrings,
  type PdfInspectorAnalysis,
} from './pdfInspectorAdapter';

function baselinePage(overrides: Partial<PdfPageExtraction> = {}): PdfPageExtraction {
  const text =
    'La atención mejora cuando se elimina una distracción y se define una acción concreta.';
  return {
    page: 1,
    text,
    charCount: text.length,
    hasText: true,
    hasImages: false,
    kind: 'textual',
    textItems: [{ str: text, start: 0, end: text.length, x: 10, y: 20, w: 100, h: 12 }],
    ...overrides,
  };
}

function analysis(overrides: Partial<PdfInspectorAnalysis> = {}): PdfInspectorAnalysis {
  return {
    backend: 'wasm',
    version: '0.1.3',
    pdfType: 'TextBased',
    confidence: 0.98,
    pageCount: 1,
    pagesNeedingOcr: [],
    pagesWithTables: [],
    pagesWithColumns: [],
    structuredPages: [],
    pages: [
      {
        page: 1,
        markdown:
          '## Idea central\n\nLa atención mejora cuando se elimina una distracción y se define una acción concreta.',
        needsOcr: false,
      },
    ],
    hasEncodingIssues: false,
    ...overrides,
  };
}

describe('pdf-inspector adapter', () => {
  it('runs the bundled WASM parser off-thread and returns page Markdown', async () => {
    const buffer = await fixtureTextualPdf();
    const inspected = await inspectPdfStructure({
      buffer,
      mode: 'wasm',
      timeoutMs: 8_000,
    });

    expect(inspected).not.toBeNull();
    expect(inspected).toMatchObject({
      backend: 'wasm',
      version: '0.1.3',
      pdfType: 'TextBased',
      pageCount: 1,
      pagesNeedingOcr: [],
    });
    expect(inspected?.pages[0]?.markdown).toMatch(/atención|bloque|correo/i);
  });

  it('auto selects an available backend (native in production, WASM fallback here)', async () => {
    const buffer = await fixtureTextualPdf();
    const inspected = await inspectPdfStructure({ buffer, mode: 'auto' });

    expect(inspected).not.toBeNull();
    expect(['native', 'wasm']).toContain(inspected?.backend);
    expect(inspected?.pageCount).toBe(1);
  });

  it('returns null when disabled or already cancelled', async () => {
    const buffer = await fixtureTextualPdf();
    await expect(inspectPdfStructure({ buffer, mode: 'off' })).resolves.toBeNull();

    const abort = new AbortController();
    abort.abort();
    await expect(
      inspectPdfStructure({ buffer, mode: 'wasm', signal: abort.signal })
    ).resolves.toBeNull();
  });

  it('uses validated structured Markdown but never keeps a false bbox', () => {
    const baseline = baselinePage();
    const merged = mergePdfInspectorAnalysis([baseline], analysis());

    expect(merged.pages[0]?.text).toContain('## Idea central');
    expect(merged.pages[0]?.textItems).toBeUndefined();
    expect(merged.inspector?.structuredPages).toEqual([1]);
    expect(pdfInspectorMetadataStrings(merged.inspector)).toMatchObject({
      pdfInspectorBackend: 'wasm',
      pdfInspectorVersion: '0.1.3',
      pdfInspectorStructuredPages: '1',
    });
  });

  it('preserves pdf.js text for OCR pages, invalid counts, or unsafe output', () => {
    const baseline = baselinePage();
    const ocr = analysis({
      pagesNeedingOcr: [1],
      pages: [{ page: 1, markdown: '## Texto inventado', needsOcr: true }],
    });
    expect(mergePdfInspectorAnalysis([baseline], ocr).pages[0]).toBe(baseline);

    const mismatched = analysis({ pageCount: 2 });
    expect(mergePdfInspectorAnalysis([baseline], mismatched)).toEqual({ pages: [baseline] });

    const unsafe = analysis({
      pages: [{ page: 1, markdown: '\u0000contenido', needsOcr: false }],
    });
    expect(mergePdfInspectorAnalysis([baseline], unsafe).pages[0]).toBe(baseline);
  });

  it('reports only the structural limitations that remain', () => {
    const page = baselinePage();
    const coverage = assessPdfCoverage([page], {
      tablesStructured: true,
      columnsStructured: true,
    });

    expect(coverage.limitations).not.toContain('tables_unparsed');
    expect(coverage.limitations).not.toContain('multi_column_order_uncertain');
    expect(coverage.limitations).toContain('diagrams_not_interpreted');
    expect(coverage.summary).toContain('estructura validada');
  });
});
