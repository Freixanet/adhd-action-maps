/**
 * canRunApplicationEngine — same extracted-text discipline as S04.
 * Multimodal passthrough / vision / bare YouTube never become ApplicationArtifact.
 */

import type { TransformRequest } from '../contracts';
import type { IngestResult } from '../types/chunk';

export type ApplicationRouteDecision =
  | { run: true; reason: 'extracted_text' | 'pasted_text' | 'web_or_document_text' }
  | {
      run: false;
      reason:
        | 'not_apply_intent'
        | 'ask_lane'
        | 'youtube_without_transcript'
        | 'video_without_transcript'
        | 'multimodal_passthrough'
        | 'vision_fallback'
        | 'insufficient_extracted_text'
        | 'empty_source'
        | 'study_legacy';
    };

const MIN_CANONICAL_CHARS = 24;

function looksLikeBareHttpUrl(text: string): boolean {
  const t = text.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  return !/\s/.test(t) || t.length < 120;
}

function extractedTextLength(body: TransformRequest, ingest: IngestResult | null): number {
  if (ingest?.chunks?.length) {
    return ingest.chunks.reduce((n, c) => n + (c.text?.length ?? 0), 0);
  }
  return typeof body.text === 'string' ? body.text.trim().length : 0;
}

/**
 * Shared gate for JSON and NDJSON apply handlers.
 */
export function canRunApplicationEngine(args: {
  intent?: TransformRequest['intent'];
  body: TransformRequest;
  ingestKind: 'ask' | 'source' | 'passthrough' | 'none';
  ingest: IngestResult | null;
}): ApplicationRouteDecision {
  const intent =
    args.intent === 'apply' || args.intent === 'study' ? args.intent : 'understand';
  if (intent === 'study') {
    return { run: false, reason: 'study_legacy' };
  }
  if (intent !== 'apply') {
    return { run: false, reason: 'not_apply_intent' };
  }
  if (args.ingestKind === 'ask') {
    return { run: false, reason: 'ask_lane' };
  }

  const type = args.body.type;
  if (type === 'youtube') {
    return { run: false, reason: 'youtube_without_transcript' };
  }
  if (type === 'video') {
    return { run: false, reason: 'video_without_transcript' };
  }
  if (args.ingestKind === 'passthrough') {
    return { run: false, reason: 'multimodal_passthrough' };
  }
  if (args.ingest?.needsVisionFallback) {
    return { run: false, reason: 'vision_fallback' };
  }

  const len = extractedTextLength(args.body, args.ingest);
  if (len < MIN_CANONICAL_CHARS) {
    return { run: false, reason: 'insufficient_extracted_text' };
  }

  const text = typeof args.body.text === 'string' ? args.body.text.trim() : '';
  if (looksLikeBareHttpUrl(text) && !args.ingest?.chunks?.length) {
    if (/youtu\.?be/i.test(text)) {
      return { run: false, reason: 'youtube_without_transcript' };
    }
    return { run: false, reason: 'empty_source' };
  }

  if (args.ingestKind === 'source' && args.ingest?.chunks?.length) {
    const isPaste =
      args.body.type === 'text' && !looksLikeBareHttpUrl(text.slice(0, 200));
    return {
      run: true,
      reason: isPaste ? 'pasted_text' : 'web_or_document_text',
    };
  }

  if (text.length >= MIN_CANONICAL_CHARS) {
    return { run: true, reason: 'extracted_text' };
  }

  return { run: false, reason: 'insufficient_extracted_text' };
}
