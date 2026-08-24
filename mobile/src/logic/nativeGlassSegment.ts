import {
  getIntentSelectorImplementationMode,
  getIntentSelectorUnavailableReason,
  isNativeGlassSegmentAvailable,
  isNativeMultiSegmentAvailable,
} from '../../modules/nucleo-glass-segment/src';

/**
 * Product path on iOS 26+: native SwiftUI Liquid Glass track + selected lens.
 * The stock Picker implementation remains available in Swift as a rollback.
 */
export function shouldUseNativeGlassSegment(_reduceTransparency = false): boolean {
  return isNativeGlassSegmentAvailable();
}

export function shouldUseNativeMultiSegment(_reduceTransparency = false): boolean {
  return isNativeMultiSegmentAvailable();
}

export function resolveIntentSelectorImplementation(
  _reduceTransparency = false
): 'native_system_segmented' | 'fallback_solid' {
  const mode = getIntentSelectorImplementationMode();
  return mode === 'native_system_segmented' ? 'native_system_segmented' : 'fallback_solid';
}

export function resolveIntentSelectorFallbackReason(
  reduceTransparency = false
): string | null {
  if (resolveIntentSelectorImplementation(reduceTransparency) === 'native_system_segmented') {
    return null;
  }
  return getIntentSelectorUnavailableReason();
}
