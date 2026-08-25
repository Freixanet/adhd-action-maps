import React, { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { control, primitive } from '@shared/design-tokens';
import { useThemeColors } from '../context/ThemeContext';

/** Same paint path as GlassTouchGlow: a circle, not a % rect. */
const BLOOM_SIZE = control.lumenBanner * 2;
const BLOOM_RADIUS = BLOOM_SIZE / 2;

/**
 * Lavender bloom to the right of the home greeting. Static.
 */
export default function HomeAmbientWash() {
  const colors = useThemeColors();
  const reactId = useId();
  const gradientId = useMemo(() => {
    const suffix = reactId.replace(/[^a-zA-Z0-9_-]/g, '');
    return `home-ambient-${suffix}`;
  }, [reactId]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.anchor}
    >
      <Svg width={BLOOM_SIZE} height={BLOOM_SIZE} pointerEvents="none">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop
              offset="0%"
              stopColor={colors.orb.core}
              stopOpacity={primitive.opacity.subtle}
            />
            <Stop offset="55%" stopColor={colors.orb.core} stopOpacity={primitive.opacity.faint} />
            <Stop offset="100%" stopColor={colors.orb.core} stopOpacity={primitive.opacity.invisible} />
          </RadialGradient>
        </Defs>
        <Circle cx={BLOOM_RADIUS} cy={BLOOM_RADIUS} r={BLOOM_RADIUS} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: -BLOOM_SIZE * 0.35,
    right: -BLOOM_SIZE * 0.28,
    width: BLOOM_SIZE,
    height: BLOOM_SIZE,
    zIndex: 0,
  },
});
