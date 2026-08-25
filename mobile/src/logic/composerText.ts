import { space, type } from '@shared/design-tokens';

export const COMPOSER_CONTROL_SIZE = 38;
export const COMPOSER_PLUS_ICON_SIZE = 22;
export const COMPOSER_REST_INPUT_HEIGHT = COMPOSER_CONTROL_SIZE;
export const COMPOSER_FOCUSED_INPUT_HEIGHT = 88;
export const COMPOSER_MAX_VIEWPORT_RATIO = 0.4;
export const COMPOSER_LINE_HEIGHT = type.input.fontSize;
export const COMPOSER_REST_TEXT_PAD_TOP =
  (COMPOSER_REST_INPUT_HEIGHT - COMPOSER_LINE_HEIGHT) / 2;
export const COMPOSER_REST_TEXT_PAD_BOTTOM =
  COMPOSER_REST_TEXT_PAD_TOP - space.stack.xs;
export const COMPOSER_REST_TEXT_INSET = COMPOSER_REST_TEXT_PAD_TOP;
export const PASTE_COLLAPSE_CHAR_THRESHOLD = 500;
const PASTE_DETECT_MIN_DELTA = 40;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function shouldCollapsePastedText(prev: string, next: string): boolean {
  if (next.length <= PASTE_COLLAPSE_CHAR_THRESHOLD) return false;
  const delta = next.length - prev.length;
  return delta >= PASTE_DETECT_MIN_DELTA;
}

export function formatPastedTextChipLabel(text: string): string {
  const words = countWords(text);
  return `Texto · ${words} ${words === 1 ? 'palabra' : 'palabras'}`;
}
