import React, { useCallback, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { BLUR_INTENSITY, COMPOSER_DARK_SURFACE, liquidGlassShellClasses } from '@shared/uiTokens';
import { useTheme } from '../context/ThemeContext';
import { useDeferredGlassMount } from '../hooks/useDeferredGlassMount';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useGlassTouchGlow, type GlassTouchGlowState } from '../hooks/useGlassTouchGlow';
import GlassPerimeterHighlight from './GlassPerimeterRing';
import GlassTouchGlow from './GlassTouchGlow';
import LiquidGlassSurface, { type LiquidGlassVariant } from './LiquidGlassSurface';

type GlassSurfaceProps = {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  overlayClassName?: string;
  variant?: 'default' | 'composer';
  solid?: boolean;
  contentClassName?: string;
  onShellLayout?: (event: LayoutChangeEvent) => void;
  /** Native iOS 26 Liquid Glass (floating UI only). */
  liquid?: boolean;
  borderRadius?: number;
  /** Perimeter highlight via SVG; `bottom` for sheet headers; `none` to opt out. */
  liquidBorder?: 'perimeter' | 'bottom' | 'none';
  /** Radial touch glow at press location (internal hook when true). */
  interactive?: boolean;
  /** External touch-glow state (e.g. when gestures own press handling). */
  touchGlow?: GlassTouchGlowState;
  /** Overrides default liquid-glass material tint. */
  tintColor?: string;
  /** Pull native glass slightly inward so its edge does not fight the outer ring. */
  glassInset?: number;
  /** Native liquid-glass material (`clear` is softer on small controls). */
  liquidMaterial?: 'regular' | 'clear';
  /** Bumps native glass remount when value changes (e.g. stream finished). */
  glassRefreshKey?: unknown;
};

function mapLiquidVariant(
  variant: 'default' | 'composer',
  liquidMaterial: 'regular' | 'clear'
): LiquidGlassVariant {
  if (liquidMaterial === 'clear') return 'clear';
  return variant === 'composer' ? 'composer' : 'regular';
}

function glassInsetStyle(inset: number): ViewStyle {
  return {
    position: 'absolute',
    top: inset,
    left: inset,
    right: inset,
    bottom: inset,
  };
}

export default function GlassSurface({
  children,
  className = '',
  style,
  intensity,
  overlayClassName,
  variant = 'default',
  solid = false,
  contentClassName = '',
  onShellLayout,
  liquid = false,
  borderRadius = 20,
  liquidBorder = 'perimeter',
  interactive = false,
  touchGlow: touchGlowProp,
  tintColor,
  glassInset = 0,
  liquidMaterial = 'regular',
  glassRefreshKey,
}: GlassSurfaceProps) {
  const { isDark } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const internalTouchGlow = useGlassTouchGlow(reduceMotion, isDark);
  const touchGlow = touchGlowProp ?? internalTouchGlow;
  const touchGlowActive = Boolean(interactive || touchGlowProp);
  const deferredGlass = useDeferredGlassMount(glassRefreshKey);
  const [shellSize, setShellSize] = useState({ width: 0, height: 0 });

  const handleShellLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setShellSize({ width, height });
      deferredGlass.onShellLayout(event);
      onShellLayout?.(event);
    },
    [deferredGlass, onShellLayout]
  );

  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (!interactive || touchGlowProp) return;
      const { locationX, locationY } = event.nativeEvent;
      touchGlow.onPressIn(locationX, locationY);
    },
    [interactive, touchGlow, touchGlowProp]
  );

  const handleTouchEnd = useCallback(() => {
    if (!interactive || touchGlowProp) return;
    touchGlow.onPressOut();
  }, [interactive, touchGlow, touchGlowProp]);

  if (liquid) {
    const resolvedTint =
      tintColor ??
      (variant === 'composer'
        ? isDark
          ? COMPOSER_DARK_SURFACE
          : 'rgba(255, 255, 255, 0.45)'
        : undefined);

    const innerRadius = Math.max(0, borderRadius - glassInset);
    const showPerimeterHighlight = liquidBorder === 'perimeter';
    const highlightWidth = shellSize.width;
    const highlightHeight = shellSize.height;

    return (
      <View
        className={liquidGlassShellClasses(className, liquidBorder)}
        style={[
          { borderRadius, overflow: 'hidden' },
          Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null,
          style,
        ]}
        collapsable={false}
        onLayout={handleShellLayout}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <LiquidGlassSurface
          style={glassInset > 0 ? glassInsetStyle(glassInset) : StyleSheet.absoluteFill}
          borderRadius={innerRadius}
          variant={mapLiquidVariant(variant, liquidMaterial)}
          tintColor={resolvedTint}
          glassEnabled={deferredGlass.glassActive}
          glassMountKey={deferredGlass.glassMountKey}
        >
          <View />
        </LiquidGlassSurface>
        {overlayClassName ? (
          <View
            pointerEvents="none"
            className={`absolute inset-0 ${overlayClassName}`}
            style={{ borderRadius, overflow: 'hidden' }}
          />
        ) : null}
        {touchGlowActive && highlightWidth > 0 && highlightHeight > 0 ? (
          <GlassTouchGlow
            width={highlightWidth}
            height={highlightHeight}
            borderRadius={borderRadius}
            isDark={isDark}
            glowOpacity={touchGlow.glowOpacity}
            touchPoint={touchGlow.touchPoint}
          />
        ) : null}
        {showPerimeterHighlight ? (
          <GlassPerimeterHighlight
            width={highlightWidth}
            height={highlightHeight}
            borderRadius={borderRadius}
            isDark={isDark}
            inset={glassInset ?? 0}
          />
        ) : null}
        <View className={`relative z-20 ${contentClassName}`.trim()}>{children}</View>
      </View>
    );
  }

  const resolvedIntensity =
    intensity ?? (variant === 'composer' ? (isDark ? 28 : 24) : BLUR_INTENSITY);
  const overlay =
    overlayClassName ??
    (variant === 'composer'
      ? isDark
        ? 'bg-[#3E4041]'
        : 'bg-base'
      : isDark
        ? 'bg-base'
        : 'bg-white/80');

  return (
    <View className={className} style={[{ borderRadius }, style]} onLayout={onShellLayout}>
      <View className="absolute inset-0 overflow-hidden" style={{ borderRadius }}>
        {!solid ? (
          <BlurView
            intensity={resolvedIntensity}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View className={`absolute inset-0 ${overlay}`} />
      </View>
      <View className={`relative z-10 ${contentClassName}`.trim()}>{children}</View>
    </View>
  );
}
