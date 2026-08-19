/**
 * Editorial color system (reading lamina).
 * Own module so Metro HMR cannot leave pages importing missing uiTokens exports.
 */

export const EDITORIAL_SHEET_BG = '#F7F4EC';
export const EDITORIAL_SHEET_BG_WARM = '#FFF9EC';
export const EDITORIAL_TEXT = '#111111';
export const EDITORIAL_TEXT_BODY = '#3A3A3A';
/** Secondary copy on light sheet — accessible grey-brown. */
export const EDITORIAL_TEXT_MUTED = '#68645F';
/** Decorative mustard (bars, borders, illustration accents). Not for small text. */
export const EDITORIAL_GRAPHIC_YELLOW = '#E0B45C';
/** Ochre for labels/kickers on light backgrounds. */
export const EDITORIAL_TEXT_OCHRE = '#8A651B';
/** Alias kept for older bundles / HMR. Prefer GRAPHIC or TEXT_OCHRE. */
export const EDITORIAL_ACCENT_YELLOW = EDITORIAL_GRAPHIC_YELLOW;
export const EDITORIAL_ACCENT_LAVENDER = '#8B8FF5';
export const EDITORIAL_CALLOUT_DARK = '#111111';
export const EDITORIAL_CALLOUT_DARK_TEXT = '#F7F4EC';
export const EDITORIAL_PHRASE_BG = '#FFF6D8';
export const EDITORIAL_BORDER_SOFT = 'rgba(0,0,0,0.06)';
export const EDITORIAL_YELLOW_BORDER = 'rgba(224,180,92,0.40)';
