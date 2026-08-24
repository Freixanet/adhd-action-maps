import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  PRESS_HIT_SLOP,
  PRESS_RETENTION_OFFSET,
  usePressScale,
} from '../hooks/usePressScale';

type PressableScaleProps = {
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Primary pressables: feedback on press-in, commit on press-out. */
export default function PressableScale({
  onPress,
  children,
  disabled = false,
  accessibilityLabel,
  style,
  contentStyle,
}: PressableScaleProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={PRESS_HIT_SLOP}
      pressRetentionOffset={PRESS_RETENTION_OFFSET}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={style}
    >
      <Animated.View style={[contentStyle, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
