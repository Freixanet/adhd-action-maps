import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { useTheme, useThemeColors } from '../context/ThemeContext';
import { useDeferredGlassMount } from '../hooks/useDeferredGlassMount';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { COMPOSER_NATIVE_CORNERS } from '../logic/nativeGlassComposer';
import { BLUR_INTENSITY, COMPOSER_DARK_SURFACE } from '@shared/uiTokens';
import { glass } from '@shared/design-tokens';

export type LiquidGlassVariant = 'regular' | 'clear' | 'composer';

export type GlassEffectStyleName = 'clear' | 'regular' | 'none';

export type LiquidGlassSurfaceProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius: number;
  tintColor?: string;
  variant: LiquidGlassVariant;
  /** Native UIGlassEffect interactive mode (expo `isInteractive`). No visual style change. */
  interactive?: boolean;
  /** Controlled by GlassSurface — when false, native glass is not mounted yet. */
  glassEnabled?: boolean;
  /** Remount key for native GlassView (paired with glassEnabled from parent). */
  glassMountKey?: number;
  /** When used standalone, bumps remount after shell layout settles. */
  layoutRefreshKey?: unknown;
  /**
   * Renders children inside the native effect view rather than over a sibling,
   * so UIKit's interactive glass receives the touches. Forgoes deferred mount.
   */
  hostsContent?: boolean;
};

export { canUseNativeLiquidGlass } from '../logic/glassAvailability';

function opaqueFallbackColors(
  isDark: boolean,
  colors: ReturnType<typeof useThemeColors>,
  variant: LiquidGlassVariant,
  tintColor?: string
): { backgroundColor: string; borderColor: string } {
  if (tintColor) {
    return {
      backgroundColor: tintColor,
      borderColor: isDark ? colors.background.whiteFade10 : colors.border.subtle,
    };
  }
  if (variant === 'composer') {
    return {
      backgroundColor: isDark ? COMPOSER_DARK_SURFACE : (glass.opaqueFallbackLight as string),
      borderColor: isDark ? colors.background.whiteFade08 : colors.border.default,
    };
  }
  if (variant === 'clear') {
    return {
      backgroundColor: isDark
        ? colors.background.glassClearDark
        : (glass.clearWashLight as string),
      borderColor: isDark ? colors.background.whiteFade10 : colors.border.subtle,
    };
  }
  return {
    backgroundColor: isDark
      ? colors.background.glassRegularDark
      : (glass.regularWashLight as string),
    borderColor: isDark ? colors.background.whiteFade10 : colors.border.subtle,
  };
}

/** Moderate wash over BlurView when Liquid Glass is unavailable (not reduce-transparency). */
function blurWashColor(
  isDark: boolean,
  colors: ReturnType<typeof useThemeColors>,
  variant: LiquidGlassVariant,
  tintColor?: string
): string {
  if (tintColor) return tintColor;
  if (isDark) {
    if (variant === 'composer') return COMPOSER_DARK_SURFACE;
    if (variant === 'clear') return colors.background.glassClearDark;
    return colors.background.glassRegularDark;
  }
  return glass.blurWashLight as string;
}

/** Stable native glass style — composer always stays `regular` (no idle/focus material swap). */
export function resolveGlassEffectStyle(variant: LiquidGlassVariant): GlassEffectStyleName {
  if (variant === 'clear') return 'clear';
  return 'regular';
}

export default function LiquidGlassSurface({
  children,
  style,
  borderRadius,
  tintColor,
  variant,
  interactive = false,
  glassEnabled,
  glassMountKey,
  layoutRefreshKey,
  hostsContent = false,
}: LiquidGlassSurfaceProps) {
  const { isDark } = useTheme();
  const colors = useThemeColors();
  const { reduceMotion, reduceTransparency, nativeGlass } = useGlassAccessibility();
  const isControlled = glassEnabled !== undefined;
  const internalGlass = useDeferredGlassMount(isControlled ? undefined : layoutRefreshKey);

  // With native corners the glass view shapes its own edge, so clipping the
  // shell would cut the lensing UIKit draws on the curve.
  const nativeCorners = variant === 'composer' && COMPOSER_NATIVE_CORNERS;

  const shellStyle: ViewStyle = {
    borderRadius,
    overflow: nativeCorners ? 'visible' : 'hidden',
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : null),
  };

  const opaque = opaqueFallbackColors(isDark, colors, variant, tintColor);
  const active = isControlled ? glassEnabled : internalGlass.glassActive;
  const mountKey = isControlled ? (glassMountKey ?? 0) : internalGlass.glassMountKey;
  const blurIntensity = variant === 'composer' ? (isDark ? 28 : 24) : BLUR_INTENSITY;

  if (nativeGlass && hostsContent) {
    return (
      <GlassView
        style={[shellStyle, style]}
        glassEffectStyle={resolveGlassEffectStyle(variant)}
        isInteractive={interactive && !reduceMotion}
        tintColor={tintColor}
        colorScheme={isDark ? 'dark' : 'light'}
      >
        {children}
      </GlassView>
    );
  }

  if (nativeGlass) {
    return (
      <View
        pointerEvents="none"
        style={[shellStyle, style]}
        collapsable={false}
        onLayout={isControlled ? undefined : internalGlass.onShellLayout}
      >
        {active ? (
          <GlassView
            key={mountKey}
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, nativeCorners ? { borderRadius } : null]}
            glassEffectStyle={resolveGlassEffectStyle(variant)}
            isInteractive={interactive && !reduceMotion}
            tintColor={tintColor}
            colorScheme={isDark ? 'dark' : 'light'}
          />
        ) : (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: opaque.backgroundColor },
              nativeCorners ? { borderRadius } : null,
            ]}
          />
        )}
        <View pointerEvents="none" style={styles.content}>
          {children}
        </View>
      </View>
    );
  }

  // Accessibility: Reduce Transparency → solid surface (white in light).
  if (reduceTransparency) {
    return (
      <View
        style={[
          shellStyle,
          {
            backgroundColor: opaque.backgroundColor,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: opaque.borderColor,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // No Liquid Glass API: BlurView + moderate wash (not the opaque white used above).
  const wash = blurWashColor(isDark, colors, variant, tintColor);
  return (
    <View style={[shellStyle, { overflow: 'hidden' }, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    position: 'relative',
  },
});
