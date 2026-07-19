import React from 'react';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, type AnimatedStyle } from 'react-native-reanimated';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const COMPOSER_DOCK_GAP = 12;

type ComposerDockProps = {
  children: React.ReactNode;
  gap?: number;
  onHeightChange?: (height: number) => void;
};

/** Matches ComposerDock lift so scroll content moves up with the keyboard. */
export function useComposerKeyboardLift(gap = COMPOSER_DOCK_GAP): AnimatedStyle<ViewStyle> {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const insetBottom = insets.bottom;

  return useAnimatedStyle(() => {
    const closedBottom = Math.max(insetBottom, gap);
    const openBottom = Math.max(keyboard.height.value + gap, closedBottom);
    return { marginBottom: openBottom - closedBottom };
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
    const closedBottom = Math.max(insetBottom, gap);
    const bottom = Math.max(keyboard.height.value + gap, closedBottom);
    return { bottom };
  }, [insetBottom, gap]);

  return (
    <Animated.View
      className="absolute left-0 right-0 px-4"
      style={[animatedStyle, styles.dock]}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    overflow: 'visible',
  },
});
