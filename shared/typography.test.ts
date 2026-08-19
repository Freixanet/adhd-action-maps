import { describe, expect, it } from 'vitest';
import { font, primitive, reading, type, typography } from './design-tokens';
import { readingSizeScale, resolveReadingSizePreference } from '../mobile/src/logic/readingTypographyPreference';
import {
  readingFontFamily,
  readingItalicFontFamily,
  resolveReadingFontPreference,
} from '../mobile/src/logic/readingFontPreference';

describe('Nucleo typography contract', () => {
  it('uses one local family and a readable body measure', () => {
    expect(font.family).toBe('SourceSans3');
    expect(primitive.fontFamily.rounded).toBe('ui-rounded');
    expect(primitive.fontFamily.systemUi).toBe('ui-sans-serif');
    expect(type.body.fontSize).toBeGreaterThanOrEqual(17);
    expect(type.body.lineHeight / type.body.fontSize).toBeGreaterThanOrEqual(1.5);
    expect(reading.wideMinChars).toBe(60);
    expect(reading.wideMaxChars).toBe(75);
  });

  it('exposes only semantic typography through the helper', () => {
    expect(typography('readingBody').fontFamily).toBe('SourceSans3');
    expect(typography('readingBody').lineHeight).toBeGreaterThan(typography('readingBody').fontSize);
  });

  it('normalizes and scales the persisted reading preference', () => {
    expect(resolveReadingSizePreference('large')).toBe('large');
    expect(resolveReadingSizePreference('unknown')).toBe('system');
    expect(readingSizeScale('extraLarge')).toBeCloseTo(1.28);
  });

  it('resolves the iOS font trial without leaving Source Sans on other platforms', () => {
    expect(resolveReadingFontPreference('sfRounded')).toBe('sfRounded');
    expect(resolveReadingFontPreference('unknown')).toBe('sourceSans');
    expect(readingFontFamily('sourceSans', 'ios')).toBe('SourceSans3');
    expect(readingFontFamily('sfPro', 'ios')).toBe('ui-sans-serif');
    expect(readingFontFamily('sfRounded', 'ios')).toBe('ui-rounded');
    expect(readingFontFamily('sfRounded', 'android')).toBe('SourceSans3');
    expect(readingItalicFontFamily('ios')).toBe('ui-sans-serif');
    expect(readingItalicFontFamily('android')).toBe('SourceSans3');
  });
});
