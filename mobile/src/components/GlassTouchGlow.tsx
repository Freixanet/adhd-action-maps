import React, { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import {
  GLASS_TOUCH_GLOW_CENTER_OPACITY_DARK,
  GLASS_TOUCH_GLOW_CENTER_OPACITY_LIGHT,
  GLASS_TOUCH_GLOW_RADIAL_STOP_RATIOS,
  GLASS_TOUCH_GLOW_RADIUS_SCALE,
} from '@shared/uiTokens';

type GlassTouchGlowProps = {
  width: number;
  height: number;
  borderRadius: number;
  isDark: boolean;
  glowOpacity: SharedValue<number>;
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  /** Overrides token center opacity (composer peak). */
  centerOpacity?: number;
  /** Wider radial spread (composer). */
  radiusScale?: number;
  /** Keeps radial fill off the perimeter stroke (composer). */
  edgeInset?: number;
};

/**
 * Soft press glow. A static radial circle is translated to the touch point.
 * Animating RadialGradient cx/cy via react-native-svg intermittently fills the
 * whole rect with hard corners — do not go back to that path.
 */
export default function GlassTouchGlow({
  width,
  height,
  borderRadius,
  isDark,
  glowOpacity,
  touchX,
  touchY,
  centerOpacity: centerOpacityProp,
  radiusScale = GLASS_TOUCH_GLOW_RADIUS_SCALE,
  edgeInset = 0,
}: GlassTouchGlowProps) {
  const reactId = useId();
  const gradientId = useMemo(() => {
    const suffix = reactId.replace(/[^a-zA-Z0-9_-]/g, '');
    return `glass-touch-glow-${suffix}`;
  }, [reactId]);

  const centerOpacity =
    centerOpacityProp ??
    (isDark ? GLASS_TOUCH_GLOW_CENTER_OPACITY_DARK : GLASS_TOUCH_GLOW_CENTER_OPACITY_LIGHT);

  const radialStops = useMemo(
    () =>
      GLASS_TOUCH_GLOW_RADIAL_STOP_RATIOS.map((stop) => ({
        offset: `${Math.round(stop.offset * 100)}%`,
        stopOpacity: centerOpacity * stop.ratio,
      })),
    [centerOpacity]
  );

  const inset = Math.max(0, edgeInset);
  const innerWidth = Math.max(0, width - inset * 2);
  const innerHeight = Math.max(0, height - inset * 2);
  const innerRadius = Math.max(0, borderRadius - inset);
  const radius = Math.max(1, Math.min(innerWidth, innerHeight) * radiusScale);
  const diameter = radius * 2;

  const blobStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [
      { translateX: touchX.value - inset - radius },
      { translateY: touchY.value - inset - radius },
    ],
  }));

  if (width <= 0 || height <= 0 || innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.shell,
        {
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          borderRadius: innerRadius,
          overflow: 'hidden',
        },
      ]}
    >
      <Animated.View style={[{ width: diameter, height: diameter }, blobStyle]}>
        <Svg width={diameter} height={diameter} pointerEvents="none">
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
              {radialStops.map((stop) => (
                <Stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor="#FFFFFF"
                  stopOpacity={stop.stopOpacity}
                />
              ))}
            </RadialGradient>
          </Defs>
          <Circle cx={radius} cy={radius} r={radius} fill={`url(#${gradientId})`} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    zIndex: 9,
  },
});
