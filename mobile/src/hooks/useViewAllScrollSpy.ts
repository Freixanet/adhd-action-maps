import { useCallback, useRef } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type UseViewAllScrollSpyOptions = {
  enabled: boolean;
  totalSteps: number;
  onStepChange: (step: number) => void;
};

const BOTTOM_SNAP_THRESHOLD = 32;

export function useViewAllScrollSpy({ enabled, totalSteps, onStepChange }: UseViewAllScrollSpyOptions) {
  const sectionOffsetsRef = useRef<Map<number, number>>(new Map());
  const viewportHeightRef = useRef(0);
  const scrollYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const lastStepRef = useRef<number | null>(null);

  const applyStep = useCallback(
    (step: number) => {
      if (lastStepRef.current === step) return;
      lastStepRef.current = step;
      onStepChange(step);
    },
    [onStepChange]
  );

  const resolveStepFromScroll = useCallback((scrollY: number, contentHeight: number) => {
    const viewport = viewportHeightRef.current;
    if (viewport <= 0) return 0;

    const entries = Array.from(sectionOffsetsRef.current.entries()).sort((a, b) => a[1] - b[1]);
    if (entries.length === 0) return 0;

    const lastReadingStep = Math.max(0, totalSteps);
    const maxScroll = Math.max(0, contentHeight - viewport);

    // Extra content after the last step (e.g. completion) adds scroll room so the anchor can reach it.
    if (contentHeight > 0 && (maxScroll <= 1 || scrollY >= maxScroll - BOTTOM_SNAP_THRESHOLD)) {
      return lastReadingStep;
    }

    const anchor = scrollY + viewport * 0.2;
    let step = 0;

    for (const [stepNum, y] of entries) {
      if (y <= anchor + 8) step = stepNum;
    }

    return step;
  }, [totalSteps]);

  const syncActiveStep = useCallback(() => {
    if (!enabled) return;
    applyStep(resolveStepFromScroll(scrollYRef.current, contentHeightRef.current));
  }, [applyStep, enabled, resolveStepFromScroll]);

  const registerSectionLayout = useCallback(
    (step: number, event: LayoutChangeEvent) => {
      sectionOffsetsRef.current.set(step, event.nativeEvent.layout.y);
      requestAnimationFrame(syncActiveStep);
    },
    [syncActiveStep]
  );

  const handleScrollViewLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeightRef.current = event.nativeEvent.layout.height;
      requestAnimationFrame(syncActiveStep);
    },
    [syncActiveStep]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!enabled) return;

      const { contentOffset, contentSize } = event.nativeEvent;
      scrollYRef.current = contentOffset.y;
      contentHeightRef.current = contentSize.height;
      applyStep(resolveStepFromScroll(contentOffset.y, contentSize.height));
    },
    [applyStep, enabled, resolveStepFromScroll]
  );

  const resetSpy = useCallback(() => {
    sectionOffsetsRef.current.clear();
    scrollYRef.current = 0;
    contentHeightRef.current = 0;
    lastStepRef.current = null;
  }, []);

  return {
    registerSectionLayout,
    handleScrollViewLayout,
    handleScroll,
    resetSpy,
  };
}
