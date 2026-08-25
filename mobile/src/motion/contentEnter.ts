import { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';
import { motion, space } from '@shared/design-tokens';

/** Matches `motion.enter` easing — fade + translateY 8px / 200ms. */
export const CONTENT_ENTER_EASE = Easing.bezier(0, 0, 0.2, 1);

export const CONTENT_ENTER_TIMING = {
  duration: motion.enter.duration,
  easing: CONTENT_ENTER_EASE,
} as const;

export function contentEnterStagger(index: number): number {
  return index * motion.stagger.duration;
}

/** Mount entering: fade + 8px drop. Same grammar as `BlockEnter`. */
export function contentEntering(delayMs = 0) {
  return new Keyframe({
    0: {
      opacity: 0,
      transform: [{ translateY: space.stack.sm }],
    },
    100: {
      opacity: 1,
      transform: [{ translateY: 0 }],
      easing: CONTENT_ENTER_EASE,
    },
  })
    .duration(motion.enter.duration)
    .delay(delayMs)
    .reduceMotion(ReduceMotion.System);
}
