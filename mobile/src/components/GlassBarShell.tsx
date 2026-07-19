import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';

/** Shared corner radius for footer CTAs and map header bar buttons (e.g. Empezar a leer, Vista completa). */
export const GLASS_BAR_BUTTON_RADIUS = RADII.sm;

type GlassBarShellProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tintColor?: string;
  overlayClassName?: string;
  contentClassName?: string;
};

export default function GlassBarShell({
  children,
  style,
  tintColor,
  overlayClassName,
  contentClassName = 'items-center justify-center',
}: GlassBarShellProps) {
  return (
    <GlassSurface
      liquid
      liquidBorder="none"
      borderRadius={GLASS_BAR_BUTTON_RADIUS}
      style={[styles.shell, { borderRadius: GLASS_BAR_BUTTON_RADIUS }, style]}
      tintColor={tintColor}
      overlayClassName={overlayClassName}
      contentClassName={contentClassName}
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
  },
});
