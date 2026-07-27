import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';

/** UIKit glass configurations: `glass()`, `prominentGlass()`, `clearGlass()`, `prominentClearGlass()`. */
export type NucleoGlassVariant = 'glass' | 'prominentGlass' | 'clearGlass' | 'prominentClearGlass';

export type NucleoGlassButtonProps = {
  onPress?: () => void;
  variant?: NucleoGlassVariant;
  /** `fixed` honours `cornerRadius`; `capsule` ignores it. */
  cornerStyle?: 'capsule' | 'fixed' | 'dynamic';
  cornerRadius?: number;
  tintColor?: string;
  /** SF Symbol drawn by UIKit. Omit it and render React children instead. */
  systemImage?: string;
  symbolPointSize?: number;
  isEnabled?: boolean;
  accessibilityLabelText?: string;
  style?: StyleProp<ViewStyle>;
};

type NativeGlassButtonProps = Omit<NucleoGlassButtonProps, 'onPress'> & {
  /** Native event name avoids the topPress direct/bubbling clash in React Native. */
  onGlassPress?: () => void;
};

const NativeView = requireNativeViewManager<NativeGlassButtonProps>('NucleoGlassButton');

type NucleoGlassButtonModule = { isAvailable: () => boolean };

let nativeModule: NucleoGlassButtonModule | null = null;

/** True when UIKit exposes the glass button configurations (iOS 26+). */
export function isNativeGlassButtonAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    nativeModule ??= requireNativeModule<NucleoGlassButtonModule>('NucleoGlassButton');
    return nativeModule.isAvailable();
  } catch {
    return false;
  }
}

/** Native UIButton with a Liquid Glass configuration. */
export function NucleoGlassButton({ onPress, ...rest }: NucleoGlassButtonProps) {
  return <NativeView {...rest} onGlassPress={onPress} />;
}
