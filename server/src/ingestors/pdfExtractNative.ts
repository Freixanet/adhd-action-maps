/**
 * Native PDF text extraction (server). Uses pdfjs page-by-page.
 * - Early reject when numPages > MAX_PDF_PAGES (before text extract).
 * - Cancel checks between pages (AbortSignal).
 * - Image-only vs empty via measured paint-image operators.
 * - Never invents bbox (measures text item transforms when present).
 */

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { sha256Hex } from '../../../shared/sha256Hex';
import { canonicalizePastedText } from '../../../shared/pastedText';
import {
  assessPdfCoverage,
  classifyPdfPage,
} from '../../../shared/pdf/coverage';
import {
  validatePdfBuffer,
  MAX_PDF_PAGES,
  pdfErrorHttpStatus,
} from '../../../shared/pdf/validatePdf';
import {
  PDF_EXTRACTOR_VERSION,
  PDF_SCHEMA_VERSION,
  PDF_VALIDATOR_VERSION,
} from '../../../shared/pdf/versions';
import type {
  PdfExtractResult,
  PdfPageExtraction,
} from '../../../shared/pdf/types';
import { buildPageTextWithItemGeoms } from '../../../shared/pdf/textItemBbox';
import {
  inspectPdfStructure,
  mergePdfInspectorAnalysis,
} from './pdfInspectorAdapter';

const require = createRequire(
  typeof __filename !== 'undefined'
    ? __filename
    : pathToFileURL(process.cwd() + '/server/src/ingestors/pdfExtractNative.ts').href
);

function sha256Bytes(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

const IMAGE_OPS = new Set<number>();
const TEXT_SHOW_OPS = new Set<number>();

/**
 * Test-only barrier invoked between pages so cancel mid-extract is deterministic.
 * Production leaves this null.
 */
export let pdfExtractPageBarrier:
  | ((pageNum: number, signal?: AbortSignal) => void | Promise<void>)
  | null = null;

export function setPdfExtractPageBarrier(
  barrier:
    | ((pageNum: number, signal?: AbortSignal) => void | Promise<void>)
    | null
): void {
  pdfExtractPageBarrier = barrier;
}

async function loadPdfJs(): Promise<{
  getDocument: (src: unknown) => { promise: Promise<PdfDocumentProxy> };
  OPS: Record<string, number>;
}> {
  const mod = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as {
    getDocument: (src: unknown) => { promise: Promise<PdfDocumentProxy> };
    OPS: Record<string, number>;
  };
  if (IMAGE_OPS.size === 0) {
    for (const key of [
      'paintImageXObject',
      'paintInlineImageXObject',
      'paintImageXObjectRepeat',
      'paintInlineImageXObjectGroup',
      'paintImageMaskXObject',
      'paintImageMaskXObjectGroup',
      'paintImageMaskXObjectRepeat',
      'paintSolidColorImageMask',
      'beginInlineImage',
    ]) {
      const code = mod.OPS[key];
      if (typeof code === 'number') IMAGE_OPS.add(code);
    }
    for (const key of [
      'showText',
      'showSpacedText',
      'nextLineShowText',
      'nextLineSetSpacingShowText',
    ]) {
      const code = mod.OPS[key];
      if (typeof code === 'number') TEXT_SHOW_OPS.add(code);
    }
  }
  return mod;
}

type PdfDocumentProxy = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPageProxy>;
  getMetadata?: () => Promise<{ info?: { Title?: string } }>;
  destroy: () => Promise<void>;
};

type PdfPageProxy = {
  getTextContent: () => Promise<{
    items: Array<{ str?: string; transform?: number[]; width?: number; height?: number }>;
  }>;
  getOperatorList: () => Promise<{ fnArray: number[] }>;
};

function standardFontDataUrl(): string | undefined {
  try {
    const pkg = require.resolve('pdfjs-dist/package.json');
    const fontsDir = pkg.replace(/package\.json$/, 'standard_fonts/');
    return pathToFileURL(fontsDir).href;
  } catch {
    return undefined;
  }
}

