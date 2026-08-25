import { useMemo } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@shared/design-tokens';

export const PRESS_HIT_SLOP = 12;
export const PRESS_RETENTION_OFFSET = 16;

const SCALE_DELTA = 1 - motion.press.scale;

/**
 * Press-in scale 0.975. No opacity fade.
 * Timing, not a spring: the finger is still down, so we ease to the pressed rest and back.
 */
export function usePressSpring(reduceMotion?: boolean) {
  const systemReduced = Boolean(useReducedMotion());
  const reduced = reduceMotion ?? systemReduced;
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * SCALE_DELTA }],
  }));

  const handlers = useMemo(
    () => ({
      onPressIn: () => {
        pressed.value = withTiming(1, { duration: reduced ? 0 : motion.press.in });
      },
      onPressOut: () => {
        pressed.value = withTiming(0, { duration: reduced ? 0 : motion.press.out });
      },
    }),
    [pressed, reduced],
  );

  return { pressed, style, handlers };
}
