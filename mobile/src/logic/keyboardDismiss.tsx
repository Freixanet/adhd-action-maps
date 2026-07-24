import React from 'react';
import {
  Keyboard,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  markComposerNativeMenuEnded,
  restoreComposerInputFocus,
  shouldSuppressKeyboardDismissForComposerMenu,
} from './composerNativeMenuSession';

export function useDismissKeyboardOnScroll() {
  return () => {
    if (shouldSuppressKeyboardDismissForComposerMenu()) return;
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
        // Outside tap while a composer UIMenu is up should close only the menu.
        if (shouldSuppressKeyboardDismissForComposerMenu()) {
          markComposerNativeMenuEnded();
          restoreComposerInputFocus();
        } else {
          Keyboard.dismiss();
        }
        onPress?.(event);
      }}
      {...props}
    >
      {children}
    </Pressable>
  );
}
