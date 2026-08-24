import { useCallback } from 'react';
import {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@shared/design-tokens';

export const PRESS_HIT_SLOP = 12;
export const PRESS_RETENTION_OFFSET = 16;

/** animate-expo UI ease-out. Reanimated CSS transitions reject cubic-bezier() strings. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const PRESS_TIMING = {
  duration: motion.press.duration,
  easing: EASE_OUT,
  reduceMotion: ReduceMotion.System,
} as const;

/**
 * Near-imperceptible press: scale 0.97 in 120ms on the UI runtime.
 */
export function usePressScale() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    if (reduced) return;
    scale.value = withTiming(motion.press.scale, PRESS_TIMING);
  }, [reduced, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withTiming(1, PRESS_TIMING);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, onPressIn, onPressOut };
}
