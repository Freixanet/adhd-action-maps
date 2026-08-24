import { describe, expect, it } from 'vitest';
import { font, primitive, reading, type, typography } from './design-tokens';
import { readingSizeScale, resolveReadingSizePreference } from '../mobile/src/logic/readingTypographyPreference';
import {
  readingFontFamily,
  readingItalicFontFamily,
  resolveReadingFontPreference,
} from '../mobile/src/logic/readingFontPreference';

const SCALE = [13, 15, 17, 22, 28, 34];

describe('Nucleo typography contract', () => {
  it('uses the system face and the 34/28/22/17/15/13 scale', () => {
    expect(font.family).toBe('ui-sans-serif');
    expect(primitive.fontFamily.systemUi).toBe('ui-sans-serif');
    expect(primitive.fontFamily.android).toBe('sans-serif');
    expect(type.body.fontSize).toBe(17);
    expect(type.body.fontWeight).toBe('400');
    expect(type.body.lineHeight / type.body.fontSize).toBeCloseTo(1.4, 1);
    expect(type.pageTitle.fontSize).toBe(28);
    expect(type.pageTitle.fontWeight).toBe('700');
    expect(type.pageTitle.lineHeight / type.pageTitle.fontSize).toBeCloseTo(1.15, 1);
    expect(type.pageTitle.letterSpacing).toBeCloseTo(28 * -0.02);
    expect(type.display.fontSize).toBe(34);
    expect(type.display.letterSpacing).toBeCloseTo(34 * -0.02);
    expect(type.heading.fontSize).toBe(22);
    expect(type.heading.fontWeight).toBe('500');
    expect(type.heading.letterSpacing).toBe(0);
    expect(reading.wideMinChars).toBe(60);
    expect(reading.wideMaxChars).toBe(75);
  });

  it('keeps every type role on the six-step scale', () => {
    for (const role of Object.values(type)) {
      expect(SCALE).toContain(role.fontSize);
    }
  });

  it('exposes only semantic typography through the helper', () => {
    expect(typography('readingBody').fontFamily).toBe('ui-sans-serif');
    expect(typography('readingBody').lineHeight).toBeGreaterThan(typography('readingBody').fontSize);
  });

  it('normalizes and scales the persisted reading preference', () => {
    expect(resolveReadingSizePreference('large')).toBe('large');
    expect(resolveReadingSizePreference('unknown')).toBe('system');
    expect(readingSizeScale('extraLarge')).toBeCloseTo(1.28);
  });

  it('defaults to SF Pro on iOS and Roboto on Android', () => {
    expect(resolveReadingFontPreference('sfRounded')).toBe('sfRounded');
    expect(resolveReadingFontPreference('unknown')).toBe('sfPro');
    expect(readingFontFamily('sourceSans', 'ios')).toBe('SourceSans3');
    expect(readingFontFamily('sfPro', 'ios')).toBe('ui-sans-serif');
    expect(readingFontFamily('sfRounded', 'ios')).toBe('ui-rounded');
    expect(readingFontFamily('sfRounded', 'android')).toBe('sans-serif');
    expect(readingItalicFontFamily('ios')).toBe('ui-sans-serif');
    expect(readingItalicFontFamily('android')).toBe('sans-serif');
  });
});
