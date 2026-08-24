import { describe, expect, it } from 'vitest';
import {
  buildNucleoRoundCarouselSvg,
  escapeXml,
  wrapCardTitle,
} from './nucleoRoundCarouselCard.ts';

const paint = {
  size: 220,
  canvas: 'canvas-color',
  accentSoft: 'accent-soft',
  textPrimary: 'text-primary',
  title: 'Hábitos & foco',
  titleSize: 17,
  titleLineHeight: 22,
  titleWeight: 700,
  titleTracking: -0.1,
  fontFamily: 'SourceSans3',
  coverRatio: 0.76,
  artScale: 1.12,
  artOffsetY: -16,
  padX: 12,
  padBottom: 8,
  illustrationXml: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
  focusViewBox: '0 0 10 10',
};

describe('wrapCardTitle', () => {
  it('keeps a short title on one line', () => {
    expect(wrapCardTitle('Hábitos', 20)).toEqual(['Hábitos']);
  });

  it('wraps to two lines and ellipsizes overflow', () => {
    const lines = wrapCardTitle('Una lista bastante larga de palabras para el título', 12, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('…')).toBe(true);
  });
});

describe('buildNucleoRoundCarouselSvg', () => {
  it('bakes an opaque canvas then the accent wash so overlapping faces stay solid', () => {
    const svg = buildNucleoRoundCarouselSvg(paint);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('fill="canvas-color"');
    expect(svg).toContain('fill="accent-soft"');
    expect(svg.indexOf('canvas-color')).toBeLessThan(svg.indexOf('accent-soft'));
  });

  it('nests the illustration and escapes the title', () => {
    const svg = buildNucleoRoundCarouselSvg(paint);
    expect(svg).toContain('<circle cx="5" cy="5" r="4"/>');
    expect(svg).toContain('Hábitos &amp; foco');
    expect(svg).not.toContain('Hábitos & foco');
  });

  it('still paints a titled face when the illustration is missing', () => {
    const svg = buildNucleoRoundCarouselSvg({ ...paint, illustrationXml: null, title: 'Solo texto' });
    expect(svg).not.toContain('<circle');
    expect(svg).toContain('Solo texto');
  });
});

describe('escapeXml', () => {
  it('escapes markup so titles cannot break the SVG', () => {
    expect(escapeXml(`<x a="1">`)).toBe('&lt;x a=&quot;1&quot;&gt;');
  });
});
