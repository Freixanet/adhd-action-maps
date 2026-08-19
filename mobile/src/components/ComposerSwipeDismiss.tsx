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
 * Downward pan closes the expanded composer. The dock stays glued to the
 * keyboard — we dismiss immediately so both ride the keyboard close, instead
 * of translating the pill under the keys.
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
        .activeOffsetY(16)
        .failOffsetY(-20)
        .failOffsetX([-28, 28])
        .cancelsTouchesInView(true)
        .onStart(() => {
          'worklet';
          // Close the keyboard as soon as the swipe reads as downward, so the
          // dock rides keyboard height instead of sliding under the keys.
          runOnJS(onDismiss)();
        })
        .onEnd((event) => {
          'worklet';
          if (shouldDismissComposerSwipe(event.translationY, event.velocityY)) {
            runOnJS(onDismiss)();
          }
        }),
    [enabled, onDismiss]
  );

  const gesture = useMemo(
    () => (enabled ? Gesture.Simultaneous(pan, Gesture.Native()) : pan),
    [enabled, pan]
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
