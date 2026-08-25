/**
 * Optional pdf-inspector enhancement for the S08 PDF pipeline.
 *
 * The parser is synchronous, so it runs in a worker with a hard timeout. The
 * existing pdf.js extraction remains authoritative for measured images and
 * bboxes. Structured Markdown is accepted page-by-page only when it passes
 * conservative quality checks; every failure degrades to the pdf.js result.
 */

import { Worker } from 'node:worker_threads';
import { canonicalizePastedText } from '../../../shared/pastedText';
import { classifyPdfPage } from '../../../shared/pdf/coverage';
import { MAX_PDF_PAGES, MIN_PAGE_TEXT_CHARS } from '../../../shared/pdf/versions';
import type {
  PdfInspectorBackend,
  PdfInspectorMetadata,
  PdfPageExtraction,
} from '../../../shared/pdf/types';

export type PdfInspectorMode = 'auto' | 'native' | 'wasm' | 'off';

type PdfInspectorPageAnalysis = {
  page: number;
  markdown: string;
  needsOcr: boolean;
  ocrReason?: string;
};

export type PdfInspectorAnalysis = PdfInspectorMetadata & {
  pages: PdfInspectorPageAnalysis[];
  hasEncodingIssues: boolean;
};

// A structure enhancement must not turn a fast upload into a long wait. The
// timer starts alongside pdf.js, so this is a total parallel budget, not an
// extra 2.5 seconds after extraction.
const DEFAULT_TIMEOUT_MS = 2_500;
const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 30_000;
const MAX_TOTAL_MARKDOWN_CHARS = 12_000_000;

const PDF_INSPECTOR_WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { readFileSync } = require('node:fs');

function safePageCount(value) {
  const pageCount = Number(value);
  if (
    !Number.isInteger(pageCount)
    || pageCount < 1
    || pageCount > workerData.maxPages
  ) {
    throw new Error('invalid_page_count');
  }
  return pageCount;
}

function splitMarkedPages(markdown, pageCount) {
  const out = Array.from({ length: pageCount }, (_, i) => ({
    page: i + 1,
    markdown: '',
    needsOcr: false,
  }));
  if (typeof markdown !== 'string' || !markdown) return out;
  const marker = /<!--\s*Page\s+(\d+)\s*-->\s*/gi;
  const matches = Array.from(markdown.matchAll(marker));
  if (matches.length === 0) {
    if (pageCount === 1) out[0].markdown = markdown.trim();
    return out;
  }
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const page = Number(match[1]);
    if (!Number.isInteger(page) || page < 1 || page > pageCount) continue;
    const start = (match.index || 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    out[page - 1].markdown = markdown.slice(start, end).trim();
  }
  return out;
}

function applyOcrMetadata(pages, pagesNeedingOcr, reasons) {
  const needs = new Set(Array.isArray(pagesNeedingOcr) ? pagesNeedingOcr : []);
  const reasonMap = new Map(
    (Array.isArray(reasons) ? reasons : [])
      .filter((entry) => entry && Number.isInteger(entry.page))
      .map((entry) => [entry.page, Array.isArray(entry.reasons) ? entry.reasons.join(',') : ''])
  );
  return pages.map((page) => ({
    ...page,
    needsOcr: page.needsOcr === true || needs.has(page.page),
    ...(reasonMap.get(page.page) ? { ocrReason: reasonMap.get(page.page) } : {}),
  }));
}

async function runNative(bytes) {
  const mod = require('@firecrawl/pdf-inspector');
  const pkg = require('@firecrawl/pdf-inspector/package.json');
  const classification = mod.classifyPdf(bytes);
  const pageCount = safePageCount(classification.pageCount);
  const extraction = mod.extractPagesMarkdown(bytes);
  if (!Array.isArray(extraction.pages) || extraction.pages.length !== pageCount) {
    throw new Error('page_count_mismatch');
  }
  const pages = (extraction.pages || []).map((page) => ({
    page: Number(page.page) + 1,
    markdown: typeof page.markdown === 'string' ? page.markdown.trim() : '',
    needsOcr: page.needsOcr === true,
    ...(page.ocrReason ? { ocrReason: String(page.ocrReason) } : {}),
  }));
  return {
    backend: 'native',
    version: String(pkg.version || 'unknown'),
    pdfType: String(classification.pdfType || ''),
    confidence: Number(classification.confidence),
    pageCount,
    pages,
    pagesNeedingOcr: Array.isArray(extraction.pagesNeedingOcr)
      ? extraction.pagesNeedingOcr
      : [],
    pagesWithTables: Array.isArray(extraction.pagesWithTables)
      ? extraction.pagesWithTables
      : [],
    pagesWithColumns: Array.isArray(extraction.pagesWithColumns)
      ? extraction.pagesWithColumns
      : [],
    hasEncodingIssues: Array.isArray(extraction.ocrReasonsByPage)
      && extraction.ocrReasonsByPage.some((entry) =>
        Array.isArray(entry.reasons)
        && entry.reasons.some((reason) => /encoding|garbled|gid/i.test(String(reason)))
      ),
  };
}

