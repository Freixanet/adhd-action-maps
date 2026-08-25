import { useMemo } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion as vizMotion } from '@shared/uiTokens';
import { useGlassAccessibility } from './useGlassAccessibility';

const PRESS_SCALE = 0.025;

/**
 * Primary press: 0.975 scale in 90ms, spring release. No opacity fade.
 */
export function useCalmPress() {
  const { reduceMotion } = useGlassAccessibility();
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * PRESS_SCALE }],
  }));

  const handlers = useMemo(
    () => ({
      onPressIn: () => {
        if (reduceMotion) {
          pressed.value = 1;
          return;
        }
        pressed.value = withTiming(1, { duration: vizMotion.pressIn });
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
