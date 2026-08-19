/**
 * S08 PDF native ingestor — validation + page-native extraction + honest coverage.
 * Does not fall back to OCR/Gemini. Never invents bbox.
 */

import type { IngestResult } from '../../../shared/types/chunk';
import { asSourceChunks, segmentPdfPages } from '../../../shared/pdf/segmentPdf';
import { buildChapterMeta } from './chunkUtils';
import { extractPdfNative, pdfErrorHttpStatus } from './pdfExtractNative';
import { pdfInspectorMetadataStrings } from './pdfInspectorAdapter';
import { IngestError, type Ingestor, type IngestorInput } from './types';

function toIngestError(
  code: string,
  message: string
): IngestError {
  const mapped =
    code === 'PDF_TOO_LARGE' || code === 'PDF_TOO_MANY_PAGES'
      ? ('FILE_TOO_LARGE' as const)
      : ('INGEST_FAILED' as const);
  return new IngestError(message, mapped, pdfErrorHttpStatus(code as never));
}

/**
 * Local PDF text extraction with real page anchors (1…N).
 * Scanned / empty / encrypted / corrupt → typed failure (no multimodal pretend success).
 */
export const pdfIngestor: Ingestor = {
  canHandle(input) {
    const mime = (input.mime || '').toLowerCase();
    const ext = (input.ext || '').toLowerCase();
    return mime === 'application/pdf' || mime === 'application/x-pdf' || ext === 'pdf';
  },

  async ingest(input: IngestorInput): Promise<IngestResult> {
    if (!input.buffer?.length) {
      throw toIngestError('PDF_EMPTY', 'El archivo PDF está vacío.');
    }

    const extracted = await extractPdfNative({
      buffer: input.buffer,
      declaredMime: input.mime,
      fileName: input.fileName,
      signal: input.signal,
    });

    if (extracted.ok === false) {
      // Attach coverage summary in message when present; caller must not Gemini-fallback.
      const err = toIngestError(extracted.code, extracted.message);
      (err as IngestError & { pdfCode?: string; pdfCoverage?: unknown }).pdfCode =
        extracted.code;
      (err as IngestError & { pdfCoverage?: unknown }).pdfCoverage = extracted.coverage;
      throw err;
    }

    const artifact = segmentPdfPages({
      pages: extracted.pages,
      rawHash: extracted.rawHash,
      coverage: extracted.coverage,
      title: extracted.title,
      extractionDigest: extracted.extractionDigest,
    });

    if (!artifact.segments.length) {
      throw toIngestError(
        'PDF_INSUFFICIENT_TEXT',
        'No quedó texto verificable tras segmentar el PDF.'
      );
    }

    const chunks = asSourceChunks(artifact.segments);
    const pagesWithText = extracted.pages.filter((p) => p.hasText);

    return {
      chunks,
      chapters:
        extracted.pages.length > 1
          ? extracted.pages.map((p, i) =>
              buildChapterMeta(
                `Página ${p.page}`,
                i,
                chunks.filter((c) => c.loc.page === p.page)
              )
            )
          : undefined,
      metadata: {
        type: 'pdf',
        title:
          extracted.title ||
          input.fileName?.replace(/\.pdf$/i, '') ||
          undefined,
        pdfCoverage: extracted.coverage.status,
        pdfPageCount: String(extracted.pages.length),
        pdfTextualPages: String(pagesWithText.length),
        pdfExtractionDigest: extracted.extractionDigest,
        pdfLimitations: extracted.coverage.limitations.join(','),
        pdfCoverageSummary: extracted.coverage.summary,
        pdfSchemaVersion: extracted.schemaVersion,
        pdfExtractorVersion: extracted.extractorVersion,
        ...pdfInspectorMetadataStrings(extracted.inspector),
      },
      rawHash: extracted.rawHash,
    };
  },
};
