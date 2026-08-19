import React from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { BorderBeam } from '../vendor/border-beam-native/src';

type Props = {
  children: ReactNode;
  /** When false, the official beam fades out / unmounts. */
  active: boolean;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Thin Nucleo wrapper around the official Jakub Antalik border-beam-native port.
 * Does not draw; all rendering comes from the vendored upstream `BorderBeam`.
 *
 * The loading screen uses the contained pulse. Unlike `pulse-outside`, it
 * remains visible at the physical screen edge instead of drawing off-screen.
 * Reduce Motion is handled inside the official pulse implementation.
 */
export default function NucleoLoadingBorderBeam({
  children,
  active,
  borderRadius = 24,
  style,
}: Props) {
  return (
    <BorderBeam
      size="pulse-inner"
      colorVariant="colorful"
      theme="dark"
      borderRadius={borderRadius}
      active={active}
      style={style}
    >
      {children}
    </BorderBeam>
  );
}
