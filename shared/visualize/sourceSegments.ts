export type SourceSegment = {
  id: string;
  text: string;
  startOffset?: number;
  endOffset?: number;
  section?: string;
};

export type EvidenceSupport =
  | 'direct'
  | 'qualified'
  | 'inferred'
  | 'contradicted';

export type EvidenceRef = {
  segmentId: string;
  support: EvidenceSupport;
};

const SEGMENT_MAX_CHARS = 480;

/**
 * Stable paragraph/sentence-ish segmentation for provenance.
 * IDs are deterministic from offsets so LLM and verifiers share the same map.
 */
export function segmentSourceText(
  source: string,
  options?: { maxChars?: number }
): SourceSegment[] {
  const text = source.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const maxChars = options?.maxChars ?? SEGMENT_MAX_CHARS;
  const blocks = text.split(/\n{2,}/);
  const segments: SourceSegment[] = [];
  let cursor = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      cursor = text.indexOf(block, cursor) + block.length;
      continue;
    }

    const blockStart = text.indexOf(trimmed, cursor);
    const start = blockStart >= 0 ? blockStart : cursor;

    if (trimmed.length <= maxChars) {
      segments.push({
        id: `seg-${segments.length + 1}`,
        text: trimmed,
        startOffset: start,
        endOffset: start + trimmed.length,
      });
      cursor = start + trimmed.length;
      continue;
    }

    // Split long blocks on sentence boundaries when possible.
    const pieces = splitByLength(trimmed, maxChars);
    let local = 0;
    for (const piece of pieces) {
      const pieceStart = start + trimmed.indexOf(piece, local);
      segments.push({
        id: `seg-${segments.length + 1}`,
        text: piece,
        startOffset: pieceStart,
        endOffset: pieceStart + piece.length,
      });
      local = trimmed.indexOf(piece, local) + piece.length;
    }
    cursor = start + trimmed.length;
  }

  return segments;
}

function splitByLength(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const out: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const breakAt =
      Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! ')) + 1 ||
      Math.max(window.lastIndexOf(' '), Math.floor(maxChars * 0.7));
    const cut = Math.max(24, Math.min(breakAt, maxChars));
    out.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) out.push(remaining);
  return out;
}

export function indexSegmentsById(segments: SourceSegment[]): Map<string, SourceSegment> {
  return new Map(segments.map((s) => [s.id, s]));
}

export function collectUsedEvidence(
  segments: SourceSegment[],
  refs: EvidenceRef[]
): SourceSegment[] {
  const byId = indexSegmentsById(segments);
  const seen = new Set<string>();
  const used: SourceSegment[] = [];
  for (const ref of refs) {
    if (seen.has(ref.segmentId)) continue;
    const seg = byId.get(ref.segmentId);
    if (!seg) continue;
    seen.add(ref.segmentId);
    used.push(seg);
  }
  return used;
}
