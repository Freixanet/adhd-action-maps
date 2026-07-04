export type ContinueChipRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
};

export type ContinueTransitionMode = 'expand' | 'collapse';

export type ContinueTransitionSnapshot = {
  mode: ContinueTransitionMode;
  chipRect: ContinueChipRect;
  chipLabel: string;
  entryId: string;
};

export const CONTINUE_EXPAND_SPRING = {
  damping: 40,
  stiffness: 380,
  overshootClamping: true,
} as const;

/** Clamp spring progress so mask geometry never exceeds full screen (prevents iOS overshoot flash). */
export function clampContinueProgress(progress: number): number {
  'worklet';
  return Math.min(1, Math.max(0, progress));
}
export const CONTINUE_MASK_BORDER_RADIUS = 24;
/** borderRadius 24→0 only in the final 15% of expand/collapse progress. */
export const CONTINUE_MASK_RADIUS_ZERO_START = 0.85;
export const CONTINUE_CHIP_FADE_MS = 100;
export const CONTINUE_REDUCED_MOTION_MS = 150;
/** Reverse container-transform only if back happens within this window after entry. */
export const CONTINUE_IMMEDIATE_BACK_MS = 8000;

export function buildContinueChipLabel(title: string): string {
  const trimmed = title.trim();
  const display = trimmed.length <= 28 ? trimmed : `${trimmed.slice(0, 27)}…`;
  return `Continuar · ${display}`;
}
