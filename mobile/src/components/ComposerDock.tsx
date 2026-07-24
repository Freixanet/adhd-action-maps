import React from 'react';
import Animated, {
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedStyle,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const COMPOSER_DOCK_GAP = 12;

type ComposerDockProps = {
  children: React.ReactNode;
  gap?: number;
  onHeightChange?: (height: number) => void;
};

function keyboardLiftPx(
  keyboardHeight: number,
  keyboardState: KeyboardState,
  insetBottom: number,
  gap: number
) {
  'worklet';
  const closedBottom = Math.max(insetBottom, gap);
  const keyboardOpen =
    keyboardState === KeyboardState.OPEN || keyboardState === KeyboardState.OPENING;
  const kb = keyboardOpen ? keyboardHeight : 0;
  return Math.max(kb + gap, closedBottom);
}

/** Matches ComposerDock lift so scroll content moves up with the keyboard. */
export function useComposerKeyboardLift(gap = COMPOSER_DOCK_GAP): AnimatedStyle<ViewStyle> {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const insetBottom = insets.bottom;

  return useAnimatedStyle(() => {
    const closedBottom = Math.max(insetBottom, gap);
    const bottom = keyboardLiftPx(
      keyboard.height.value,
      keyboard.state.value,
      insetBottom,
      gap
    );
    return { marginBottom: bottom - closedBottom };
  }, [insetBottom, gap]);
}

export default function ComposerDock({
  children,
  gap = COMPOSER_DOCK_GAP,
  onHeightChange,
}: ComposerDockProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const insetBottom = insets.bottom;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      bottom: keyboardLiftPx(
        keyboard.height.value,
        keyboard.state.value,
        insetBottom,
        gap
      ),
    };
  }, [insetBottom, gap]);

  return (
    <Animated.View
      // Position via StyleSheet — Uniwind className on Reanimated views is unreliable
      // for absolute docking (composer was rendering at the top of the screen).
      style={[styles.dock, animatedStyle]}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    overflow: 'visible',
    zIndex: 40,
    elevation: 40,
  },
});
