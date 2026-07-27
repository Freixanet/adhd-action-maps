import { createHash } from "node:crypto";
import type { ChapterMeta, SourceChunk, SourceChunkLoc } from "../../../shared/types/chunk";
import { CHUNK_OVERLAP, CHUNK_SIZE } from "../../../shared/types/chunk";

export function md5Short(input: string | Buffer, len = 8): string {
  return createHash("md5").update(input).digest("hex").slice(0, len);
}

export function rawHashOf(bufferOrText: string | Buffer): string {
  return createHash("sha256").update(bufferOrText).digest("hex");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePlainText(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

/**
 * Chunk text with fixed size/overlap. Optional loc factory receives
 * start/end offsets within `text`.
 */
export function chunkText(
  text: string,
  options?: {
    size?: number;
    overlap?: number;
    idPrefix?: string;
    locFor?: (start: number, end: number, index: number) => Omit<SourceChunkLoc, "start" | "end">;
  }
): SourceChunk[] {
  const size = options?.size ?? CHUNK_SIZE;
  const overlap = options?.overlap ?? CHUNK_OVERLAP;
  const cleaned = normalizePlainText(text);
  if (!cleaned) return [];

  const chunks: SourceChunk[] = [];
  let start = 0;
  let index = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + size, cleaned.length);
    const slice = cleaned.slice(start, end);
    const locExtra = options?.locFor?.(start, end, index) ?? {};
    const hash = md5Short(`${options?.idPrefix ?? ""}:${start}:${slice}`);
    chunks.push({
      id: `chunk_${hash}`,
      text: slice,
      loc: { ...locExtra, start, end },
      hash,
    });
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
    index += 1;
  }
  return chunks;
}

export function joinChunkTexts(chunks: SourceChunk[]): string {
  return chunks.map((c) => c.text).join("\n\n");
}

/** Overview context: first chunk of each chapter (ADHD + cost). */
export function overviewSeedText(
  chunks: SourceChunk[],
  chapters: ChapterMeta[]
): string {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const parts: string[] = [];
  for (const chapter of chapters) {
    const firstId = chapter.chunkIds[0];
    const chunk = firstId ? byId.get(firstId) : undefined;
    if (!chunk) continue;
    parts.push(`## ${chapter.title}\n${chunk.text}`);
  }
  return parts.join("\n\n");
}

export function buildChapterMeta(
  title: string,
  index: number,
  chunks: SourceChunk[]
): ChapterMeta {
  return {
    title,
    index,
    chunkIds: chunks.map((c) => c.id),
  };
}
