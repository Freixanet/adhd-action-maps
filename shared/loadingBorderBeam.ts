/**
 * Pure Border Beam configuration — no Skia / React Native imports.
 * Used by LoadingBorderBeam and unit tests.
 */

export type LoadingBorderBeamVariant = 'full' | 'compact';

export type LoadingBorderBeamVariantConfig = {
  /** Orbit duration in ms (one full perimeter lap). */
  durationMs: number;
  /** Fraction of perimeter occupied by the luminous trail. */
  trailRatio: number;
  /** Outer bloom stroke width. */
  haloWidth: number;
  /** Mid trail stroke width. */
  midWidth: number;
  /** Fine nucleus stroke width. */
  coreWidth: number;
  /** Outer bloom blur radius. */
  haloBlur: number;
  /** Mid trail blur radius. */
  midBlur: number;
  /** Extra canvas padding so bloom is not clipped. */
  canvasPad: number;
  /** Strength multiplier applied to opacities (0–1+). */
  strength: number;
  /** Subtle always-on perimeter line opacity. */
  baseStrokeOpacity: number;
};

export const LOADING_BORDER_BEAM_DEFAULT_DURATION_MS = 2600;

export const LOADING_BORDER_BEAM_VARIANTS: Record<
  LoadingBorderBeamVariant,
  LoadingBorderBeamVariantConfig
> = {
  full: {
    durationMs: LOADING_BORDER_BEAM_DEFAULT_DURATION_MS,
    trailRatio: 0.14,
    haloWidth: 10,
    midWidth: 4.5,
    coreWidth: 1.6,
    haloBlur: 7,
    midBlur: 2.2,
    canvasPad: 14,
    strength: 1,
    baseStrokeOpacity: 0.14,
  },
  compact: {
    durationMs: LOADING_BORDER_BEAM_DEFAULT_DURATION_MS,
    trailRatio: 0.12,
    haloWidth: 7,
    midWidth: 3.2,
    coreWidth: 1.35,
    haloBlur: 5,
    midBlur: 1.6,
    canvasPad: 10,
    strength: 0.72,
    baseStrokeOpacity: 0.12,
  },
};

/** Rounded-rect perimeter (straight runs + quarter-circle corners). */
export function roundRectPerimeter(width: number, height: number, radius: number): number {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  return 2 * (w + h - 2 * r) + 2 * Math.PI * r;
}

/** Dash on / gap off so a short trail travels the full perimeter. */
export function beamDashIntervals(
  perimeter: number,
  trailRatio: number
): readonly [number, number] {
  const p = Math.max(1, perimeter);
  const on = Math.max(8, Math.min(p * 0.45, p * Math.max(0.04, Math.min(0.4, trailRatio))));
  const off = Math.max(1, p - on);
  return [on, off];
}

export function shouldAnimateLoadingBorderBeam(options: {
  active: boolean;
  reduceMotion: boolean;
}): boolean {
  return options.active && !options.reduceMotion;
}

/**
 * Surfaces that may show the beam. Decorative only — never for ready/error/cancelled.
 */
export function shouldShowLoadingBorderBeam(options: {
  active: boolean;
  status?: 'generating' | 'ready' | 'error' | 'cancelled' | string | null;
}): boolean {
  if (!options.active) return false;
  if (options.status == null) return true;
  return options.status === 'generating';
}

/** Nucleo editorial beam palette (lavender + brief yellow tint + cold white peak). */
export function beamLayerColors(strength: number): {
  halo: string;
  mid: string;
  core: string;
  peak: string;
  base: string;
} {
  const s = Math.max(0, Math.min(1.4, strength));
  return {
    halo: `rgba(139, 143, 245, ${0.22 * s})`,
    mid: `rgba(168, 172, 255, ${0.55 * s})`,
    core: `rgba(198, 201, 255, ${0.92 * s})`,
    peak: `rgba(248, 249, 255, ${0.95 * s})`,
    base: `rgba(139, 143, 245, ${0.14 * Math.min(1, s)})`,
  };
}

/** Brief yellow matiz stop — tint only, never dominant. */
export const BEAM_YELLOW_TINT = 'rgba(224, 180, 92, 0.28)';