async function runWasm(bytes) {
  const mod = await import('@firecrawl/pdf-inspector-wasm');
  const wasmPath = require.resolve(
    '@firecrawl/pdf-inspector-wasm/pdf_inspector_wasm_bg.wasm'
  );
  await mod.default({ module_or_path: readFileSync(wasmPath) });
  const result = mod.processPdf(new Uint8Array(bytes), {
    profile: 'compact',
    includePageMarkers: true,
    includeImages: false,
  });
  const pageCount = safePageCount(result.pageCount);
  const pages = applyOcrMetadata(
    splitMarkedPages(result.markdown, pageCount),
    result.pagesNeedingOcr,
    result.ocrReasonsByPage
  );
  return {
    backend: 'wasm',
    version: String(mod.version()),
    pdfType: String(result.pdfType || ''),
    confidence: Number(result.confidence),
    pageCount,
    pages,
    pagesNeedingOcr: Array.isArray(result.pagesNeedingOcr)
      ? result.pagesNeedingOcr
      : [],
    pagesWithTables: Array.isArray(result.layout && result.layout.pagesWithTables)
      ? result.layout.pagesWithTables
      : [],
    pagesWithColumns: Array.isArray(result.layout && result.layout.pagesWithColumns)
      ? result.layout.pagesWithColumns
      : [],
    hasEncodingIssues: result.hasEncodingIssues === true,
  };
}

async function main() {
  const bytes = Buffer.from(workerData.bytes);
  const mode = workerData.mode;
  let lastCode = 'unavailable';
  if (mode === 'auto' || mode === 'native') {
    try {
      parentPort.postMessage({ ok: true, value: await runNative(bytes) });
      return;
    } catch {
      lastCode = 'native_unavailable';
      if (mode === 'native') {
        parentPort.postMessage({ ok: false, code: lastCode });
        return;
      }
    }
  }
  if (mode === 'auto' || mode === 'wasm') {
    try {
      parentPort.postMessage({ ok: true, value: await runWasm(bytes) });
      return;
    } catch {
      lastCode = 'wasm_unavailable';
    }
  }
  parentPort.postMessage({ ok: false, code: lastCode });
}

