import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  NucleoGlassButton,
  isNativeGlassButtonAvailable,
  type NucleoGlassVariant,
} from '../../modules/nucleo-glass-button/src';
import { CTA_FILL, RADII } from '@shared/uiTokens';
import { useTheme } from '../context/ThemeContext';
import { color } from '@shared/design-tokens';

type NativeGlassButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  /**
   * Custom chrome (avatar, stop glyph). Prefer `title` / `systemImage` so
   * UIKit draws the label inside the glass button.
   */
  children?: React.ReactNode;
  /** `glass` (default) or `prominentGlass` — one prominent CTA per screen. */
  variant?: NucleoGlassVariant;
  cornerRadius?: number;
  /** Ignored on the native path (standard glass has no tint). */
  tintColor?: string;
  title?: string;
  systemImage?: string;
  symbolPointSize?: number;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * iOS 26+: standard `UIButton.Configuration.glass()` / `.prominentGlass()`.
 * Else: solid `fallback_solid` — never text-only.
 */
export default function NativeGlassButton({
  onPress,
  accessibilityLabel,
  children,
  variant = 'glass',
  cornerRadius,
  tintColor,
  title,
  systemImage,
  symbolPointSize,
  disabled = false,
  loading = false,
  style,
}: NativeGlassButtonProps) {
  const { isDark } = useTheme();
  const useNative = isNativeGlassButtonAvailable();
  const isCapsule = cornerRadius === undefined;
  const radius = isCapsule ? RADII.pill : cornerRadius;
  const isProminent =
    variant === 'prominentGlass' ||
    variant === 'prominent' ||
    variant === 'glassProminent';
  const nativeOwnsLabel = Boolean(title || systemImage);
  const fallbackBg = isProminent
    ? tintColor || CTA_FILL
    : isDark
      ? color.background.whiteFade12
      : color.background.whiteFade72;
  const fallbackBorder = isProminent
    ? 'transparent'
    : isDark
      ? color.background.whiteFade14
      : color.background.blackFade08;

  if (useNative) {
    return (
      <View
        style={[styles.wrapper, style, styles.allowMorph]}
        testID="native-glass-button-shell"
        accessibilityState={{ disabled }}
      >
        <NucleoGlassButton
          onPress={onPress}
          variant={variant}
          title={title}
          systemImage={systemImage}
          symbolPointSize={symbolPointSize}
          cornerStyle={isCapsule ? 'capsule' : 'fixed'}
          cornerRadius={cornerRadius}
          isEnabled={!disabled}
          isLoading={loading}
          accessibilityLabelText={accessibilityLabel}
          style={StyleSheet.absoluteFill}
        />
        {!nativeOwnsLabel && children ? (
          <View pointerEvents="none" style={styles.content}>
            {children}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID="native-glass-button-shell"
      style={[styles.wrapper, disabled ? styles.disabled : null, style, styles.allowMorph]}
    >
      <View
        pointerEvents="none"
        testID="native-glass-button-fallback-surface"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: fallbackBg,
            borderRadius: radius,
            borderWidth: isProminent ? 0 : StyleSheet.hairlineWidth,
            borderColor: fallbackBorder,
          },
        ]}
      />
      <View pointerEvents="none" style={styles.content}>
        {children ?? null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Callers MUST set width and height (e.g. 38 send circle, 44 sidebar).
  // Do not use this inside document/canvas flow — Yoga measures an unsized
  // wrapper as 0 and the native UIButton paints over neighbouring copy.
  wrapper: {
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  allowMorph: {
    overflow: 'visible',
  },
  content: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
});
