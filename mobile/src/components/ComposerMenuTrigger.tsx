import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { MenuAction, NativeActionEvent } from '@react-native-menu/menu';
import { NucleoUIMenuAnchor } from '../../modules/nucleo-ui-menu/src';
import {
  markComposerNativeMenuEnded,
  markComposerNativeMenuPresented,
} from '../logic/composerNativeMenuSession';

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
 * Composer chips: real iOS UIMenu via a native UIButton host.
 * Imperative performPrimaryAction on a temp button never presented; the user
 * tap must hit UIButton.menu directly.
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
  if (disabled || Platform.OS !== 'ios') {
    return <>{children}</>;
  }

  const menuActions = actions
    .filter((action): action is MenuAction & { id: string } => Boolean(action.id))
    .map((action) => ({
      id: action.id,
      title: action.title,
      state: action.state,
      image: action.image,
    }));

  return (
    <NucleoUIMenuAnchor
      title={title}
      themeVariant={themeVariant}
      actions={menuActions}
      onPresent={() => {
        markComposerNativeMenuPresented();
      }}
      onDismiss={() => {
        markComposerNativeMenuEnded();
      }}
      onSelect={(event) => {
        const id = event?.nativeEvent?.id;
        markComposerNativeMenuEnded();
        if (!id) return;
        onPressAction({ nativeEvent: { event: id } } as NativeActionEvent);
      }}
      style={styles.host}
    >
      <View pointerEvents="none" collapsable={false}>
        {children}
      </View>
    </NucleoUIMenuAnchor>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'flex-start',
  },
});
