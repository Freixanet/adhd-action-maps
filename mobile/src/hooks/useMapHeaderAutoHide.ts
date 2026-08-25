import { useCallback, useEffect, useRef } from 'react';
import { InteractionManager, type LayoutChangeEvent } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {
  mapContentTopPadding,
  READING_PROGRESS_BAR_HEIGHT,
  READING_PROGRESS_LINE_HEIGHT,
} from '../components/ReadingProgressBar';
import { debugTransitionLog } from '../logic/debugTransitionLog';

const TOP_VISIBLE_THRESHOLD = 8;
const HIDE_AFTER_SCROLL_Y = 24;
const DIRECTION_DELTA = 10;
/** Ignore upward header reveal near the bottom (iOS rubber-band bounce). */
const BOTTOM_EDGE_THRESHOLD = 24;

type UseMapHeaderAutoHideOptions = {
  hideProgressLine: boolean;
  /** Map identity — clears anchor measurement when this changes. */
  mapKey: string;
  /** Step / view mode — scrolls to top and shows header when this changes. */
  resetKey: string;
  scrollProgress?: SharedValue<number>;
  onScrollReport?: (scrollY: number, contentHeight: number) => void;
};

export function useMapHeaderAutoHide({
  hideProgressLine,
  mapKey,
  resetKey,
  scrollProgress,
  onScrollReport,
}: UseMapHeaderAutoHideOptions) {
  const scrollRef = useRef<Animated.ScrollView>(null);
  const lastMapKeyRef = useRef(mapKey);
  const headerVisible = useSharedValue(true);
  const lastScrollY = useSharedValue(0);
  const directionAnchorY = useSharedValue(0);
  const isGoingDown = useSharedValue(false);
  const mapMetaAnchorHeight = useSharedValue(0);
  const lastLoggedHeaderVisible = useSharedValue(true);
  const compensatingFooterReveal = useSharedValue(false);

  const logScrollHeader = (scrollY: number, visible: boolean, threshold: number) => {
    debugTransitionLog('H4', 'useMapHeaderAutoHide:scroll', 'scroll header state', {
      scrollY,
      headerVisible: visible,
      threshold,
      hideProgressLine,
    });
  };

  useAnimatedReaction(
    () => headerVisible.value,
    (visible, prev) => {
      if (prev === null || visible === prev) return;
      if (visible === lastLoggedHeaderVisible.value) return;
      lastLoggedHeaderVisible.value = visible;
      runOnJS(logScrollHeader)(lastScrollY.value, visible, mapMetaAnchorHeight.value);
    },
    [headerVisible, lastLoggedHeaderVisible, lastScrollY, mapMetaAnchorHeight]
  );

  useEffect(() => {
    if (lastMapKeyRef.current !== mapKey) {
      lastMapKeyRef.current = mapKey;
      mapMetaAnchorHeight.value = 0;
    }
    headerVisible.value = true;
    lastScrollY.value = 0;
    directionAnchorY.value = 0;
    isGoingDown.value = false;
    const task = InteractionManager.runAfterInteractions(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return () => task.cancel();
  }, [mapKey, resetKey, headerVisible, lastScrollY, directionAnchorY, isGoingDown, mapMetaAnchorHeight]);

  const handleMapMetaAnchorLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      if (height <= 0) return;
      mapMetaAnchorHeight.value = height;
    },
    [mapMetaAnchorHeight]
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      const maxScroll = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);

      if (compensatingFooterReveal.value) {
        directionAnchorY.value = currentY;
        isGoingDown.value = false;
        lastScrollY.value = currentY;
        if (scrollProgress) {
          scrollProgress.value = maxScroll <= 0 ? 1 : Math.min(1, Math.max(0, currentY / maxScroll));
        }
        if (onScrollReport) {
          runOnJS(onScrollReport)(currentY, event.contentSize.height);
        }
        return;
      }
      // Without the map-meta anchor (Idea central has no title block), fall back to a
      // short scroll so the header gets out of the way early instead of at 120px.
      const threshold = mapMetaAnchorHeight.value > 0
        ? mapMetaAnchorHeight.value + 8
        : HIDE_AFTER_SCROLL_Y;
      const inBottomBounce =
        maxScroll > 0 && currentY >= maxScroll - BOTTOM_EDGE_THRESHOLD;

      if (currentY <= TOP_VISIBLE_THRESHOLD) {
        headerVisible.value = true;
        directionAnchorY.value = currentY;
        lastScrollY.value = currentY;
        return;
      }

      if (inBottomBounce) {
        // Rubber-band at the end of the page mimics upward scroll — keep header hidden.
        directionAnchorY.value = currentY;
        isGoingDown.value = false;
        lastScrollY.value = currentY;
        if (scrollProgress) {
          scrollProgress.value = 1;
        }
        if (onScrollReport) {
          runOnJS(onScrollReport)(currentY, event.contentSize.height);
        }
        return;
      }

      const isScrollingDown = currentY > lastScrollY.value;
      const isScrollingUp = currentY < lastScrollY.value;

      if (isScrollingDown && !isGoingDown.value) {
        isGoingDown.value = true;
        directionAnchorY.value = lastScrollY.value;
      } else if (isScrollingUp && isGoingDown.value) {
        isGoingDown.value = false;
        directionAnchorY.value = lastScrollY.value;
      }

      const accumulatedDistance = currentY - directionAnchorY.value;

      if (currentY < threshold) {
        headerVisible.value = true;
      } else if (currentY >= threshold && accumulatedDistance > DIRECTION_DELTA) {
        headerVisible.value = false;
      } else if (accumulatedDistance < -DIRECTION_DELTA) {
        headerVisible.value = true;
      }

      lastScrollY.value = currentY;

      if (scrollProgress) {
        scrollProgress.value =
          maxScroll <= 0 ? 1 : Math.min(1, Math.max(0, currentY / maxScroll));
      }

      if (onScrollReport) {
        runOnJS(onScrollReport)(currentY, event.contentSize.height);
      }
    },
  });

  const preserveBottomAfterFooterReveal = useCallback(
    (footerHeight: number) => {
      if (footerHeight <= 0) return;
      compensatingFooterReveal.value = true;
      const targetY = Math.max(0, lastScrollY.value + footerHeight);
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
      headerVisible.value = true;
      setTimeout(() => {
        compensatingFooterReveal.value = false;
      }, 180);
    },
    [compensatingFooterReveal, headerVisible, lastScrollY]
  );

  return {
    scrollRef,
    headerVisible,
    handleMapMetaAnchorLayout,
    scrollHandler,
    preserveBottomAfterFooterReveal,
  };
}
