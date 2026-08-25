/**
 * Locked Streamline family for nucleo-editorial-v1.
 *
 * Compared for this vertical:
 * - UX Line (`ux-line`): clean monoline UI icons — matches list / sequence spots.
 * - New York Monoline (`new-york`): more decorative hand-drawn line work.
 *
 * Choice: UX Line. Editorial list icons and experiment spots need crisp, readable
 * metaphors at small sizes; New York reads busier on dark Nucleo surfaces.
 *
 * Visual Streamline assets still require STREAMLINE_API_KEY. Without the key the
 * app uses local editorial SVG scenes — never empty circles.
 */
export const STREAMLINE_LOCKED_FAMILY_SLUG = 'ux-line' as const;
export const STREAMLINE_LOCKED_FAMILY_NAME = 'UX Line' as const;
export const STREAMLINE_LOCKED_PRODUCT_TYPE = 'icons' as const;

/** Reject any candidate whose familySlug is not the locked family. */
export function isLockedStreamlineFamily(familySlug: unknown): boolean {
  return typeof familySlug === 'string' && familySlug.trim().toLowerCase() === STREAMLINE_LOCKED_FAMILY_SLUG;
}
