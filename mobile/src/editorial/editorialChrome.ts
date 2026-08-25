import type { NativeScrollEvent } from 'react-native';

/**
 * Shared editorial chrome metrics for sticky headers + fixed bottom nav.
 * Bottom inset keeps readable text clear of the fixed nav / bottom mask.
 */
export const EDITORIAL_SCROLL_BOTTOM_MASK = 52;
export const EDITORIAL_SCROLL_BOTTOM_INSET = EDITORIAL_SCROLL_BOTTOM_MASK + 8;

/** Next-page unlock threshold near the bottom of a page ScrollView. */
export const EDITORIAL_SCROLL_END_THRESHOLD = 36;

export function isEditorialScrollNearEnd(
  event: NativeScrollEvent,
  threshold = EDITORIAL_SCROLL_END_THRESHOLD
): boolean {
  const { contentOffset, contentSize, layoutMeasurement } = event;
  if (contentSize.height <= layoutMeasurement.height + 1) return true;
  return contentOffset.y + layoutMeasurement.height >= contentSize.height - threshold;
}
