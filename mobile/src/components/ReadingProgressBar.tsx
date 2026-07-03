import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Layers, List } from 'lucide-react-native';
import FloatingGlassButton from './FloatingGlassButton';
import MenuTwoLines from './MenuTwoLines';
import { SIDEBAR_HEADER_BUTTON_SIZE } from './sidebarLayout';
import { useTheme } from '../context/ThemeContext';

/** Fallback for nav row height before onLayout (py-2.5 + 36px button). */
export const READING_PROGRESS_BAR_HEIGHT = 60;
export const READING_PROGRESS_LINE_HEIGHT = 8;

export function readingProgressBarTotalHeight(hideProgressLine?: boolean): number {
  return READING_PROGRESS_BAR_HEIGHT + (hideProgressLine ? 0 : READING_PROGRESS_LINE_HEIGHT);
}

/** Scroll content inset below the absolute reading header (bar height + small gap). */
export function mapContentTopPadding(hideProgressLine?: boolean, extraGap = 8): number {
  return readingProgressBarTotalHeight(hideProgressLine) + extraGap;
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

  useEffect(() => {
    if (viewAll) return;
    stepProgressValue.value = withTiming(stepProgress / 100, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [stepProgress, stepProgressValue, viewAll]);

  const barStyle = useAnimatedStyle(() => {
    const ratio = viewAll && scrollProgressShared ? scrollProgressShared.value : stepProgressValue.value;
    return {
      width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
    };
  });

  const shellStyle = useAnimatedStyle(() => {
    const navH = READING_PROGRESS_BAR_HEIGHT;
    const lineH = READING_PROGRESS_LINE_HEIGHT;

    if (!headerVisibleShared) {
      return { height: hideProgressLine ? navH : lineH };
    }

    if (hideProgressLine) {
      return {
        height: withTiming(headerVisibleShared.value ? navH : 0, { duration: 250 }),
      };
    }

    return {
      height: withTiming(headerVisibleShared.value ? navH + lineH : lineH, { duration: 250 }),
    };
  });

  const navAnimatedStyle = useAnimatedStyle(() => {
    const offset = READING_PROGRESS_BAR_HEIGHT;
    if (!headerVisibleShared) {
      return {
        height: offset,
        transform: [{ translateY: 0 }],
        opacity: 1,
      };
    }

    return {
      height: offset,
      transform: [
        {
          translateY: withTiming(headerVisibleShared.value ? 0 : -offset, {
            duration: 250,
          }),
        },
      ],
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

  const progressPositionStyle = useAnimatedStyle(() => {
    if (hideProgressLine || !headerVisibleShared) {
      return { top: 0 };
    }

    const navH = READING_PROGRESS_BAR_HEIGHT;
    return {
      top: withTiming(headerVisibleShared.value ? navH : 0, { duration: 250 }),
    };
  });

  const viewModeIconColor = viewAll ? (isDark ? '#a5b4fc' : '#8B8FF5') : isDark ? '#a3a3a3' : '#737373';
  const viewModeLabelClass = viewAll
    ? 'text-accent'
    : 'text-body';

  return (
    <Animated.View
      style={shellStyle}
      className="absolute left-0 right-0 top-0 z-50 overflow-hidden"
    >
      <Animated.View
        animatedProps={navAnimatedProps}
        style={navAnimatedStyle}
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
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0 }, progressPositionStyle]}>
          <View className="h-2 bg-neutral-200 bg-surface-2">
            <Animated.View
              style={barStyle}
              className="h-full bg-accent dark:bg-accent/100 rounded-r-full"
              accessibilityRole="progressbar"
            />
          </View>
        </Animated.View>
      ) : null}

      <View className="absolute left-0 right-0 bottom-0 h-[1px] bg-neutral-200 dark:bg-white/10" />
    </Animated.View>
  );
}
