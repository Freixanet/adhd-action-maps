import React from 'react';
import {
  Keyboard,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export function useDismissKeyboardOnScroll() {
  return () => {
    Keyboard.dismiss();
  };
}

type KeyboardDismissBackdropProps = PressableProps & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function KeyboardDismissBackdrop({
  onPress,
  children,
  ...props
}: KeyboardDismissBackdropProps) {
  return (
    <Pressable
      accessible={false}
      onPress={(event) => {
        Keyboard.dismiss();
        onPress?.(event);
      }}
      {...props}
    >
      {children}
    </Pressable>
  );
}
