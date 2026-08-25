import { usePressSpring } from './usePressSpring';

export { PRESS_HIT_SLOP, PRESS_RETENTION_OFFSET } from './usePressSpring';

export function usePressScale() {
  const { style, handlers } = usePressSpring();
  return {
    animatedStyle: style,
    onPressIn: handlers.onPressIn,
    onPressOut: handlers.onPressOut,
  };
}
