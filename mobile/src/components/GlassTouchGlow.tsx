import React, { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  GLASS_TOUCH_GLOW_CENTER_OPACITY_DARK,
  GLASS_TOUCH_GLOW_CENTER_OPACITY_LIGHT,
  GLASS_TOUCH_GLOW_RADIAL_STOP_RATIOS,
  GLASS_TOUCH_GLOW_RADIUS_SCALE,
} from '@shared/uiTokens';
import type { GlassTouchPoint } from '../hooks/useGlassTouchGlow';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type GlassTouchGlowProps = {
  width: number;
  height: number;
  borderRadius: number;
  isDark: boolean;
  glowOpacity: SharedValue<number>;
  touchPoint: GlassTouchPoint;
  /** Overrides token center opacity (composer peak). */
  centerOpacity?: number;
  /** Wider radial spread (composer). */
  radiusScale?: number;
  /** Keeps radial fill off the perimeter stroke (composer). */
  edgeInset?: number;
};

export default function GlassTouchGlow({
  width,
  height,
  borderRadius,
  isDark,
  glowOpacity,
  touchPoint,
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
        offset: stop.offset,
        stopOpacity: centerOpacity * stop.ratio,
      })),
    [centerOpacity]
  );

  const animatedRectProps = useAnimatedProps(() => ({
    opacity: glowOpacity.value,
  }));

  if (width <= 0 || height <= 0) return null;

  const inset = Math.max(0, edgeInset);
  const innerWidth = Math.max(0, width - inset * 2);
  const innerHeight = Math.max(0, height - inset * 2);
  const innerRadius = Math.max(0, borderRadius - inset);
  const cx = touchPoint.x - inset;
  const cy = touchPoint.y - inset;
  const radius = Math.max(1, Math.min(innerWidth, innerHeight) * radiusScale);

  if (innerWidth <= 0 || innerHeight <= 0) return null;

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
      <Svg width={innerWidth} height={innerHeight} pointerEvents="none">
        <Defs>
          <RadialGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            cx={cx}
            cy={cy}
            rx={radius}
            ry={radius}
          >
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
        <AnimatedRect
          animatedProps={animatedRectProps}
          width={innerWidth}
          height={innerHeight}
          fill={`url(#${gradientId})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    zIndex: 9,
  },
});
