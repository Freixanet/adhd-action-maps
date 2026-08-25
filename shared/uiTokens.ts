/**
 * Static color aliases resolve to the **dark** theme for backward compatibility.
 * Dynamic UI must use `uiColorsFor(scheme)` or `useThemeColors()` from ThemeContext.
 * Do not treat these constants as theme-aware.
 */
import { glass, primitive, themeColor, type ColorSchemeName } from './design-tokens/generated/tokens';

const darkColor = themeColor.dark;

export const BG_BASE = darkColor.background.canvas;
export const BG_SURFACE = darkColor.background.surface;
export const BG_SURFACE_2 = darkColor.background.surfaceRaised;
export const TEXT_PRIMARY = darkColor.text.primary;
export const TEXT_BODY = darkColor.text.body;
export const TEXT_SECONDARY = darkColor.text.secondary;
export const ACCENT = darkColor.action.primary;
export const ACCENT_PRESSED = darkColor.action.primaryPressed;
/** Primary reading CTA fill (Siguiente / Completar) — distinct from brand accent. */
export const CTA_FILL = darkColor.action.cta;
export const CTA_FILL_PRESSED = darkColor.action.ctaPressed;
/** Callout accents — dark defaults; use uiColorsFor(scheme) for theme-aware. */
export const SEM_CLAVE = darkColor.text.accent;
export const SEM_MATIZ = darkColor.text.warning;
export const SEM_EJEMPLO = darkColor.text.success;
export const SEM_ALERTA = darkColor.text.danger;
export const VIZ_GRID = darkColor.viz.grid;
export const VIZ_MUTED = darkColor.viz.muted;
export const VIZ_SERIES = [
  darkColor.viz.series0,
  darkColor.viz.series1,
  darkColor.viz.series2,
  darkColor.viz.series3,
] as const;

export const APP_DARK_BACKGROUND = BG_BASE;
export const APP_DARK_BACKGROUND_RGB = '24, 26, 31';

/** Theme-resolved aliases matching the legacy uiTokens names. Prefer `themeColor[scheme]`. */
export function uiColorsFor(scheme: ColorSchemeName) {
  const c = themeColor[scheme];
  return {
    BG_BASE: c.background.canvas,
    BG_SURFACE: c.background.surface,
    BG_SURFACE_2: c.background.surfaceRaised,
    TEXT_PRIMARY: c.text.primary,
    TEXT_BODY: c.text.body,
    TEXT_SECONDARY: c.text.secondary,
    ACCENT: c.action.primary,
    ACCENT_PRESSED: c.action.primaryPressed,
    CTA_FILL: c.action.cta,
    CTA_FILL_PRESSED: c.action.ctaPressed,
    SEM_CLAVE: c.text.accent,
    SEM_MATIZ: c.text.warning,
    SEM_EJEMPLO: c.text.success,
    SEM_ALERTA: c.text.danger,
    VIZ_GRID: c.viz.grid,
    VIZ_MUTED: c.viz.muted,
    VIZ_SERIES: [c.viz.series0, c.viz.series1, c.viz.series2, c.viz.series3] as const,
  } as const;
}

/** Editorial reading sheet — see `@shared/editorial/colors`. */
export {
  EDITORIAL_SHEET_BG,
  EDITORIAL_SHEET_BG_WARM,
  EDITORIAL_TEXT,
  EDITORIAL_TEXT_BODY,
  EDITORIAL_TEXT_MUTED,
  EDITORIAL_GRAPHIC_YELLOW,
  EDITORIAL_TEXT_OCHRE,
  EDITORIAL_ACCENT_YELLOW,
  EDITORIAL_ACCENT_LAVENDER,
  EDITORIAL_CALLOUT_DARK,
  EDITORIAL_CALLOUT_DARK_TEXT,
  EDITORIAL_PHRASE_BG,
  EDITORIAL_BORDER_SOFT,
  EDITORIAL_YELLOW_BORDER,
} from './editorial/colors';

export {
  EDITORIAL_GUTTER,
  EDITORIAL_GUTTER_NARROW,
  EDITORIAL_NARROW_BREAKPOINT,
  EDITORIAL_MAX_READ_WIDTH,
  EDITORIAL_SPACE,
  editorialGutter,
  editorialContentWidth,
} from './editorial/space';

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

const MOTION_CELEBRATION_MS = 450;

/**
 * Liquid Glass motion. `easing` is cubic-bezier(0.22, 1, 0.36, 1) —
 * pass to `Easing.bezier(...motion.easing)` (do not import RN Easing here).
 */
export const motion = {
  pressIn: primitive.duration.pressIn,
  pressOut: 170,
  small: primitive.duration.fast,
  standard: GLASS_TOUCH_GLOW_FADE_IN_MS_COMPOSER,
  progress: 380,
  expand: primitive.duration.quizSettle,
  celebration: MOTION_CELEBRATION_MS,
  easing: [0.22, 1, 0.36, 1] as const,
  spring: {
    damping: primitive.spring.soft.damping,
    stiffness: 260,
    mass: 0.9,
  },
  staggerStep: 35,
  staggerMaxElements: 7,
  staggerTotalCapMs: MOTION_CELEBRATION_MS,
} as const;

export const accentLine = '#A9ADFF';
export const barGradient = ['#7E82ED', '#9DA1FA'] as const;
export const onAccent = '#14152A';
export const success = '#8FA894';
export const warn = '#C4A46A';
export const hairline = darkColor.background.whiteFade10;
export const hairlineStrong = darkColor.background.whiteFade14;
export const specular = darkColor.background.whiteFade22;
export const glassFill = darkColor.background.whiteFade05;
export const glassFillPressed = darkColor.background.whiteFade09;
export const surfaceSolid = '#17181F';
export const textTertiarySafe = glass.blurWashLight;
export const nodeCapsuleFill = 'rgba(22,24,34,0.92)';
export const nodeSelectedBorder = 'rgba(169,173,255,0.45)';
export const connectorActive = 'rgba(139,143,245,0.42)';
export const statusOrbGlow = {
  shadowColor: darkColor.action.primary,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
} as const;
