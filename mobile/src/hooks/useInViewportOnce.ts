import { useCallback, useRef, useState } from 'react';
import { type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';

type UseInViewportOnceOptions = {
  /** Fraction of height that must be visible (0–1). Default 0.25. */
  threshold?: number;
  /** Optional external window height; otherwise uses onLayout of the host. */
  viewportHeight?: number;
};

/**
 * Lightweight one-shot visibility: flips `visible` the first time the view
 * intersects the viewport enough. Pair with onLayout + parent scroll if needed;
 * also works via measureInWindow on layout for step pages already on screen.
 */
export function useInViewportOnce(options?: UseInViewportOnceOptions) {
  const threshold = options?.threshold ?? 0.25;
  const [visible, setVisible] = useState(false);
  const hostHeight = useRef(0);
  const fired = useRef(false);

  const markVisible = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    setVisible(true);
  }, []);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      hostHeight.current = event.nativeEvent.layout.height;
      // Step pages mount already in view — treat first layout as enter.
      // Parent scroll lists can still call onScrollProgress.
      if (!fired.current) {
        markVisible();
      }
    },
    [markVisible]
  );

  /** Optional: call from a ScrollView onScroll if you need real intersection. */
  const onScrollProgress = useCallback(
    (
      event: NativeSyntheticEvent<NativeScrollEvent>,
      layoutY: number
    ) => {
      if (fired.current) return;
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      const viewTop = layoutY - contentOffset.y;
      const viewBottom = viewTop + hostHeight.current;
      const visiblePx =
        Math.min(viewBottom, layoutMeasurement.height) - Math.max(viewTop, 0);
      const ratio = hostHeight.current > 0 ? visiblePx / hostHeight.current : 0;
      if (ratio >= threshold) markVisible();
    },
    [markVisible, threshold]
  );

  return { visible, onLayout, onScrollProgress, markVisible };
}