export async function extractPdfNative(args: {
  buffer: Buffer;
  declaredMime?: string | null;
  fileName?: string | null;
  signal?: AbortSignal;
}): Promise<PdfExtractResult> {
  if (args.signal?.aborted) {
    return { ok: false, code: 'PDF_CANCELLED', message: 'Extracción PDF cancelada.' };
  }

  const validation = validatePdfBuffer({
    buffer: args.buffer,
    declaredMime: args.declaredMime,
    fileName: args.fileName,
  });
  if (validation.ok === false) {
    return {
      ok: false,
      code: validation.code,
      message: validation.message,
    };
  }

  let pdf: PdfDocumentProxy | null = null;
  let inspectorAbort: AbortController | null = null;
  try {
    const { getDocument } = await loadPdfJs();
    if (args.signal?.aborted) {
      return { ok: false, code: 'PDF_CANCELLED', message: 'Extracción PDF cancelada.' };
    }

    const loading = getDocument({
      data: new Uint8Array(args.buffer),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
      standardFontDataUrl: standardFontDataUrl(),
    });
    pdf = await loading.promise;

    // Early reject — do not extract text from oversized documents.
    if (pdf.numPages > MAX_PDF_PAGES) {
      await pdf.destroy().catch(() => undefined);
      pdf = null;
      return {
        ok: false,
        code: 'PDF_TOO_MANY_PAGES',
        message: `El PDF tiene demasiadas páginas (máx. ${MAX_PDF_PAGES}).`,
      };
    }

    inspectorAbort = new AbortController();
    const inspectorSignal = args.signal
      ? AbortSignal.any([args.signal, inspectorAbort.signal])
      : inspectorAbort.signal;
    // The worker runs concurrently with pdf.js and is advisory. A failure,
    // timeout, or incompatible native binary returns null and changes nothing.
    const inspectorPromise = inspectPdfStructure({
      buffer: args.buffer,
      signal: inspectorSignal,
    });

    if (args.signal?.aborted) {
      inspectorAbort.abort();
      await pdf.destroy().catch(() => undefined);
      return { ok: false, code: 'PDF_CANCELLED', message: 'Extracción PDF cancelada.' };
    }

    let title: string | null = null;
    try {
      const meta = await pdf.getMetadata?.();
      title = meta?.info?.Title?.trim() || null;
    } catch {
      title = null;
    }

    let pages: PdfPageExtraction[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      if (args.signal?.aborted) {
        inspectorAbort.abort();
        await pdf.destroy().catch(() => undefined);
        return { ok: false, code: 'PDF_CANCELLED', message: 'Extracción PDF cancelada.' };
      }
      if (pdfExtractPageBarrier) {
        await pdfExtractPageBarrier(pageNum, args.signal);
        if (args.signal?.aborted) {
          inspectorAbort.abort();
          await pdf.destroy().catch(() => undefined);
          return { ok: false, code: 'PDF_CANCELLED', message: 'Extracción PDF cancelada.' };
        }
      }
      const page = await pdf.getPage(pageNum);
      const [textContent, ops] = await Promise.all([
        page.getTextContent(),
        page.getOperatorList(),
      ]);
      const built = buildPageTextWithItemGeoms(textContent.items || []);
      const text = canonicalizePastedText(built.text);
      const hasImages = (ops.fnArray || []).some((fn) => IMAGE_OPS.has(fn));
      const classified = classifyPdfPage({ text, hasImages });
      pages.push({
        page: pageNum,
        text: built.text,
        charCount: classified.charCount,
        hasText: classified.hasText,
        hasImages,
        kind: classified.kind,
        ...(classified.hasText && built.geoms.length
          ? { textItems: built.geoms }
          : {}),
      });
    }

    const merged = mergePdfInspectorAnalysis(pages, await inspectorPromise);
    pages = merged.pages;

    await pdf.destroy().catch(() => undefined);
    pdf = null;

    if (args.signal?.aborted) {
      return { ok: false, code: 'PDF_CANCELLED', message: 'Extracción PDF cancelada.' };
    }

    const structuredPageSet = new Set(merged.inspector?.structuredPages ?? []);
    const detectedTablePages = merged.inspector?.pagesWithTables ?? [];
    const detectedColumnPages = merged.inspector?.pagesWithColumns ?? [];
    const coverage = assessPdfCoverage(pages, {
      tablesStructured:
        detectedTablePages.length > 0 &&
        detectedTablePages.every((page) => structuredPageSet.has(page)),
      columnsStructured:
        detectedColumnPages.length > 0 &&
        detectedColumnPages.every((page) => structuredPageSet.has(page)),
    });
    const joined = pages.map((p) => p.text).join('\n\f\n');
    const rawHash = sha256Bytes(args.buffer);
    const extractionDigest = sha256Hex(joined);

    if (coverage.status === 'scanned') {
      return {
        ok: false,
        code: 'PDF_SCANNED',
        message: coverage.summary,
        coverage,
      };
    }
    if (coverage.status === 'empty' || coverage.status === 'insufficient') {
      return {
        ok: false,
        code: 'PDF_INSUFFICIENT_TEXT',
        message: coverage.summary,
        coverage,
      };
    }

    return {
      ok: true,
      title,
      pages,
      coverage,
      rawHash,
      extractionDigest,
      schemaVersion: PDF_SCHEMA_VERSION,
      extractorVersion: PDF_EXTRACTOR_VERSION,
      validatorVersion: PDF_VALIDATOR_VERSION,
      ...(merged.inspector ? { inspector: merged.inspector } : {}),
    };
  } catch (err) {
    inspectorAbort?.abort();
    if (pdf) await pdf.destroy().catch(() => undefined);
    const msg = err instanceof Error ? err.message : 'extract failed';
    if (/password|encrypt|encrypted/i.test(msg)) {
      return {
        ok: false,
        code: 'PDF_ENCRYPTED',
        message: 'Este PDF está cifrado o protegido con contraseña.',
      };
    }
    if (/corrupt|invalid|xref|trailer|truncated|InvalidPDF/i.test(msg)) {
      return {
        ok: false,
        code: 'PDF_CORRUPT',
        message: 'El PDF está corrupto o truncado y no se pudo leer.',
      };
    }
    if (args.signal?.aborted || /cancel|abort/i.test(msg)) {
      return { ok: false, code: 'PDF_CANCELLED', message: 'Extracción PDF cancelada.' };
    }
    return {
      ok: false,
      code: 'PDF_EXTRACT_FAILED',
      message: 'No se pudo extraer texto del PDF.',
    };
  }
}

export { pdfErrorHttpStatus };
