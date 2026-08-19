import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import FloatingGlassButton from './FloatingGlassButton';
import { MenuTwoLines } from '../icons';
import { SIDEBAR_EDGE_INSET, SIDEBAR_HEADER_BUTTON_SIZE } from './sidebarLayout';
import { useTheme } from '../context/ThemeContext';
import { motion } from '@shared/design-tokens';

/** Hit area reserved for the floating sidebar button (not a header band). */
export const READING_PROGRESS_BAR_HEIGHT = 60;
export const READING_PROGRESS_LINE_HEIGHT = 3;

export function readingProgressBarTotalHeight(hideProgressLine?: boolean): number {
  return READING_PROGRESS_BAR_HEIGHT + (hideProgressLine ? 0 : READING_PROGRESS_LINE_HEIGHT);
}

/** Scroll content inset under the floating button (bar height + small gap). */
export function mapContentTopPadding(hideProgressLine?: boolean, extraGap = 24): number {
  return readingProgressBarTotalHeight(hideProgressLine) + extraGap;
}

function clampRatio(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

type ReadingProgressBarProps = {
  viewAll: boolean;
  stepProgress: number;
  onToggleSidebar: () => void;
  /** UI-thread scroll ratio for fluid view-all progress (0–1). */
  scrollProgressShared?: SharedValue<number>;
  /**
   * @deprecated Top chrome no longer collapses with a header.
   * Kept so call sites compile; ignored.
   */
  headerVisibleShared?: SharedValue<boolean>;
  /** Intro / completion — progress line omitted entirely. */
  hideProgressLine?: boolean;
  /**
   * @deprecated Top chrome always floats over the page.
   */
  overlayOnContent?: boolean;
  /** Physical safe-area offset when the parent itself ignores the top inset. */
  topInset?: number;
};

/**
 * Floating map chrome — not a header.
 * Sidebar button top-left; thin progress line at the top edge. Neither collapses.
 */
export default function ReadingProgressBar({
  viewAll,
  stepProgress,
  onToggleSidebar,
  scrollProgressShared,
  hideProgressLine,
  topInset = 0,
}: ReadingProgressBarProps) {
  const { colors, isDark } = useTheme();
  const navIconColor = colors.icon.muted;
  const stepProgressValue = useSharedValue(stepProgress / 100);

  useEffect(() => {
    if (viewAll) return;
    stepProgressValue.value = withTiming(stepProgress / 100, {
      duration: motion.loading.duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [stepProgress, stepProgressValue, viewAll]);

  const barStyle = useAnimatedStyle(() => {
    const ratio =
      viewAll && scrollProgressShared
        ? scrollProgressShared.value
        : stepProgressValue.value;
    return {
      width: '100%',
      transform: [{ scaleX: clampRatio(ratio) }],
      transformOrigin: 'left center',
    };
  });

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {!hideProgressLine ? (
        <View pointerEvents="none" style={styles.progressTrack}>
          <View
            style={[
              styles.progressTrackFill,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: colors.action.primary },
                barStyle,
              ]}
              accessibilityRole="progressbar"
            />
          </View>
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          styles.buttonSlot,
          {
            top: topInset,
            height: READING_PROGRESS_BAR_HEIGHT,
            paddingHorizontal: SIDEBAR_EDGE_INSET,
          },
        ]}
      >
        <FloatingGlassButton
          onPress={onToggleSidebar}
          accessibilityLabel="Abrir navegación"
          shape="circle"
          size={SIDEBAR_HEADER_BUTTON_SIZE}
        >
          <MenuTwoLines size={17} color={navIconColor} />
        </FloatingGlassButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: READING_PROGRESS_LINE_HEIGHT,
    zIndex: 49,
    overflow: 'hidden',
  },
  progressTrackFill: {
    flex: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  buttonSlot: {
    position: 'absolute',
    left: 0,
    zIndex: 50,
    justifyContent: 'center',
  },
});
