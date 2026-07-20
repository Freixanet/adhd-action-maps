export const BG_BASE = '#181A1F';
export const BG_SURFACE = '#24262D';
export const BG_SURFACE_2 = '#2C2E37';
export const TEXT_PRIMARY = '#FAFAFA';
export const TEXT_BODY = '#D4D4DC';
export const TEXT_SECONDARY = '#9CA0AB';
export const ACCENT = '#8B8FF5';
export const ACCENT_PRESSED = '#7A7EE0';
/** Primary reading CTA fill (Siguiente / Completar) — distinct from brand accent. */
export const CTA_FILL = '#6A6FE0';
export const CTA_FILL_PRESSED = '#5B60D4';
export const SEM_CLAVE = '#8B8FF5';
export const SEM_MATIZ = '#E0B45C';
export const SEM_EJEMPLO = '#6FBF8F';
export const SEM_ALERTA = '#E07A6B';

export const APP_DARK_BACKGROUND = BG_BASE;
export const APP_DARK_BACKGROUND_RGB = '24, 26, 31';

export const RADII = { sm: 12, md: 16, lg: 24, pill: 9999 } as const;
export const HAIRLINE = 1;
export const GLASS_PERIMETER_HIGHLIGHT_COLOR_DARK = '#FFFFFF';
export const GLASS_PERIMETER_HIGHLIGHT_COLOR_LIGHT = '#000000';

/** Specular top-down light map for rounded-rect perimeter stroke (circles use separate stops). */
export type GlassSpecularStop = { offset: number; opacity: number };

export const GLASS_SPECULAR_PEAK_OPACITY_DARK = 0.11;
export const GLASS_SPECULAR_CURVE_END_OPACITY_DARK = 0.012;
export const GLASS_SPECULAR_BASE_OPACITY_DARK = 0.03;
export const GLASS_SPECULAR_PEAK_OPACITY_LIGHT = 0.07;
export const GLASS_SPECULAR_CURVE_END_OPACITY_LIGHT = 0.01;
export const GLASS_SPECULAR_BASE_OPACITY_LIGHT = 0.015;

export const GLASS_TOUCH_GLOW_CENTER_OPACITY_DARK = 0.16;
export const GLASS_TOUCH_GLOW_CENTER_OPACITY_LIGHT = 0.1;
/** Brighter peak for composer — first keyboard-open touch reads more clearly. */
export const GLASS_TOUCH_GLOW_COMPOSER_CENTER_OPACITY_DARK = 0.24;
export const GLASS_TOUCH_GLOW_COMPOSER_CENTER_OPACITY_LIGHT = 0.14;
export const GLASS_TOUCH_GLOW_REDUCE_MOTION_OPACITY = 0.06;
export const GLASS_TOUCH_GLOW_RADIUS_SCALE = 1.4;
export const GLASS_TOUCH_GLOW_COMPOSER_RADIUS_SCALE = 1.4;
/** Soft radial falloff — ratios relative to center opacity (peak 0.16 → 0.10 → 0.04 → 0). */
export const GLASS_TOUCH_GLOW_RADIAL_STOP_RATIOS: readonly { offset: number; ratio: number }[] = [
  { offset: 0, ratio: 1 },
  { offset: 0.35, ratio: 0.1 / 0.16 },
  { offset: 0.65, ratio: 0.04 / 0.16 },
  { offset: 1, ratio: 0 },
];
export const GLASS_TOUCH_GLOW_FADE_IN_MS = 80;
/** Composer touch glow — slow rise so the first tap is readable. */
export const GLASS_TOUCH_GLOW_FADE_IN_MS_COMPOSER = 280;
/** Time at full glow after fade-in before settling to focused hold (keyboard-open path). */
export const GLASS_TOUCH_GLOW_COMPOSER_PEAK_DWELL_MS = 1100;
export const GLASS_TOUCH_GLOW_COMPOSER_HOLD_SETTLE_MS = 700;
/** Composer idle glow while TextInput is focused (absolute center opacity). */
export const GLASS_TOUCH_GLOW_FOCUSED_HOLD_OPACITY = 0.11;
export const GLASS_TOUCH_GLOW_FADE_OUT_MS = 250;
export const INSET_HIGHLIGHT_DARK = 'inset 0 1px 1px rgba(255,255,255,0.08)';
export const BLUR_INTENSITY = 24;
export const DRAWER_CORNER_RADIUS = RADII.md;
export const COMPOSER_CORNER_RADIUS = RADII.lg;
/** Composer fill — slightly lighter than bg-surface so the dock reads as its own layer. */
export const COMPOSER_DARK_SURFACE = '#3E4041';
export const COMPOSER_DARK_INSET =
  '0 2px 24px rgba(0,0,0,0.25), inset 0 1px 0.5px rgba(255,255,255,0.12), inset 0 -1px 0.5px rgba(255,255,255,0.06)';

export function liquidGlassShellClasses(className = '', mode: 'perimeter' | 'bottom' | 'none' = 'perimeter'): string {
  const border = mode === 'bottom' ? 'border-b border-neutral-200/70' : '';
  return [border, 'overflow-hidden', className].filter(Boolean).join(' ');
}

export function liquidGlassFloatingShellClass(shapeClass: string): string {
  return `${shapeClass} overflow-hidden`;
}
