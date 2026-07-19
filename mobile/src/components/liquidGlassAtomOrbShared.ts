import { ViewStyle } from 'react-native';

export type LiquidGlassVariant = 'purple' | 'blue' | 'mono';
export type LiquidGlassIntensity = 'subtle' | 'balanced' | 'strong';

export type LiquidGlassAtomMode = 'flat' | 'ribbons' | 'none';

export type LiquidGlassAtomOrbProps = {
  size?: number;
  variant?: LiquidGlassVariant;
  intensity?: LiquidGlassIntensity;
  showAtom?: boolean;
  /** flat = Skia ellipses; ribbons = 3D SVG-geometry ribbons inside the same canvas */
  atomMode?: LiquidGlassAtomMode;
  /** back = glow+body, front = gloss+rim on top of atom, full = single canvas */
  glassPhase?: 'back' | 'front' | 'full';
  style?: ViewStyle;
};

export type LiquidGlassPalette = {
  glowA: string;
  glowB: string;
  glassEdge: string;
  glassLight: string;
  glassMid: string;
  glassDeep: string;
  glassDark: string;
  orbitBack: string;
  orbitFront: string;
  orbitGlow: string;
  nucleusHot: string;
  nucleusLight: string;
  nucleusMid: string;
  nucleusDeep: string;
  nucleusDark: string;
  shadow: string;
  whiteSoft: string;
  whiteHard: string;
};

export type IntensityConfig = {
  glowOpacity: number;
  glassOpacity: number;
  rimOpacity: number;
  atomOpacity: number;
  causticOpacity: number;
  highlightOpacity: number;
};

const PURPLE_PALETTE: LiquidGlassPalette = {
  glowA: 'rgba(139, 92, 246, 0.34)',
  glowB: 'rgba(49, 46, 129, 0.10)',
  glassEdge: 'rgba(255, 255, 255, 0.58)',
  glassLight: 'rgba(221, 214, 254, 0.36)',
  glassMid: 'rgba(139, 92, 246, 0.20)',
  glassDeep: 'rgba(49, 46, 129, 0.28)',
  glassDark: 'rgba(5, 8, 22, 0.34)',
  orbitBack: 'rgba(221, 214, 254, 0.22)',
  orbitFront: 'rgba(255, 255, 255, 0.72)',
  orbitGlow: 'rgba(139, 92, 246, 0.32)',
  nucleusHot: '#FFFFFF',
  nucleusLight: '#DDD6FE',
  nucleusMid: '#8B5CF6',
  nucleusDeep: '#312E81',
  nucleusDark: '#050816',
  shadow: 'rgba(0, 0, 0, 0.34)',
  whiteSoft: 'rgba(255, 255, 255, 0.48)',
  whiteHard: 'rgba(255, 255, 255, 0.86)',
};

const BLUE_PALETTE: LiquidGlassPalette = {
  glowA: 'rgba(56, 189, 248, 0.32)',
  glowB: 'rgba(30, 58, 138, 0.10)',
  glassEdge: 'rgba(255, 255, 255, 0.56)',
  glassLight: 'rgba(186, 230, 253, 0.34)',
  glassMid: 'rgba(56, 189, 248, 0.20)',
  glassDeep: 'rgba(30, 58, 138, 0.28)',
  glassDark: 'rgba(2, 6, 23, 0.34)',
  orbitBack: 'rgba(186, 230, 253, 0.22)',
  orbitFront: 'rgba(255, 255, 255, 0.70)',
  orbitGlow: 'rgba(56, 189, 248, 0.30)',
  nucleusHot: '#FFFFFF',
  nucleusLight: '#BAE6FD',
  nucleusMid: '#38BDF8',
  nucleusDeep: '#1E3A8A',
  nucleusDark: '#020617',
  shadow: 'rgba(0, 0, 0, 0.34)',
  whiteSoft: 'rgba(255, 255, 255, 0.48)',
  whiteHard: 'rgba(255, 255, 255, 0.86)',
};

const MONO_PALETTE: LiquidGlassPalette = {
  glowA: 'rgba(156, 163, 175, 0.26)',
  glowB: 'rgba(55, 65, 81, 0.10)',
  glassEdge: 'rgba(255, 255, 255, 0.52)',
  glassLight: 'rgba(229, 231, 235, 0.30)',
  glassMid: 'rgba(156, 163, 175, 0.18)',
  glassDeep: 'rgba(55, 65, 81, 0.26)',
  glassDark: 'rgba(3, 7, 18, 0.34)',
  orbitBack: 'rgba(229, 231, 235, 0.20)',
  orbitFront: 'rgba(255, 255, 255, 0.66)',
  orbitGlow: 'rgba(156, 163, 175, 0.26)',
  nucleusHot: '#FFFFFF',
  nucleusLight: '#E5E7EB',
  nucleusMid: '#9CA3AF',
  nucleusDeep: '#374151',
  nucleusDark: '#030712',
  shadow: 'rgba(0, 0, 0, 0.34)',
  whiteSoft: 'rgba(255, 255, 255, 0.44)',
  whiteHard: 'rgba(255, 255, 255, 0.82)',
};

export function getPalette(variant: LiquidGlassVariant): LiquidGlassPalette {
  if (variant === 'blue') return BLUE_PALETTE;
  if (variant === 'mono') return MONO_PALETTE;
  return PURPLE_PALETTE;
}

export function getIntensity(intensity: LiquidGlassIntensity): IntensityConfig {
  if (intensity === 'subtle') {
    return {
      glowOpacity: 0.58,
      glassOpacity: 0.78,
      rimOpacity: 0.52,
      atomOpacity: 0.68,
      causticOpacity: 0.26,
      highlightOpacity: 0.58,
    };
  }
  if (intensity === 'strong') {
    return {
      glowOpacity: 0.86,
      glassOpacity: 0.94,
      rimOpacity: 0.78,
      atomOpacity: 0.86,
      causticOpacity: 0.42,
      highlightOpacity: 0.8,
    };
  }
  return {
    glowOpacity: 0.72,
    glassOpacity: 0.86,
    rimOpacity: 0.68,
    atomOpacity: 0.78,
    causticOpacity: 0.34,
    highlightOpacity: 0.7,
  };
}

export function resolveIntensity(
  intensity: LiquidGlassIntensity,
  glow?: boolean
): LiquidGlassIntensity {
  if (glow === false) return 'subtle';
  return intensity;
}
