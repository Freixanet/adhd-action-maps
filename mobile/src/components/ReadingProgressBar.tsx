import React, { useCallback, useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Layers, List } from 'lucide-react-native';
import FloatingGlassButton from './FloatingGlassButton';
import MenuTwoLines from './MenuTwoLines';
import { SIDEBAR_HEADER_BUTTON_SIZE } from './sidebarLayout';
import { useTheme } from '../context/ThemeContext';
import { debugTransitionLog } from '../logic/debugTransitionLog';

/** Fallback for nav row height before onLayout (py-2.5 + 36px button). */
export const READING_PROGRESS_BAR_HEIGHT = 60;
export const READING_PROGRESS_LINE_HEIGHT = 8;

export function readingProgressBarTotalHeight(hideProgressLine?: boolean): number {
  return READING_PROGRESS_BAR_HEIGHT + (hideProgressLine ? 0 : READING_PROGRESS_LINE_HEIGHT);
}

/** Scroll content inset below the absolute reading header (bar height + small gap). */
export function mapContentTopPadding(hideProgressLine?: boolean, extraGap = 24): number {
  return readingProgressBarTotalHeight(hideProgressLine) + extraGap;
}

function clampRatio(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

type ReadingProgressBarProps = {
  viewAll: boolean;
  isComplete: boolean;
  stepProgress: number;
  progressLabel: string;
  onToggleSidebar: () => void;
  onToggleViewMode?: () => void;
  /** UI-thread scroll ratio for fluid view-all progress (0–1). */
  scrollProgressShared?: SharedValue<number>;
  headerVisibleShared?: SharedValue<boolean>;
  /** Intro step-by-step only — progress line omitted entirely. */
  hideProgressLine?: boolean;
  /** "~N min restantes" beside the step label; omitted on last step / when unknown. */
  remainingLabel?: string;
};

export default function ReadingProgressBar({
  viewAll,
  isComplete,
  stepProgress,
  progressLabel,
  onToggleSidebar,
  onToggleViewMode,
  scrollProgressShared,
  headerVisibleShared,
  hideProgressLine,
  remainingLabel,
}: ReadingProgressBarProps) {
  const { isDark } = useTheme();
  const navIconColor = isDark ? '#d4d4d4' : '#525252';
  const stepProgressValue = useSharedValue(stepProgress / 100);

  const navH = READING_PROGRESS_BAR_HEIGHT;
  const lineH = READING_PROGRESS_LINE_HEIGHT;
  const shellHeight = hideProgressLine ? navH : navH + lineH;
  const clipHeight = shellHeight;

  const logHeaderLayout = useCallback(
    (headerVisible: boolean) => {
      debugTransitionLog(
        'H1',
        'ReadingProgressBar:headerVisible',
        'header visibility changed',
        {
          headerVisible,
          viewAll,
          hideProgressLine,
          shellHeight,
          clipHeight,
          navH,
          lineH,
          innerTranslateHidden: -navH,
          predictedEmptyShellPx: 0,
        },
        'post-fix'
      );
    },
    [clipHeight, hideProgressLine, lineH, navH, shellHeight, viewAll]
  );

  useEffect(() => {
    debugTransitionLog(
      'H3',
      'ReadingProgressBar:mount',
      'reading header props',
      {
        viewAll,
        hideProgressLine,
        shellHeight,
        clipHeight,
        navH,
        lineH,
        contentPaddingTop: mapContentTopPadding(hideProgressLine),
      },
      'post-fix'
    );
  }, [clipHeight, hideProgressLine, lineH, navH, shellHeight, viewAll]);

  useAnimatedReaction(
    () => (headerVisibleShared ? headerVisibleShared.value : true),
    (visible, prev) => {
      if (prev === null || visible === prev) return;
      runOnJS(logHeaderLayout)(visible);
    },
    [headerVisibleShared, logHeaderLayout]
  );

  useEffect(() => {
    if (viewAll) return;
    stepProgressValue.value = withTiming(stepProgress / 100, {
      duration: 500,
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

  /** Slides nav+progress stack up inside the clip window (no empty shell band). */
  const innerStackStyle = useAnimatedStyle(() => {
    if (!headerVisibleShared) {
      return { transform: [{ translateY: 0 }] };
    }

    const hiddenOffset = hideProgressLine ? -shellHeight : -navH;
    return {
      transform: [
        {
          translateY: withTiming(headerVisibleShared.value ? 0 : hiddenOffset, {
            duration: 250,
          }),
        },
      ],
    };
  });

  const navAnimatedStyle = useAnimatedStyle(() => {
    if (!headerVisibleShared) {
      return { opacity: 1 };
    }
    return {
      opacity: withTiming(headerVisibleShared.value ? 1 : 0, { duration: 200 }),
    };
  });

  const navAnimatedProps = useAnimatedProps(() => {
    if (!headerVisibleShared) {
      return { pointerEvents: 'auto' as const };
    }
    return {
      pointerEvents: headerVisibleShared.value ? ('auto' as const) : ('none' as const),
    };
  });

  const viewModeIconColor = viewAll ? (isDark ? '#a5b4fc' : '#8B8FF5') : isDark ? '#a3a3a3' : '#737373';
  const viewModeLabelClass = viewAll
    ? 'text-accent'
    : 'text-body';

  return (
    <Animated.View
      style={{ height: clipHeight, overflow: 'hidden' }}
      className="absolute left-0 right-0 top-0 z-50"
      onLayout={(event) => {
        const { height, y } = event.nativeEvent.layout;
        debugTransitionLog(
          'H2',
          'ReadingProgressBar:shellLayout',
          'shell onLayout',
          {
            measuredHeight: height,
            measuredY: y,
            clipHeight,
            viewAll,
            hideProgressLine,
            contentPaddingTop: mapContentTopPadding(hideProgressLine),
            gapBelowShellPx: mapContentTopPadding(hideProgressLine) - height,
          },
          'post-fix'
        );
      }}
    >
      <Animated.View style={innerStackStyle}>
        <Animated.View
          animatedProps={navAnimatedProps}
          style={[{ height: navH }, navAnimatedStyle]}
          className="bg-base"
        >
          <View className="flex-row items-center justify-between gap-3 px-3 py-2.5">
            <View className="min-w-0 flex-1 flex-row items-center gap-4">
              <FloatingGlassButton
                onPress={onToggleSidebar}
                accessibilityLabel="Abrir navegación"
                shape="circle"
                size={SIDEBAR_HEADER_BUTTON_SIZE}
              >
                <MenuTwoLines size={17} color={navIconColor} />
              </FloatingGlassButton>
              <View className="min-w-0 flex-1">
                <Text
                  className="text-sm font-bold text-primary"
                  numberOfLines={1}
                >
                  {progressLabel}
                </Text>
                {remainingLabel ? (
                  <Text className="text-[13px] text-secondary" numberOfLines={1}>
                    {remainingLabel}
                  </Text>
                ) : null}
              </View>
            </View>
            {!isComplete && onToggleViewMode ? (
              <FloatingGlassButton
                onPress={onToggleViewMode}
                accessibilityLabel={viewAll ? 'Cambiar a paso a paso' : 'Cambiar a vista completa'}
                shape="rounded"
              >
                {viewAll ? <List size={14} color={viewModeIconColor} /> : <Layers size={14} color={viewModeIconColor} />}
                <Text className={`text-[11px] font-semibold ${viewModeLabelClass}`}>
                  {viewAll ? 'Paso a paso' : 'Vista completa'}
                </Text>
              </FloatingGlassButton>
            ) : null}
          </View>
        </Animated.View>

        {!hideProgressLine ? (
          <View style={{ height: lineH }}>
            <View className="h-full bg-neutral-200 bg-surface-2 overflow-hidden">
              <Animated.View
                style={barStyle}
                className="h-full bg-accent dark:bg-accent/100 rounded-r-full"
                accessibilityRole="progressbar"
              />
            </View>
            <View className="absolute left-0 right-0 bottom-0 h-[1px] bg-neutral-200 dark:bg-white/10" />
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
