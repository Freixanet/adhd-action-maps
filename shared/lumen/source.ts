import { classifyInput } from './json';
import type { LumenSourceKind } from './types';

const CHUNK_MARK = /\[\[chunk_[a-z0-9]+\]\]\s*/gi;

export function stripChunkMarkers(text: string): string {
  return text.replace(CHUNK_MARK, '').trim();
}

type StitchChunk = {
  text?: string;
  loc?: { start?: number; end?: number };
};

/** Rebuild linear source from overlapping ingest windows. */
export function stitchChunkTexts(chunks: StitchChunk[]): string {
  const usable = chunks
    .map((chunk) => ({
      text: typeof chunk.text === 'string' ? chunk.text : '',
      start: typeof chunk.loc?.start === 'number' ? chunk.loc.start : -1,
      end: typeof chunk.loc?.end === 'number' ? chunk.loc.end : -1,
    }))
    .filter((chunk) => chunk.text);
  if (!usable.length) return '';
  const locOk = usable.every((chunk) => chunk.start >= 0 && chunk.end > chunk.start);
  if (!locOk) return usable.map((chunk) => chunk.text).join('\n\n');
  const sorted = [...usable].sort((a, b) => a.start - b.start);
  let out = sorted[0]?.text ?? '';
  let cursor = sorted[0]?.end ?? 0;
  for (const chunk of sorted.slice(1)) {
    if (chunk.start >= cursor) {
      out += chunk.text;
      cursor = chunk.end;
      continue;
    }
    const skip = cursor - chunk.start;
    if (skip < chunk.text.length) out += chunk.text.slice(skip);
    cursor = Math.max(cursor, chunk.end);
  }
  return out;
}

export function extractLumenMaterial(
  body: { text?: string; type?: string; sourceLabel?: string },
  ingest: { chunks?: StitchChunk[] } | null
): {
  raw: string;
  material: string;
  sourceKind: LumenSourceKind;
  sourceTitle?: string;
} {
  const labelled = (body.text ?? '').trim();
  const cleanedRaw = stripChunkMarkers(labelled);
  const stitched = stitchChunkTexts(ingest?.chunks ?? []);
  const material = stitched || cleanedRaw;
  const classified = classifyInput(cleanedRaw || material.slice(0, 200));
  const sourceKind: LumenSourceKind =
    body.type === 'link' || classified === 'url' ? 'url' : classified;
  const sourceTitle =
    typeof body.sourceLabel === 'string' && body.sourceLabel.trim()
      ? body.sourceLabel.trim()
      : undefined;
  return {
    raw: material || sourceTitle || '',
    material,
    sourceKind,
    sourceTitle,
  };
}
