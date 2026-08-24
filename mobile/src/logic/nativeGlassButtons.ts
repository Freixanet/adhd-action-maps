import {
  getGlassButtonImplementationMode,
  isNativeGlassButtonAvailable,
} from '../../modules/nucleo-glass-button/src';

/** Two-line drawer glyph drawn as UIButton.Configuration.image so glass morphs it. */
export const NATIVE_MENU_TWO_LINES = 'nucleo.menu.two';

/**
 * Product path on iOS 26+: UIKit `UIButton.Configuration.glass()` / `.prominentGlass()`.
 * Availability alone decides — no permanent off switch.
 * Reduce Transparency must not force RN imitation; iOS flattens the system control.
 */
export function shouldUseNativeGlassButton(_reduceTransparency = false): boolean {
  return isNativeGlassButtonAvailable();
}

/** Prominent CTAs use the same availability gate. */
export function shouldUseNativeGlassFilledCta(reduceTransparency = false): boolean {
  return shouldUseNativeGlassButton(reduceTransparency);
}

export function resolveGlassButtonImplementation(
  _reduceTransparency = false
): 'native_system_glass' | 'fallback_solid' {
  return getGlassButtonImplementationMode();
}

/** @deprecated Use availability; kept so call sites / tests don't reintroduce kill-switches. */
export const USE_NATIVE_GLASS_BUTTONS = true;
/** @deprecated Use availability; kept so call sites / tests don't reintroduce kill-switches. */
export const USE_NATIVE_GLASS_FILLED_CTAS = true;
