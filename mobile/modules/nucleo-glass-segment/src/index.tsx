import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';

export type NucleoGlassSegmentProps = {
  selectedIntent?: 'understand' | 'apply';
  selectedId?: string;
  optionIds?: string[];
  optionLabels?: string[];
  isEnabled?: boolean;
  themeVariant?: 'auto' | 'light' | 'dark';
  reduceMotion?: boolean;
  trackColor?: string;
  onIntentChange?: (event: {
    nativeEvent: { intent: string; implementation: string };
  }) => void;
  style?: StyleProp<ViewStyle>;
};

type NativeProps = NucleoGlassSegmentProps;
type NativeViewComponent = React.ComponentType<NativeProps>;

let NativeView: NativeViewComponent | null = null;
let nativeLoadAttempted = false;

function loadNativeView(): NativeViewComponent | null {
  if (nativeLoadAttempted) return NativeView;
  nativeLoadAttempted = true;
  if (Platform.OS !== 'ios') return null;
  try {
    NativeView = requireNativeViewManager<NativeProps>('NucleoGlassSegment');
  } catch {
    NativeView = null;
  }
  return NativeView;
}

type NucleoGlassSegmentModuleApi = {
  isAvailable: () => boolean;
  implementationMode?: () => string;
  supportsMultiSegment?: () => boolean;
};

let nativeModule: NucleoGlassSegmentModuleApi | null = null;

function loadNativeModule(): NucleoGlassSegmentModuleApi | null {
  if (Platform.OS !== 'ios') return null;
  try {
    nativeModule ??= requireNativeModule<NucleoGlassSegmentModuleApi>('NucleoGlassSegment');
    return nativeModule;
  } catch {
    return null;
  }
}

export function isNativeGlassSegmentAvailable(): boolean {
  if (!loadNativeView()) return false;
  try {
    return Boolean(loadNativeModule()?.isAvailable());
  } catch {
    return false;
  }
}

/** True only after a rebuild that includes the N-option glass track. */
export function isNativeMultiSegmentAvailable(): boolean {
  if (!isNativeGlassSegmentAvailable()) return false;
  try {
    return Boolean(loadNativeModule()?.supportsMultiSegment?.());
  } catch {
    return false;
  }
}

export function getIntentSelectorImplementationMode():
  | 'native_system_segmented'
  | 'fallback_solid' {
  if (!loadNativeView()) return 'fallback_solid';
  try {
    const mod = loadNativeModule();
    const mode = mod?.implementationMode?.();
    if (mode === 'native_system_segmented' && mod?.isAvailable()) {
      return 'native_system_segmented';
    }
  } catch {
    /* absent */
  }
  return 'fallback_solid';
}

export function getIntentSelectorUnavailableReason(): string {
  if (Platform.OS !== 'ios') return 'not_ios';
  loadNativeView();
  const mod = loadNativeModule();
  if (!NativeView || !mod) return 'rebuild_dev_client';
  try {
    if (!mod.isAvailable()) return 'os_below_26';
  } catch {
    return 'rebuild_dev_client';
  }
  return 'unavailable';
}

export function NucleoGlassSegment(props: NucleoGlassSegmentProps) {
  const View = loadNativeView();
  if (!View) return null;
  return <View {...props} />;
}
