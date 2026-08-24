/**
 * Square face markup for Originkit Round Carousel.
 * Bakes the home card (canvas + accent wash + illustration + title) so CSS
 * `background-size: cover` receives an opaque image — overlapping 3D faces
 * must not show through to the page.
 */

export type NucleoRoundCarouselCardPaint = {
  size: number;
  canvas: string;
  accentSoft: string;
  textPrimary: string;
  title: string;
  titleSize: number;
  titleLineHeight: number;
  titleWeight: number | string;
  titleTracking: number;
  fontFamily: string;
  coverRatio: number;
  artScale: number;
  artOffsetY: number;
  padX: number;
  padBottom: number;
  illustrationXml: string | null;
  focusViewBox?: string;
};

const TITLE_LINES = 2;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function wrapCardTitle(title: string, maxCharsPerLine: number, maxLines = TITLE_LINES): string[] {
  const limit = Math.max(4, Math.floor(maxCharsPerLine));
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  const push = (line: string) => {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  };

  for (const word of words) {
    if (lines.length === maxLines) break;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current) {
      push(current);
      current = '';
      if (lines.length === maxLines) break;
    }
    if (word.length > limit) {
      const cut = limit - (lines.length === maxLines - 1 ? 1 : 0);
      const piece = `${word.slice(0, Math.max(1, cut))}${lines.length === maxLines - 1 ? '…' : ''}`;
      push(piece);
      current = '';
    } else {
      current = word;
    }
  }

  if (current && lines.length < maxLines) push(current);
  if (lines.length === maxLines && (words.join(' ').length > lines.join(' ').length)) {
    const last = lines[maxLines - 1] ?? '';
    if (!last.endsWith('…')) {
      lines[maxLines - 1] = last.length >= limit ? `${last.slice(0, Math.max(1, limit - 1))}…` : `${last}…`;
    }
  }
  return lines.slice(0, maxLines);
}

function nestIllustration(
  xml: string,
  x: number,
  y: number,
  width: number,
  height: number,
  focusViewBox?: string
): string {
  let next = xml.trim().replace(/<\?xml[^?]+\?>/i, '').trim();
  if (focusViewBox) {
    next = /viewBox=/.test(next)
      ? next.replace(/viewBox="[^"]*"/, `viewBox="${focusViewBox}"`)
      : next.replace(/<svg\b/, `<svg viewBox="${focusViewBox}"`);
  }
  if (/preserveAspectRatio=/.test(next)) {
    next = next.replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="xMidYMid meet"');
  } else {
    next = next.replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid meet"');
  }
  return next.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const cleaned = String(attrs)
      .replace(/\swidth="[^"]*"/gi, '')
      .replace(/\sheight="[^"]*"/gi, '')
      .replace(/\sx="[^"]*"/gi, '')
      .replace(/\sy="[^"]*"/gi, '');
    return `<svg${cleaned} x="${x}" y="${y}" width="${width}" height="${height}">`;
  });
}

export function buildNucleoRoundCarouselSvg(paint: NucleoRoundCarouselCardPaint): string {
  const size = Math.max(1, Math.round(paint.size));
  const textBand = Math.round(size * (1 - paint.coverRatio));
  const artPlane = Math.max(0, size - textBand);
  const artSize = Math.min(size, artPlane) * paint.artScale;
  const artX = (size - artSize) / 2;
  const artY = (artPlane - artSize) / 2 + paint.artOffsetY;

  const avgGlyph = paint.titleSize * 0.52;
  const maxChars = Math.max(8, Math.floor((size - paint.padX * 2) / avgGlyph));
  const lines = wrapCardTitle(paint.title, maxChars);
  const textTop = size - textBand + paint.padBottom;
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? paint.titleSize : paint.titleLineHeight;
      return `<tspan x="${paint.padX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  const illustration = paint.illustrationXml
    ? nestIllustration(paint.illustrationXml, artX, artY, artSize, artSize, paint.focusViewBox)
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="${escapeXml(paint.canvas)}"/>`,
    `<rect width="${size}" height="${size}" fill="${escapeXml(paint.accentSoft)}"/>`,
    illustration,
    `<text x="${paint.padX}" y="${textTop}" fill="${escapeXml(paint.textPrimary)}" font-family="${escapeXml(paint.fontFamily)}, system-ui, sans-serif" font-size="${paint.titleSize}" font-weight="${paint.titleWeight}" letter-spacing="${paint.titleTracking}">${tspans}</text>`,
    `</svg>`,
  ].join('');
}
