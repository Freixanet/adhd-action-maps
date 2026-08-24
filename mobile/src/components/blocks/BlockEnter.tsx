import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { space } from '@shared/design-tokens';
import { useGlassAccessibility } from '../../hooks/useGlassAccessibility';
import { useInViewportOnce } from '../../hooks/useInViewportOnce';
import { CONTENT_ENTER_TIMING } from '../../motion/contentEnter';

type BlockEnterProps = {
  children: React.ReactNode;
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
};

/** Fade + translateY(8→0) once in viewport; instant if reduce-motion. */
export default function BlockEnter({ children, delayMs = 0, style }: BlockEnterProps) {
  const { reduceMotion } = useGlassAccessibility();
  const { visible, onLayout } = useInViewportOnce();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(delayMs, withTiming(1, CONTENT_ENTER_TIMING));
  }, [delayMs, progress, reduceMotion, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * space.stack.sm }],
  }));

  return (
    <Animated.View onLayout={onLayout} style={[styles.host, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
  },
});
