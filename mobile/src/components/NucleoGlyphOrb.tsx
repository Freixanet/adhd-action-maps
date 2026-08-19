import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '../context/ThemeContext';
import { motion } from '@shared/design-tokens';

type NucleoGlyphOrbProps = {
  size?: number;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading brand mark: thin ring + off-center nucleus disc (SPEC §3.4).
 * Used in generation UI; the Three.js / atom orb stays on the Preview orb page.
 */
export default function NucleoGlyphOrb({
  size = 72,
  reduceMotion = false,
  style,
}: NucleoGlyphOrbProps) {
  const colors = useThemeColors();
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 1;
      return;
    }
    breathe.value = withRepeat(
      withTiming(1.045, { duration: motion.orbGlyph.duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [breathe, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  const stroke = colors.icon.primary;
  const fill = colors.action.primary;
  const glowSize = Math.round(size * 1.35);

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: colors.background.accentFade16,
          },
        ]}
      />
      <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
        <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
          <Circle cx="12" cy="12" r="8.5" stroke={stroke} strokeWidth="1.35" opacity={0.92} />
          <Circle cx="14.5" cy="10.5" r="2.35" fill={fill} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
  },
});
