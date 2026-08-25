/**
 * Hybrid icon appearance: Hugeicons (24×24 viewBox) + SF Symbols (optical point size).
 * Stroke weight and fill are orthogonal — never derive one from the other.
 */

export type SfWeight = 'regular' | 'medium' | 'semibold';

/** SF Symbols render lighter than Hugeicons at the same nominal size. */
export const SF_OPTICAL_SCALE = 1.1;

export function sfOpticalSize(nominalSize: number): number {
  return nominalSize * SF_OPTICAL_SCALE;
}

/**
 * Map Hugeicons strokeWidth onto SF SymbolWeight.
 * 1.5 → regular, 2 → medium, 2.5 (iconEmphasis) → semibold.
 */
export function sfWeightForStroke(strokeWidth: number): SfWeight {
  if (strokeWidth < 2) return 'regular';
  if (strokeWidth < 2.4) return 'medium';
  return 'semibold';
}

export function resolveSfSymbolName<TName>(
  sf: { name: TName; fill?: TName },
  filled: boolean
): TName {
  return filled && sf.fill != null ? sf.fill : sf.name;
}
