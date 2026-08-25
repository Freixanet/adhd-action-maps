import React from 'react';
import {
  Pressable,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import {
  PRESS_HIT_SLOP,
  PRESS_RETENTION_OFFSET,
  usePressSpring,
} from '../hooks/usePressSpring';

type PressableScaleProps = {
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  hitSlop?: number | Insets;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Primary pressables: feedback on press-in, commit on press-out.
 * `reduceMotion` is accepted for API compatibility; press physics use
 * `useGlassAccessibility` inside `usePressSpring`.
 */
export default function PressableScale({
  onPress,
  children,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
  hitSlop = PRESS_HIT_SLOP,
  reduceMotion: _reduceMotion,
  style,
  contentStyle,
}: PressableScaleProps) {
  const { style: pressStyle, handlers } = usePressSpring();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlers.onPressIn}
      onPressOut={handlers.onPressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      pressRetentionOffset={PRESS_RETENTION_OFFSET}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? { disabled }}
      style={style}
    >
      <Animated.View style={[contentStyle, pressStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
