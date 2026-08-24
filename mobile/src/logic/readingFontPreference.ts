import { getStorage } from '@shared/storage';
import { primitive } from '@shared/design-tokens';

export const READING_FONT_OPTIONS = [
  { id: 'sfPro', label: 'SF Pro' },
  { id: 'sfRounded', label: 'SF Pro Rounded' },
  { id: 'sourceSans', label: 'Source Sans 3' },
] as const;

export type ReadingFontPreference = (typeof READING_FONT_OPTIONS)[number]['id'];

const STORAGE_KEY = 'nucleo.reading-font-preference';

export function resolveReadingFontPreference(value: unknown): ReadingFontPreference {
  const raw = typeof value === 'string' ? value : '';
  return READING_FONT_OPTIONS.some((option) => option.id === raw)
    ? (raw as ReadingFontPreference)
    : 'sfPro';
}

export function getInitialReadingFontPreference(): ReadingFontPreference {
  try {
    return resolveReadingFontPreference(getStorage().getItem(STORAGE_KEY));
  } catch {
    return 'sfPro';
  }
}

export function saveReadingFontPreference(value: ReadingFontPreference): void {
  try {
    getStorage().setItem(STORAGE_KEY, value);
  } catch {
    // Local preference is best-effort.
  }
}

export function readingFontFamily(id: ReadingFontPreference, platformOS: string): string {
  if (platformOS !== 'ios') return primitive.fontFamily.android;
  if (id === 'sfRounded') return primitive.fontFamily.rounded;
  if (id === 'sourceSans') return primitive.fontFamily.reading;
  return primitive.fontFamily.systemUi;
}

/** Rounded and the bundled Source Sans 3 face have no italic. Use SF Pro italic on iOS. */
export function readingItalicFontFamily(platformOS: string): string {
  return platformOS === 'ios' ? primitive.fontFamily.systemUi : primitive.fontFamily.android;
}
