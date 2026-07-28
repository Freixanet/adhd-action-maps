import type { SourceChunkLoc } from './types/chunk';

/** Short chip label: `p.23`, `Cap. 2`, `Foto`, or `Fuente`. */
export function citationLabelFromLoc(loc: SourceChunkLoc): string {
  if (typeof loc.page === 'number' && Number.isFinite(loc.page)) {
    return `p.${loc.page}`;
  }
  if (typeof loc.chapterIndex === 'number' && Number.isFinite(loc.chapterIndex)) {
    return `Cap. ${loc.chapterIndex + 1}`;
  }
  if (loc.imageId) return 'Foto';
  return 'Fuente';
}

/** Longer header for the source viewer. */
export function citationHeaderFromLoc(loc: SourceChunkLoc): string {
  if (typeof loc.page === 'number' && Number.isFinite(loc.page)) {
    return `p.${loc.page}`;
  }
  if (typeof loc.chapterIndex === 'number' && Number.isFinite(loc.chapterIndex)) {
    const n = loc.chapterIndex + 1;
    return loc.chapterTitle?.trim()
      ? `Cap. ${n} · ${loc.chapterTitle.trim()}`
      : `Cap. ${n}`;
  }
  if (loc.imageId) return 'Foto';
  return 'Fuente';
}
