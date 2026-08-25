import { useMemo } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@shared/design-tokens';
import { motion as vizMotion } from '@shared/uiTokens';
import { useGlassAccessibility } from './useGlassAccessibility';

export const PRESS_HIT_SLOP = 12;
export const PRESS_RETENTION_OFFSET = 16;

const SCALE_DELTA = 1 - motion.press.scale;

/**
 * Unified calm press: 0.975 scale in 90ms, spring release, no opacity fade.
 * `reduceMotion` is kept on the signature for callers and ignored —
 * physics always follow `useGlassAccessibility`.
 */
export function usePressSpring(_reduceMotion?: boolean) {
  const { reduceMotion } = useGlassAccessibility();
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * SCALE_DELTA }],
  }));

  const handlers = useMemo(
    () => ({
      onPressIn: () => {
        if (reduceMotion) {
          pressed.value = 1;
          return;
        }
        pressed.value = withTiming(1, { duration: motion.press.in });
      },
      onPressOut: () => {
        if (reduceMotion) {
          pressed.value = 0;
          return;
        }
        pressed.value = withSpring(0, {
          damping: vizMotion.spring.damping,
          stiffness: vizMotion.spring.stiffness,
          mass: vizMotion.spring.mass,
        });
      },
    }),
    [pressed, reduceMotion],
  );

  return { pressed, style, handlers };
}
