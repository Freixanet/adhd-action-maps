import { isNativeGlassButtonAvailable } from '../../modules/nucleo-glass-button/src';

/**
 * Master switch for routing app buttons through the native UIKit glass
 * `UIButton`. Flip to `false` to put every button back on the JS `GlassSurface`
 * chrome without touching call sites.
 */
export const USE_NATIVE_GLASS_BUTTONS = true;

/**
 * Accent CTAs (Siguiente, Abrir Núcleo, Nuevo Núcleo, enviar) ship as solid
 * `CTA_FILL`. When this is `true` they render as `prominentGlass()` instead.
 * Flip to `false` to revert only the filled CTAs, keeping the rest native.
 */
export const USE_NATIVE_GLASS_FILLED_CTAS = true;

/** Native glass for neutral buttons: available, enabled, and not reduce-transparency. */
export function shouldUseNativeGlassButton(reduceTransparency: boolean): boolean {
  return USE_NATIVE_GLASS_BUTTONS && !reduceTransparency && isNativeGlassButtonAvailable();
}

/** Native glass for accent/filled CTAs — gated by both switches. */
export function shouldUseNativeGlassFilledCta(reduceTransparency: boolean): boolean {
  return USE_NATIVE_GLASS_FILLED_CTAS && shouldUseNativeGlassButton(reduceTransparency);
}
