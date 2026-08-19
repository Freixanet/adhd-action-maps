/** Shared by ComposerDock worklets — keep this file free of RN imports. */
export function keyboardLiftPx(
  keyboardHeight: number,
  insetBottom: number,
  gap: number
): number {
  'worklet';
  const closedBottom = Math.max(insetBottom, gap);
  if (keyboardHeight <= 0) return closedBottom;
  return Math.max(keyboardHeight + gap, closedBottom);
}

const KEYBOARD_GROW_RANGE = 160;

/** 0 at rest → 1 fully grown. Keyboard motion wins while it is moving; focus covers missed taps. */
export function composerGrowProgress(keyboardHeight: number, expanded: boolean): number {
  'worklet';
  const fromKeyboard = !(keyboardHeight > 0) ? 0 : Math.min(1, keyboardHeight / KEYBOARD_GROW_RANGE);
  return Math.max(fromKeyboard, expanded ? 1 : 0);
}

export function keyboardInputHeight(
  keyboardHeight: number,
  restHeight: number,
  focusedHeight: number,
  expanded = false
): number {
  'worklet';
  const t = composerGrowProgress(keyboardHeight, expanded);
  return restHeight + (focusedHeight - restHeight) * t;
}

export { KEYBOARD_GROW_RANGE };
