import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  NucleoGlassButton,
  type NucleoGlassVariant,
} from '../../modules/nucleo-glass-button/src';

type NativeGlassButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  /** Label and/or icon. Rendered above the button, transparent to touches. */
  children: React.ReactNode;
  variant?: NucleoGlassVariant;
  /** Capsule when omitted; pass a radius for card-shaped buttons. */
  cornerRadius?: number;
  tintColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Any app button on UIKit's Liquid Glass: the native `UIButton` owns material,
 * highlight and press morph. React content sits on top with `pointerEvents`
 * disabled so the button keeps the whole hit area.
 */
export default function NativeGlassButton({
  onPress,
  accessibilityLabel,
  children,
  variant = 'glass',
  cornerRadius,
  tintColor,
  disabled = false,
  style,
}: NativeGlassButtonProps) {
  return (
    <View style={[styles.wrapper, disabled ? styles.disabled : null, style]}>
      <NucleoGlassButton
        onPress={onPress}
        variant={variant}
        cornerStyle={cornerRadius === undefined ? 'capsule' : 'fixed'}
        cornerRadius={cornerRadius}
        tintColor={tintColor}
        isEnabled={!disabled}
        accessibilityLabelText={accessibilityLabel}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Default `alignItems: stretch` lets the content match the button width. */
  wrapper: {
    justifyContent: 'center',
  },
  /** In normal flow, so the wrapper still sizes to the label. */
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
});
