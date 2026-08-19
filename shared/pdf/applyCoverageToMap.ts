/**
 * Attach PDF coverage structurally onto ActionMapData (no model prompt dependency).
 */

import type { ActionMapData, Coverage, SourceMetadata } from '../contracts';
import {
  coverageNotesFromPdf,
  pdfLimitationLabel,
} from './coverage';
import type { PdfCoverage, PdfSourceMeta } from './types';
import { PDF_SCHEMA_VERSION } from './versions';

export function applyPdfCoverageToMap(
  map: ActionMapData,
  coverage: PdfCoverage,
  opts?: { label?: string; title?: string }
): ActionMapData {
  const limitations = coverage.limitations.map(pdfLimitationLabel);
  const sourceMetadata: SourceMetadata = {
    kind: 'pdf',
    label: opts?.label || map.sourceMetadata?.label || 'PDF',
    title: opts?.title || map.sourceMetadata?.title,
    detected: Array.from(
      new Set([...(map.sourceMetadata?.detected ?? []), 'PDF', `pág. ${coverage.pageCount}`])
    ),
    limitations: Array.from(
      new Set([...(map.sourceMetadata?.limitations ?? []), ...limitations, coverage.summary])
    ),
  };
  const coverageUi: Coverage = {
    summary: coverage.summary,
    notes: coverageNotesFromPdf(coverage),
  };
  return {
    ...map,
    sourceMetadata,
    coverage: coverageUi,
  };
}

export function pdfSourceMetaFromCoverage(args: {
  sourceId: string;
  sourceVersionId: string;
  sourceRequestId: string;
  sourceStatus: PdfSourceMeta['sourceStatus'];
  persistStatus: PdfSourceMeta['persistStatus'];
  contentHash: string;
  extractionDigest: string;
  segmentCount: number;
  coverage: PdfCoverage;
  storagePath?: string;
  persistFailureCode?: string;
}): PdfSourceMeta {
  return {
    kind: 'pdf',
    sourceId: args.sourceId,
    sourceVersionId: args.sourceVersionId,
    sourceRequestId: args.sourceRequestId,
    sourceStatus: args.sourceStatus,
    persistStatus: args.persistStatus,
    contentHash: args.contentHash,
    extractionDigest: args.extractionDigest,
    segmentCount: args.segmentCount,
    pageCount: args.coverage.pageCount,
    textualPages: args.coverage.textualPages,
    coverageStatus: args.coverage.status,
    limitations: args.coverage.limitations,
    coverageSummary: args.coverage.summary,
    affectedPages: args.coverage.affectedPages,
    ...(args.storagePath ? { storagePath: args.storagePath } : {}),
    ...(args.persistFailureCode
      ? { persistFailureCode: args.persistFailureCode }
      : {}),
    schemaVersion: PDF_SCHEMA_VERSION,
  };
}

export function parsePdfSourceMeta(value: unknown): PdfSourceMeta | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.kind !== 'pdf') return null;
  if (typeof raw.sourceId !== 'string' || typeof raw.contentHash !== 'string') return null;
  if (typeof raw.extractionDigest !== 'string') return null;
  if (typeof raw.pageCount !== 'number' || typeof raw.textualPages !== 'number') return null;
  return value as PdfSourceMeta;
}
