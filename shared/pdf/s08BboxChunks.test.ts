/**
 * Exact bbox mapping across canonicalize transforms (controls, CR/LF, spaces, emoji).
 */

import { describe, expect, it } from 'vitest';
import { segmentPdfPage } from './segmentPdf';
import { measureBboxForCharRange, buildPageTextWithItemGeoms } from './textItemBbox';
import {
  canonicalizePastedTextWithMap,
  canonicalRangeToRawRange,
} from '../pastedText';
import type { PdfPageExtraction } from './types';

describe('S08 per-chunk bbox', () => {
  it('two chunks on same page get distinct measured regions', () => {
    const items = [
      { str: 'AAAA', transform: [1, 0, 0, 1, 10, 100], width: 40, height: 12 },
      { str: ' ', transform: [1, 0, 0, 1, 50, 100], width: 4, height: 12 },
      { str: 'BBBB', transform: [1, 0, 0, 1, 60, 100], width: 40, height: 12 },
      { str: ' ', transform: [1, 0, 0, 1, 100, 100], width: 4, height: 12 },
      {
        str: 'CCCC'.repeat(80),
        transform: [1, 0, 0, 1, 10, 80],
        width: 320,
        height: 12,
      },
    ];
    const built = buildPageTextWithItemGeoms(items);
    const page: PdfPageExtraction = {
      page: 1,
      text: built.text,
      charCount: built.text.length,
      hasText: true,
      hasImages: false,
      kind: 'textual',
      textItems: built.geoms,
    };
    const segs = segmentPdfPage({ page, rawHash: 'hash', size: 8, overlap: 0 });
    expect(segs.length).toBeGreaterThanOrEqual(2);
    const a = segs[0]!;
    const b = segs[1]!;
    expect(a.loc.bbox).toBeTruthy();
    expect(b.loc.bbox).toBeTruthy();
    expect(
      a.loc.bbox!.x !== b.loc.bbox!.x ||
        a.loc.bbox!.y !== b.loc.bbox!.y ||
        a.loc.bbox!.w !== b.loc.bbox!.w ||
        a.loc.bbox!.h !== b.loc.bbox!.h
    ).toBe(true);
  });

  it('maps controls/CR/spaces-before-LF/emoji to the items that hold the excerpt', () => {
    // Raw page text with controls, CR, trailing spaces before LF, and emoji.
    const left = 'Hola';
    const mid = '🚀';
    const right = 'Mundo';
    const raw =
      `\u0001  ${left}\r\n  \t\n` + `${mid} ${right}   \n`;
    const items = [
      {
        str: `\u0001  ${left}`,
        transform: [1, 0, 0, 1, 10, 200],
        width: 40,
        height: 12,
      },
      {
        str: `\r\n  \t\n${mid}`,
        transform: [1, 0, 0, 1, 60, 180],
        width: 20,
        height: 12,
      },
      {
        str: ` ${right}   \n`,
        transform: [1, 0, 0, 1, 100, 160],
        width: 50,
        height: 12,
      },
    ];
    // Build geoms against the exact raw string offsets used as page.text.
    let cursor = 0;
    const geoms = items.map((it) => {
      const start = cursor;
      cursor += it.str.length;
      return {
        str: it.str,
        start,
        end: cursor,
        x: it.transform[4]!,
        y: it.transform[5]!,
        w: it.width,
        h: it.height,
      };
    });
    expect(raw).toBe(items.map((i) => i.str).join(''));

    const { text: canonical, rawToCanonical } = canonicalizePastedTextWithMap(raw);
    expect(canonical.includes(left)).toBe(true);
    expect(canonical.includes(mid)).toBe(true);
    expect(canonical.includes(right)).toBe(true);

    const page: PdfPageExtraction = {
      page: 1,
      text: raw,
      charCount: canonical.length,
      hasText: true,
      hasImages: false,
      kind: 'textual',
      textItems: geoms,
    };
    const segs = segmentPdfPage({
      page,
      rawHash: 'emoji-hash',
      size: Math.max(4, Math.floor(canonical.length / 2)),
      overlap: 0,
    });
    expect(segs.length).toBeGreaterThanOrEqual(2);
    for (const seg of segs) {
      expect(seg.loc.bbox).toBeTruthy();
      const rawRange = canonicalRangeToRawRange(
        rawToCanonical,
        seg.loc.start,
        seg.loc.end
      );
      expect(rawRange).toBeTruthy();
      const measured = measureBboxForCharRange(
        geoms,
        rawRange!.start,
        rawRange!.end
      );
      expect(measured).toEqual(seg.loc.bbox);
    }
    expect(
      segs[0]!.loc.bbox!.y !== segs[1]!.loc.bbox!.y ||
        segs[0]!.loc.bbox!.x !== segs[1]!.loc.bbox!.x
    ).toBe(true);
  });

  it('does not invent bbox when no overlapping items', () => {
    expect(measureBboxForCharRange([], 0, 10)).toBeUndefined();
  });
});
