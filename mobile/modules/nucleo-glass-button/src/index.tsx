import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';

/** Product variants map to SwiftUI `.glass` / `.glassProminent`. */
export type NucleoGlassVariant =
  | 'glass'
  | 'regular'
  | 'prominentGlass'
  | 'prominent'
  | 'glassProminent';

export type NucleoGlassButtonProps = {
  onPress?: () => void;
  variant?: NucleoGlassVariant;
  title?: string;
  /** SF Symbol drawn by SwiftUI. Omit and render React children above instead. */
  systemImage?: string;
  symbolPointSize?: number;
  isEnabled?: boolean;
  isLoading?: boolean;
  accessibilityLabelText?: string;
  /** Retained for call-site compatibility; system glass owns corners. */
  cornerStyle?: 'capsule' | 'fixed' | 'dynamic';
  cornerRadius?: number;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
};

type NativeGlassButtonProps = Omit<NucleoGlassButtonProps, 'onPress'> & {
  onGlassPress?: () => void;
};

type NativeViewComponent = React.ComponentType<NativeGlassButtonProps>;

let NativeView: NativeViewComponent | null = null;
let nativeLoadAttempted = false;

function loadNativeView(): NativeViewComponent | null {
  if (nativeLoadAttempted) return NativeView;
  nativeLoadAttempted = true;
  if (Platform.OS !== 'ios') return null;
  try {
    NativeView = requireNativeViewManager<NativeGlassButtonProps>('NucleoGlassButton');
  } catch {
    NativeView = null;
  }
  return NativeView;
}

type NucleoGlassButtonModuleApi = {
  isAvailable: () => boolean;
  implementationMode?: () => string;
};

let nativeModule: NucleoGlassButtonModuleApi | null = null;

function loadNativeModule(): NucleoGlassButtonModuleApi | null {
  if (Platform.OS !== 'ios') return null;
  try {
    nativeModule ??= requireNativeModule<NucleoGlassButtonModuleApi>('NucleoGlassButton');
    return nativeModule;
  } catch {
    return null;
  }
}

/** True when SwiftUI glass Button styles are in the binary (iOS 26+). */
export function isNativeGlassButtonAvailable(): boolean {
  if (!loadNativeView()) return false;
  try {
    return Boolean(loadNativeModule()?.isAvailable());
  } catch {
    return false;
  }
}

export function getGlassButtonImplementationMode():
  | 'native_system_glass'
  | 'fallback_solid' {
  if (!loadNativeView()) return 'fallback_solid';
  try {
    const mod = loadNativeModule();
    const mode = mod?.implementationMode?.();
    if (mode === 'native_system_glass' && mod?.isAvailable()) {
      return 'native_system_glass';
    }
  } catch {
    /* absent */
  }
  return 'fallback_solid';
}

/** Native SwiftUI glass Button. Returns null if unavailable. */
export function NucleoGlassButton({ onPress, ...rest }: NucleoGlassButtonProps) {
  const View = loadNativeView();
  if (!View) return null;
  return <View {...rest} onGlassPress={onPress} />;
}
