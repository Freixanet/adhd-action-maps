/**
 * Coverage + honesty for PDF text extraction (no silent OCR success).
 * Distinguishes empty pages from image-only pages when measured.
 */

import {
  MIN_PAGE_TEXT_CHARS,
  MIN_TEXTUAL_PAGE_RATIO,
} from './versions';
import type {
  PdfCoverage,
  PdfLimitationCode,
  PdfPageExtraction,
  PdfPageKind,
} from './types';

export function classifyPdfPage(args: {
  text: string;
  hasImages: boolean;
}): { hasText: boolean; kind: PdfPageKind; charCount: number } {
  const trimmed = canonicalizePageText(args.text);
  const charCount = trimmed.length;
  const hasText = charCount >= MIN_PAGE_TEXT_CHARS;
  if (hasText) return { hasText: true, kind: 'textual', charCount };
  if (args.hasImages) return { hasText: false, kind: 'image_only', charCount };
  return { hasText: false, kind: 'empty', charCount };
}

function canonicalizePageText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function assessPdfCoverage(pages: PdfPageExtraction[]): PdfCoverage {
  const pageCount = pages.length;
  const textualPages = pages.filter((p) => p.kind === 'textual').length;
  const emptyPages = pages.filter((p) => p.kind === 'empty').length;
  const imageOnlyPages = pages.filter((p) => p.kind === 'image_only').length;
  const totalExtractedChars = pages.reduce((n, p) => n + p.charCount, 0);
  const affectedPages = pages
    .filter((p) => p.kind !== 'textual')
    .map((p) => p.page);

  const limitations: PdfLimitationCode[] = [
    'tables_unparsed',
    'multi_column_order_uncertain',
    'formulas_as_text',
    'diagrams_not_interpreted',
    'images_not_ocr',
    'reading_order_best_effort',
  ];

  if (pageCount === 0) {
    return {
      pageCount: 0,
      textualPages: 0,
      emptyPages: 0,
      imageOnlyPages: 0,
      totalExtractedChars: 0,
      status: 'empty',
      affectedPages: [],
      limitations: [...limitations, 'empty_pages_present'],
      summary: 'El PDF no tiene páginas legibles.',
    };
  }

  if (textualPages === 0 && imageOnlyPages === 0) {
    return {
      pageCount,
      textualPages: 0,
      emptyPages,
      imageOnlyPages: 0,
      totalExtractedChars: 0,
      status: 'empty',
      affectedPages,
      limitations: [...limitations, 'empty_pages_present'],
      summary: 'PDF sin texto ni imágenes medibles. Vacío o ilegible.',
    };
  }

  if (textualPages === 0 && imageOnlyPages > 0) {
    return {
      pageCount,
      textualPages: 0,
      emptyPages,
      imageOnlyPages,
      totalExtractedChars: 0,
      status: 'scanned',
      affectedPages,
      limitations: [
        ...limitations,
        'scanned_pages_present',
        'image_only_pages_present',
      ],
      summary: `PDF solo con imágenes (${imageOnlyPages}/${pageCount} páginas). No se presenta OCR como exitoso.`,
    };
  }

  const ratio = textualPages / Math.max(1, pageCount);
  if (ratio < MIN_TEXTUAL_PAGE_RATIO || totalExtractedChars < MIN_PAGE_TEXT_CHARS * 2) {
    return {
      pageCount,
      textualPages,
      emptyPages,
      imageOnlyPages,
      totalExtractedChars,
      status: 'insufficient',
      affectedPages,
      limitations: [
        ...limitations,
        'partial_text_only',
        ...(imageOnlyPages > 0 ? (['image_only_pages_present'] as const) : []),
        ...(emptyPages > 0 ? (['empty_pages_present'] as const) : []),
      ],
      summary:
        'Texto insuficiente para un Núcleo fiable. Solo algunas páginas tienen texto nativo.',
    };
  }

  if (emptyPages > 0 || imageOnlyPages > 0) {
    return {
      pageCount,
      textualPages,
      emptyPages,
      imageOnlyPages,
      totalExtractedChars,
      status: 'partial',
      affectedPages,
      limitations: [
        ...limitations,
        'partial_text_only',
        ...(imageOnlyPages > 0
          ? (['image_only_pages_present', 'scanned_pages_present'] as const)
          : []),
        ...(emptyPages > 0 ? (['empty_pages_present'] as const) : []),
      ],
      summary: `Texto nativo en ${textualPages}/${pageCount} páginas. Afectadas: ${affectedPages.join(', ') || 'ninguna'}.`,
    };
  }

  return {
    pageCount,
    textualPages,
    emptyPages: 0,
    imageOnlyPages: 0,
    totalExtractedChars,
    status: 'complete',
    affectedPages: [],
    limitations,
    summary: `Texto nativo extraído de ${pageCount} página(s). Tablas, columnas y diagramas no se interpretan como estructura.`,
  };
}

export function pageHasVerifiableText(text: string): boolean {
  return canonicalizePageText(text).length >= MIN_PAGE_TEXT_CHARS;
}

/** Human labels for UI — no invented confidence percentages. */
export function pdfLimitationLabel(code: PdfLimitationCode): string {
  switch (code) {
    case 'tables_unparsed':
      return 'Las tablas no se interpretan como estructura';
    case 'multi_column_order_uncertain':
      return 'El orden de columnas es aproximado';
    case 'formulas_as_text':
      return 'Las fórmulas se tratan como texto plano';
    case 'diagrams_not_interpreted':
      return 'Los diagramas no se interpretan';
    case 'images_not_ocr':
      return 'No se hace OCR de imágenes';
    case 'partial_text_only':
      return 'Solo parte del documento tiene texto nativo';
    case 'scanned_pages_present':
      return 'Hay páginas escaneadas o solo imagen';
    case 'image_only_pages_present':
      return 'Hay páginas solo con imagen, sin texto';
    case 'empty_pages_present':
      return 'Hay páginas vacías';
    case 'reading_order_best_effort':
      return 'El orden de lectura es best-effort';
    default:
      return code;
  }
}

export function coverageNotesFromPdf(coverage: PdfCoverage): Array<{
  label: string;
  detail: string;
  tone?: 'neutral' | 'warning';
}> {
  const notes: Array<{ label: string; detail: string; tone?: 'neutral' | 'warning' }> = [
    {
      label: 'Páginas',
      detail: `${coverage.textualPages}/${coverage.pageCount} con texto nativo`,
      tone: coverage.status === 'complete' ? 'neutral' : 'warning',
    },
  ];
  if (coverage.imageOnlyPages > 0) {
    notes.push({
      label: 'Solo imagen',
      detail: `${coverage.imageOnlyPages} página(s)`,
      tone: 'warning',
    });
  }
  if (coverage.emptyPages > 0) {
    notes.push({
      label: 'Vacías',
      detail: `${coverage.emptyPages} página(s)`,
      tone: 'warning',
    });
  }
  if (coverage.affectedPages.length) {
    notes.push({
      label: 'Afectadas',
      detail: coverage.affectedPages.join(', '),
      tone: 'warning',
    });
  }
  return notes;
}
