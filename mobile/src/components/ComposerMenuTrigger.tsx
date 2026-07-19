import React, { useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  type View as RNView,
} from 'react-native';
import {
  MenuView,
  type MenuAction,
  type MenuComponentRef,
  type NativeActionEvent,
} from '@react-native-menu/menu';
import { useComposerKeyboard } from '../context/ComposerKeyboardContext';

type ComposerMenuTriggerProps = {
  title: string;
  actions: MenuAction[];
  onPressAction: (event: NativeActionEvent) => void;
  children: React.ReactNode;
  disabled?: boolean;
  themeVariant?: string;
  accessibilityLabel?: string;
};

/**
 * Native composer menu trigger. When the keyboard is open, intercepts the tap,
 * dismisses the keyboard, waits for the dock animation to finish, measures the
 * chip, then opens the menu at its settled position.
 */
export default function ComposerMenuTrigger({
  title,
  actions,
  onPressAction,
  children,
  disabled = false,
  themeVariant = 'dark',
  accessibilityLabel,
}: ComposerMenuTriggerProps) {
  const { keyboardVisible, waitForComposerDockSettle } = useComposerKeyboard();
  const menuRef = useRef<MenuComponentRef>(null);
  const anchorRef = useRef<RNView>(null);
  const openingRef = useRef(false);
  const [deferring, setDeferring] = useState(false);

  const openMenuAtAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((_x, _y, _width, _height) => {
      requestAnimationFrame(() => {
        menuRef.current?.show();
      });
    });
  }, []);

  const handleDeferredPress = useCallback(async () => {
    if (openingRef.current || disabled) return;
    openingRef.current = true;
    setDeferring(true);
    try {
      Keyboard.dismiss();
      await waitForComposerDockSettle();
      openMenuAtAnchor();
    } finally {
      setDeferring(false);
      openingRef.current = false;
    }
  }, [disabled, openMenuAtAnchor, waitForComposerDockSettle]);

  if (disabled) {
    return <>{children}</>;
  }

  const blockNativeTap = keyboardVisible || deferring;

  return (
    <View ref={anchorRef} collapsable={false} style={styles.anchor}>
      <MenuView
        ref={menuRef}
        title={title}
        actions={actions}
        onPressAction={onPressAction}
        shouldOpenOnLongPress={false}
        themeVariant={themeVariant}
      >
        {children}
      </MenuView>
      {blockNativeTap ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            void handleDeferredPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'relative',
  },
});
