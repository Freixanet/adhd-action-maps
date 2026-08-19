import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
  style?: StyleProp<ViewStyle>;
};

/**
 * Composer chips: real iOS UIMenu via a native UIButton host.
 * Imperative performPrimaryAction on a temp button never presented; the user
 * tap must hit UIButton.menu directly.
 *
 * Children render behind a clear UIButton — use a Liquid Glass control as the
 * visual (e.g. FloatingGlassButton) so the FAB matches other home glass buttons.
 */
export default function ComposerMenuTrigger({
  title,
  actions,
  onPressAction,
  children,
  disabled = false,
  themeVariant = 'dark',
  accessibilityLabel,
  style,
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
      style={[styles.host, style]}
      accessibilityLabel={accessibilityLabel}
    >
      <View pointerEvents="none" collapsable={false} style={styles.visual}>
        {children}
      </View>
    </NucleoUIMenuAnchor>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'flex-start',
  },
  visual: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
