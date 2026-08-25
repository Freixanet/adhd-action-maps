import { requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

export type NucleoUIMenuAction = {
  id: string;
  title: string;
  state?: 'on' | 'off' | 'mixed';
  /** SF Symbol name rendered leading the row. */
  image?: string;
};

type NucleoUIMenuAnchorProps = {
  title?: string;
  themeVariant?: 'dark' | 'light' | string;
  actions: NucleoUIMenuAction[];
  /** Long-press UIButton.menu (icons). Default tap. */
  openOnLongPress?: boolean;
  /** iMessage-style lift preview + haptic via UIContextMenuInteraction. */
  liftPreview?: boolean;
  previewCornerRadius?: number;
  previewTailRadius?: number;
  sourceText?: string;
  sourceColor?: string;
  sourceFontSize?: number;
  sourceLineHeight?: number;
  sourceFontFamily?: string;
  onSelect?: (event: { nativeEvent: { id: string } }) => void;
  onPresent?: (event: {
    nativeEvent: { delayed: boolean; keyboardHeight: number; title: string };
  }) => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

const NativeView = requireNativeViewManager<NucleoUIMenuAnchorProps>('NucleoUIMenu');

/** Native UIButton.menu host — tap opens a real iOS UIMenu. */
export function NucleoUIMenuAnchor(props: NucleoUIMenuAnchorProps) {
  return <NativeView {...props} />;
}