main().catch(() => parentPort.postMessage({ ok: false, code: 'worker_failed' }));
`;

function readMode(value = process.env.PDF_INSPECTOR_MODE): PdfInspectorMode {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'native' ||
    normalized === 'wasm' ||
    normalized === 'off' ||
    normalized === 'auto'
  ) {
    return normalized;
  }
  return 'auto';
}

function readTimeout(value = process.env.PDF_INSPECTOR_TIMEOUT_MS): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.trunc(parsed)));
}

function integerPages(value: unknown, pageCount: number): number[] | null {
  if (!Array.isArray(value)) return null;
  const out: number[] = [];
  for (const page of value) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount) return null;
    out.push(page);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function validateAnalysis(value: unknown): PdfInspectorAnalysis | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.backend !== 'native' && candidate.backend !== 'wasm') return null;
  if (typeof candidate.version !== 'string' || !candidate.version || candidate.version.length > 64) {
    return null;
  }
  if (
    candidate.pdfType !== 'TextBased' &&
    candidate.pdfType !== 'Scanned' &&
    candidate.pdfType !== 'ImageBased' &&
    candidate.pdfType !== 'Mixed'
  ) {
    return null;
  }
  if (
    !Number.isInteger(candidate.pageCount) ||
    Number(candidate.pageCount) < 1 ||
    Number(candidate.pageCount) > MAX_PDF_PAGES
  ) {
    return null;
  }
  const pageCount = Number(candidate.pageCount);
  if (
    typeof candidate.confidence !== 'number' ||
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1
  ) {
    return null;
  }
  const pagesNeedingOcr = integerPages(candidate.pagesNeedingOcr, pageCount);
  const pagesWithTables = integerPages(candidate.pagesWithTables, pageCount);
  const pagesWithColumns = integerPages(candidate.pagesWithColumns, pageCount);
  if (!pagesNeedingOcr || !pagesWithTables || !pagesWithColumns) return null;
  if (!Array.isArray(candidate.pages) || candidate.pages.length !== pageCount) return null;

  let totalChars = 0;
  const pages: PdfInspectorPageAnalysis[] = [];
  for (let i = 0; i < pageCount; i += 1) {
    const raw = candidate.pages[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const page = raw as Record<string, unknown>;
    if (page.page !== i + 1 || typeof page.markdown !== 'string') return null;
    if (page.needsOcr !== true && page.needsOcr !== false) return null;
    totalChars += page.markdown.length;
    if (totalChars > MAX_TOTAL_MARKDOWN_CHARS) return null;
    pages.push({
      page: i + 1,
      markdown: page.markdown,
      needsOcr: page.needsOcr,
      ...(typeof page.ocrReason === 'string' && page.ocrReason.length <= 256
        ? { ocrReason: page.ocrReason }
        : {}),
    });
  }

  return {
    backend: candidate.backend as PdfInspectorBackend,
    version: candidate.version,
    pdfType: candidate.pdfType as PdfInspectorAnalysis['pdfType'],
    confidence: candidate.confidence,
    pageCount,
    pagesNeedingOcr,
    pagesWithTables,
    pagesWithColumns,
    structuredPages: [],
    pages,
    hasEncodingIssues: candidate.hasEncodingIssues === true,
  };
}

/**
 * Analyze a PDF off the main event loop. Null means disabled, unavailable,
 * cancelled, timed out, or invalid. Callers must continue with pdf.js.
 */
export async function inspectPdfStructure(args: {
  buffer: Buffer;
  signal?: AbortSignal;
  mode?: PdfInspectorMode;
  timeoutMs?: number;
}): Promise<PdfInspectorAnalysis | null> {
  const mode = args.mode ?? readMode();
  if (mode === 'off' || args.signal?.aborted) return null;
  const timeoutMs = readTimeout(
    args.timeoutMs === undefined ? undefined : String(args.timeoutMs)
  );
  const transferable = args.buffer.buffer.slice(
    args.buffer.byteOffset,
    args.buffer.byteOffset + args.buffer.byteLength
  );

  return new Promise((resolve) => {
    let settled = false;
    let worker: Worker;
    try {
      worker = new Worker(PDF_INSPECTOR_WORKER_SOURCE, {
        eval: true,
        workerData: { bytes: transferable, mode, maxPages: MAX_PDF_PAGES },
        transferList: [transferable],
      });
    } catch {
      resolve(null);
      return;
    }

    const finish = (value: PdfInspectorAnalysis | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      args.signal?.removeEventListener('abort', onAbort);
      void worker.terminate();
      resolve(value);
    };
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), timeoutMs);
    args.signal?.addEventListener('abort', onAbort, { once: true });
    worker.once('message', (message: unknown) => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        finish(null);
        return;
      }
      const envelope = message as { ok?: unknown; value?: unknown };
      finish(envelope.ok === true ? validateAnalysis(envelope.value) : null);
    });
    worker.once('error', () => finish(null));
    worker.once('exit', () => finish(null));
  });
}

function markdownIsSafeReplacement(markdown: string, baseline: PdfPageExtraction): boolean {
  if (/\u0000/.test(markdown)) return false;
  const structured = canonicalizePastedText(markdown);
  if (structured.length < MIN_PAGE_TEXT_CHARS) return false;
  if (!baseline.hasText) return true;
  const baselineLength = Math.max(1, canonicalizePastedText(baseline.text).length);
  const ratio = structured.length / baselineLength;
  return ratio >= 0.45 && ratio <= 6;
}

/** Apply structured text without trusting it over stronger measured evidence. */
export function mergePdfInspectorAnalysis(
  baseline: PdfPageExtraction[],
  analysis: PdfInspectorAnalysis | null
): { pages: PdfPageExtraction[]; inspector?: PdfInspectorMetadata } {
  if (!analysis || analysis.pageCount !== baseline.length || analysis.hasEncodingIssues) {
    return { pages: baseline };
  }

  const structuredPages: number[] = [];
  const pages = baseline.map((page, index) => {
    const inspected = analysis.pages[index];
    if (!inspected || inspected.page !== page.page || inspected.needsOcr) return page;
    if (!markdownIsSafeReplacement(inspected.markdown, page)) return page;
    const markdown = inspected.markdown.trim();
    if (canonicalizePastedText(markdown) === canonicalizePastedText(page.text)) return page;
    const classified = classifyPdfPage({ text: markdown, hasImages: page.hasImages });
    structuredPages.push(page.page);
    return {
      page: page.page,
      text: markdown,
      charCount: classified.charCount,
      hasText: classified.hasText,
      hasImages: page.hasImages,
      kind: classified.kind,
      // Markdown offsets do not map exactly to positioned glyphs. Omitting the
      // bbox is honest; the page anchor remains exact.
    } satisfies PdfPageExtraction;
  });

  return {
    pages,
    inspector: {
      backend: analysis.backend,
      version: analysis.version,
      pdfType: analysis.pdfType,
      confidence: analysis.confidence,
      pageCount: analysis.pageCount,
      pagesNeedingOcr: analysis.pagesNeedingOcr,
      pagesWithTables: analysis.pagesWithTables,
      pagesWithColumns: analysis.pagesWithColumns,
      structuredPages,
    },
  };
}

/** String-only safe metadata for existing IngestResult storage contracts. */
export function pdfInspectorMetadataStrings(
  inspector: PdfInspectorMetadata | undefined
): Record<string, string> {
  if (!inspector) return {};
  return {
    pdfInspectorBackend: inspector.backend,
    pdfInspectorVersion: inspector.version,
    pdfInspectorType: inspector.pdfType,
    pdfInspectorConfidence: String(inspector.confidence),
    pdfInspectorStructuredPages: inspector.structuredPages.join(','),
    pdfInspectorOcrPages: inspector.pagesNeedingOcr.join(','),
    pdfInspectorTablePages: inspector.pagesWithTables.join(','),
    pdfInspectorColumnPages: inspector.pagesWithColumns.join(','),
  };
}
