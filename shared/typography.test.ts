import { describe, expect, it } from 'vitest';
import {
  canonicalTypeRoles,
  font,
  overlineTypeRole,
  primitive,
  reading,
  type,
  typeRoleAliases,
  typography,
} from './design-tokens';
import { readingSizeScale, resolveReadingSizePreference } from '../mobile/src/logic/readingTypographyPreference';
import {
  readingFontFamily,
  readingItalicFontFamily,
  resolveReadingFontPreference,
} from '../mobile/src/logic/readingFontPreference';

const SCALE = [13, 15, 17, 22, 28, 34];
const SIZE_WEIGHT_ROLES = [
  'display',
  'pageTitle',
  'heading',
  'title',
  'body',
  'caption',
  'callout',
  'meta',
] as const;

function roleKey(style: (typeof type)[keyof typeof type]) {
  return [
    style.fontSize,
    style.lineHeight,
    style.fontWeight,
    style.letterSpacing,
    'textTransform' in style ? style.textTransform : '',
  ].join('/');
}

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
    expect(type.heading.fontWeight).toBe('600');
    expect(type.heading.letterSpacing).toBe(0);
    expect(reading.wideMinChars).toBe(60);
    expect(reading.wideMaxChars).toBe(75);
  });

  it('exposes eight size×weight roles and keeps kicker as the overline of meta', () => {
    expect([...canonicalTypeRoles]).toEqual([...SIZE_WEIGHT_ROLES]);
    expect(overlineTypeRole).toBe('kicker');
    const unique = new Set(SIZE_WEIGHT_ROLES.map((role) => roleKey(type[role])));
    expect(unique.size).toBe(8);
    expect(type.kicker.fontSize).toBe(type.meta.fontSize);
    expect(type.kicker.lineHeight).toBe(type.meta.lineHeight);
    expect(type.kicker.fontWeight).toBe(type.meta.fontWeight);
    expect(type.kicker.letterSpacing).toBeGreaterThan(0);
    expect(type.kicker.textTransform).toBe('uppercase');
  });

  it('resolves deprecated type aliases to a canonical role', () => {
    expect(type.sectionTitle).toEqual(type.heading);
    expect(type.subtitle).toEqual(type.heading);
    expect(type.readingSection).toEqual(type.heading);
    expect(type.label).toEqual(type.meta);
    expect(type.micro).toEqual(type.meta);
    expect(type.readingBody).toEqual(type.body);
    expect(type.readingLead).toEqual(type.body);
    expect(type.lumenKicker).toEqual(type.kicker);
    for (const [alias, target] of Object.entries(typeRoleAliases)) {
      expect(type[alias as keyof typeof type]).toEqual(type[target as keyof typeof type]);
    }
  });

  it('collapses the primitive size ramp to six values', () => {
    const numeric = Object.values(primitive.fontSize).filter((value) => typeof value === 'number');
    expect(new Set(numeric)).toEqual(new Set(SCALE));
    expect(primitive.fontSize.xs).toBe(13);
    expect(primitive.fontSize.sm).toBe(13);
    expect(primitive.fontSize.md).toBe(13);
    expect(primitive.fontSize['13']).toBe(13);
    expect(primitive.fontSize['34']).toBe(34);
  });

  it('uses 600 or 700 for type at 22px and above', () => {
    for (const role of Object.values(type)) {
      if (role.fontSize >= 22) {
        expect(['600', '700']).toContain(role.fontWeight);
      }
    }
    expect(type.heading.fontWeight).toBe('600');
    expect(type.pageTitle.fontWeight).toBe('700');
    expect(type.display.fontWeight).toBe('700');
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
