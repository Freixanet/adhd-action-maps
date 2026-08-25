import React, { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, type AnimatedStyle } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';
import { shouldDismissComposerSwipe } from '../logic/composerSwipeDismiss';

type ComposerSwipeDismissProps = {
  enabled: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | AnimatedStyle<ViewStyle>;
};

/**
 * Downward pan on the composer chrome closes it. Do not steal vertical
 * drags from the TextInput (cursor / selection) — that dropped the dock
 * under a still-visible keyboard.
 */
export default function ComposerSwipeDismiss({
  enabled,
  onDismiss,
  children,
  style,
}: ComposerSwipeDismissProps) {
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetY(28)
        .failOffsetY(-24)
        .failOffsetX([-36, 36])
        .cancelsTouchesInView(false)
        .onEnd((event) => {
          'worklet';
          if (shouldDismissComposerSwipe(event.translationY, event.velocityY)) {
            runOnJS(onDismiss)();
          }
        }),
    [enabled, onDismiss]
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
