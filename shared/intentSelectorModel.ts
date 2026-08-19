import type { MapIntent } from './contracts';

export type IntentSelectorOptionId = Extract<MapIntent, 'understand' | 'apply'>;

export const INTENT_SELECTOR_OPTIONS: ReadonlyArray<{
  id: IntentSelectorOptionId;
  label: 'Entender' | 'Aplicar';
}> = [
  { id: 'understand', label: 'Entender' },
  { id: 'apply', label: 'Aplicar' },
] as const;

/** Layout tokens — provisional Núcleo capsule; not claimed ChatGPT measurements. */
export const INTENT_SELECTOR_LAYOUT = {
  trackPad: 3,
  segmentWidth: 92,
  /** Meets 44pt min touch height per option. */
  trackHeight: 44,
  labelFontSize: 14,
  labelFontWeight: '600' as const,
} as const;

export const INTENT_SELECTOR_TRACK_WIDTH =
  INTENT_SELECTOR_LAYOUT.segmentWidth * 2 + INTENT_SELECTOR_LAYOUT.trackPad * 2;

export const INTENT_SELECTOR_THUMB_HEIGHT =
  INTENT_SELECTOR_LAYOUT.trackHeight - INTENT_SELECTOR_LAYOUT.trackPad * 2;

export const INTENT_SELECTOR_THUMB_TRAVEL = INTENT_SELECTOR_LAYOUT.segmentWidth;

export function intentToSelectorIndex(intent: MapIntent): 0 | 1 {
  return intent === 'apply' ? 1 : 0;
}

export function selectorIndexToIntent(index: number): IntentSelectorOptionId {
  return index >= 1 ? 'apply' : 'understand';
}

/**
 * Single commit gate: one functional change per resolved selection.
 * Capsule index and intent stay paired.
 */
export function resolveIntentSelectorCommit(args: {
  current: MapIntent;
  nextIndex: number;
}): { intent: IntentSelectorOptionId; index: 0 | 1; changed: boolean } {
  const index = (args.nextIndex >= 1 ? 1 : 0) as 0 | 1;
  const intent = selectorIndexToIntent(index);
  const currentNormalized: IntentSelectorOptionId =
    args.current === 'apply' ? 'apply' : 'understand';
  return {
    intent,
    index,
    changed: intent !== currentNormalized,
  };
}

/** Snap pan progress (+ fling) to a segment without leaving an empty selection. */
export function projectPanToSelectorIndex(progress: number, velocityX: number): 0 | 1 {
  const projected = progress + velocityX / 2400;
  return projected >= 0.5 ? 1 : 0;
}

export function clampSelectorProgress(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function shouldAnimateIntentThumb(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

export function intentSelectorAccessibilityLabel(
  option: IntentSelectorOptionId
): 'Entender' | 'Aplicar' {
  return option === 'apply' ? 'Aplicar' : 'Entender';
}

/** Structure markers — tests fail if the solid base surfaces disappear. */
export const INTENT_SELECTOR_TEST_IDS = {
  root: 'intent-selector',
  trackSurface: 'intent-selector-track-surface',
  thumbSurface: 'intent-selector-thumb-surface',
  optionUnderstand: 'intent-selector-option-understand',
  optionApply: 'intent-selector-option-apply',
} as const;
