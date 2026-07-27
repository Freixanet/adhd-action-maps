import React from 'react';
import { TextInput } from 'react-native';
import { GlassContainer } from 'expo-glass-effect';
import LiquidGlassMotionShell from './LiquidGlassMotionShell';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import {
  COMPOSER_GLASS_CONTAINER,
  COMPOSER_GLASS_MERGE_SPACING,
} from '../logic/nativeGlassComposer';

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
  const { nativeGlass } = useGlassAccessibility();

  const shell = (
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

  // The container has to sit above both the bar's glass and the send button's,
  // which is what lets UIKit merge the two shapes.
  if (nativeGlass && COMPOSER_GLASS_CONTAINER) {
    return <GlassContainer spacing={COMPOSER_GLASS_MERGE_SPACING}>{shell}</GlassContainer>;
  }

  return shell;
}
