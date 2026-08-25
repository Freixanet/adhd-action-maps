/**
 * Canonical source provenance for S04 — survives body.type rewrite to 'text'.
 */

import type { SourceKind, TransformRequest } from '../contracts';
import type { IngestResult } from '../types/chunk';

export type ExtractionKind =
  | 'pasted_text'
  | 'web_fetch'
  | 'pdf_text'
  | 'epub_text'
  | 'docx_text'
  | 'image_ocr'
  | 'youtube_transcript'
  | 'unknown';

export type SourceProvenance = {
  originalKind: SourceKind;
  canonicalUrl?: string;
  label?: string;
  title?: string;
  extractionKind: ExtractionKind;
  sourceId?: string;
  sourceVersionId?: string;
  contentHash?: string;
};

function looksLikeHttpUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Map ingest metadata.type → SourceKind.
 * `url` from urlIngestor becomes `link` for UI provenance.
 */
export function sourceKindFromIngestMetadata(metaType: string | undefined): SourceKind | null {
  if (!metaType) return null;
  const t = metaType.toLowerCase();
  if (t === 'url' || t === 'link' || t === 'web') return 'link';
  if (t === 'pdf') return 'pdf';
  if (t === 'epub') return 'epub';
  if (t === 'docx') return 'docx';
  if (t === 'image') return 'image';
  if (t === 'youtube') return 'youtube';
  if (t === 'video') return 'video';
  if (t === 'text') return 'text';
  if (t === 'file') return 'file';
  return null;
}

export function extractionKindFor(
  originalKind: SourceKind,
  ingest: IngestResult | null
): ExtractionKind {
  if (originalKind === 'youtube') return 'youtube_transcript';
  if (originalKind === 'link') return 'web_fetch';
  if (originalKind === 'pdf') return 'pdf_text';
  if (originalKind === 'epub') return 'epub_text';
  if (originalKind === 'docx') return 'docx_text';
  if (originalKind === 'image') return 'image_ocr';
  if (originalKind === 'text') return 'pasted_text';
  if (ingest?.metadata?.type === 'url') return 'web_fetch';
  return 'unknown';
}

/**
 * Build provenance from original request + ingest outcome.
 * Prefer ingest metadata and pre-rewrite body fields over rewritten body.type.
 */
export function buildSourceProvenance(args: {
  /** Body before or after ingest; originalKind prefers explicit originalBody when set. */
  body: TransformRequest;
  /** Snapshot of type/url before factory rewrite, when available. */
  originalBody?: Pick<TransformRequest, 'type' | 'text' | 'sourceLabel' | 'mimeType'>;
  ingest: IngestResult | null;
  contentHash?: string;
  sourceId?: string;
  sourceVersionId?: string;
  /** When resolve returned passthrough (youtube/vision). */
  ingestKind?: 'ask' | 'source' | 'passthrough' | 'none';
}): SourceProvenance {
  const orig = args.originalBody ?? args.body;
  const metaKind = sourceKindFromIngestMetadata(args.ingest?.metadata?.type);

  let originalKind: SourceKind =
    metaKind ??
    (orig.type === 'link'
      ? 'link'
      : orig.type === 'pdf'
        ? 'pdf'
        : orig.type === 'youtube'
          ? 'youtube'
          : orig.type === 'image'
            ? 'image'
            : orig.type === 'video'
              ? 'video'
              : 'text');

  // Heuristic only when metadata absent
  if (!metaKind && orig.mimeType?.includes('epub')) originalKind = 'epub';
  if (!metaKind && orig.mimeType?.includes('wordprocessingml')) originalKind = 'docx';

  let canonicalUrl: string | undefined;
  const rawText = typeof orig.text === 'string' ? orig.text.trim() : '';
  if (originalKind === 'link' || originalKind === 'youtube') {
    if (looksLikeHttpUrl(rawText)) {
      // Prefer bare URL (pre-label); if labelled, take first http URL token
      const m = rawText.match(/https?:\/\/\S+/i);
      canonicalUrl = m ? m[0]!.replace(/[)>,.\]]+$/, '') : undefined;
    }
  }
  // Never use labelled model source text as URL
  if (canonicalUrl && /\n|<<<|chunk/i.test(canonicalUrl)) {
    canonicalUrl = undefined;
  }

  const title = args.ingest?.metadata?.title || undefined;
  const label =
    (typeof orig.sourceLabel === 'string' && orig.sourceLabel.trim()) ||
    title ||
    (originalKind === 'link' ? canonicalUrl : undefined) ||
    undefined;

  return {
    originalKind,
    canonicalUrl,
    label,
    title,
    extractionKind: extractionKindFor(originalKind, args.ingest),
    sourceId: args.sourceId ?? args.body.sourceId,
    sourceVersionId: args.sourceVersionId ?? args.body.sourceVersionId,
    contentHash: args.contentHash,
  };
}
