/**
 * Editorial spacing system (reading lamina).
 * Kept in its own module so Metro HMR cannot leave StyleSheet.create
 * pointing at a stale uiTokens without these exports.
 */

export const EDITORIAL_GUTTER = 24;
export const EDITORIAL_GUTTER_NARROW = 20;
export const EDITORIAL_NARROW_BREAKPOINT = 390;
export const EDITORIAL_MAX_READ_WIDTH = 440;

export const EDITORIAL_SPACE = {
  titleToSubtitle: 8,
  headerToContent: 22,
  artToBlockTitle: 8,
  titleToBody: 4,
  betweenBlocks: 16,
  cardPadding: 16,
  contentToNav: 16,
} as const;

export function editorialGutter(screenWidth: number): number {
  return screenWidth < EDITORIAL_NARROW_BREAKPOINT ? EDITORIAL_GUTTER_NARROW : EDITORIAL_GUTTER;
}

/** Content width inside gutters, capped and ready to center. */
export function editorialContentWidth(screenWidth: number): number {
  const gutter = editorialGutter(screenWidth);
  return Math.min(screenWidth - gutter * 2, EDITORIAL_MAX_READ_WIDTH);
}
