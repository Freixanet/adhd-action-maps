import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { GlassContainer } from 'expo-glass-effect';
import LiquidGlassMotionShell from './LiquidGlassMotionShell';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import {
  COMPOSER_GLASS_CONTAINER,
  COMPOSER_GLASS_MERGE_SPACING,
} from '../logic/nativeGlassComposer';
import { radius } from '@shared/design-tokens';

type ComposerSurfaceProps = {
  children: React.ReactNode;
  /** Sustained focus — native interactive glass. */
  focused?: boolean;
  /** Optional TextInput ref — tapping the field still focuses it. */
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
      borderRadius={radius.composer}
      variant="composer"
      focused={focused}
      inputRef={inputRef}
      className="rounded-cta"
    >
      <View pointerEvents="box-none" style={styles.hit}>
        {children}
      </View>
    </LiquidGlassMotionShell>
  );

  // Merge the bar with the send control so UIKit morphs one glass shape.
  if (nativeGlass && COMPOSER_GLASS_CONTAINER) {
    return <GlassContainer spacing={COMPOSER_GLASS_MERGE_SPACING}>{shell}</GlassContainer>;
  }

  return shell;
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: 'stretch',
  },
});
