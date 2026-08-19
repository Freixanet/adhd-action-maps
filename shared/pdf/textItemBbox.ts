/**
 * Measure bbox for a char range from pdf.js text items with page offsets.
 * Never invents geometry — returns undefined when no overlapping measured items.
 */

export type PdfTextItemGeom = {
  str: string;
  /** Inclusive start offset in page text (UTF-16 units). */
  start: number;
  /** Exclusive end offset in page text. */
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function measureBboxForCharRange(
  items: PdfTextItemGeom[] | undefined,
  start: number,
  end: number
): { x: number; y: number; w: number; h: number } | undefined {
  if (!items?.length || end <= start) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const item of items) {
    if (item.end <= start || item.start >= end) continue;
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.w);
    maxY = Math.max(maxY, item.y + item.h);
    any = true;
  }
  if (!any || !Number.isFinite(minX)) return undefined;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Build page text + item geometries from pdf.js text content items.
 * Joins with a single space between non-empty strings (matches extract join).
 */
export function buildPageTextWithItemGeoms(
  items: Array<{ str?: string; transform?: number[]; width?: number; height?: number }>
): { text: string; geoms: PdfTextItemGeom[] } {
  const parts: string[] = [];
  const geoms: PdfTextItemGeom[] = [];
  let cursor = 0;
  for (const item of items) {
    const str = typeof item.str === 'string' ? item.str : '';
    if (!str) continue;
    if (parts.length > 0) {
      parts.push(' ');
      cursor += 1;
    }
    const start = cursor;
    parts.push(str);
    cursor += str.length;
    if (item.transform && item.transform.length >= 6) {
      const x = item.transform[4]!;
      const y = item.transform[5]!;
      const w = typeof item.width === 'number' ? item.width : 0;
      const h =
        typeof item.height === 'number' ? item.height : Math.abs(item.transform[3] ?? 0);
      geoms.push({ str, start, end: cursor, x, y, w, h });
    }
  }
  return { text: parts.join(''), geoms };
}
