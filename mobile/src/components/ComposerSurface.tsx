import React from 'react';
import { TextInput } from 'react-native';
import LiquidGlassMotionShell from './LiquidGlassMotionShell';

type ComposerSurfaceProps = {
  children: React.ReactNode;
  /** Sustained focus — native interactive glass + focused idle scale (1.006). */
  focused?: boolean;
  /** Optional TextInput ref — tapping the shell chrome focuses the field. */
  inputRef?: React.RefObject<TextInput | null>;
};

export default function ComposerSurface({
  children,
  focused = false,
  inputRef,
}: ComposerSurfaceProps) {
  return (
    <LiquidGlassMotionShell
      borderRadius={26}
      variant="composer"
      focused={focused}
      inputRef={inputRef}
      className="rounded-cta"
    >
      {children}
    </LiquidGlassMotionShell>
  );
}
