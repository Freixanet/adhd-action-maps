import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { hapticSegment } from '../logic/haptics';
import {
  HOME_SURFACE_LAYOUT,
  HOME_SURFACE_OPTIONS,
  HOME_SURFACE_TEST_IDS,
  HOME_SURFACE_THUMB_HEIGHT,
  HOME_SURFACE_THUMB_TRAVEL,
  HOME_SURFACE_TRACK_WIDTH,
  homeSurfaceAccessibilityLabel,
  homeSurfaceToIndex,
  resolveHomeSurfaceCommit,
  shouldAnimateHomeSurfaceThumb,
  type HomeSurface,
} from '@shared/homeSurfaceModel';
import { NucleoGlassSegment } from '../../modules/nucleo-glass-segment/src';
import { shouldUseNativeMultiSegment } from '../logic/nativeGlassSegment';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useTheme } from '../context/ThemeContext';
import { SIDEBAR_TOGGLE_BUTTON_SIZE } from './sidebarLayout';
import { motion, type } from '@shared/design-tokens';

type HomeSurfaceSegmentProps = {
  value: HomeSurface;
  onChange: (surface: HomeSurface) => void;
  disabled?: boolean;
};

/** Compact Chat / Núcleo width — system control owns indicator metrics. */
const NATIVE_OUTER_WIDTH = 120;
/**
 * Extra space so the press-expanded Liquid Glass lens is not clipped by the
 * Expo/RN host. Negative margin keeps the header row from growing.
 */
const NATIVE_OVERFLOW_PAD = 24;
const NATIVE_HOST_HEIGHT = SIDEBAR_TOGGLE_BUTTON_SIZE;

const SPRING = { damping: 26, stiffness: 380, mass: 0.72 } as const;

function fireHomeSurfaceHaptic() {
  hapticSegment();
}

/**
 * Chat / Núcleo.
 * Product path (iOS 26+): system SwiftUI Picker(.segmented) at controlSize.large.
 * The system owns the expanding Liquid Glass thumb on press.
 * Solid RN capsule only when the native multi-segment module is absent.
 */
export default function HomeSurfaceSegment({
  value,
  onChange,
  disabled = false,
}: HomeSurfaceSegmentProps) {
  const { isDark } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const useNative = shouldUseNativeMultiSegment(false);

  const handleNativeChange = (next: string) => {
    if (next !== 'chat' && next !== 'nucleo') return;
    const commit = resolveHomeSurfaceCommit({
      current: value,
      nextIndex: next === 'nucleo' ? 1 : 0,
    });
    if (!commit.changed) return;
    fireHomeSurfaceHaptic();
    onChange(commit.surface);
  };

  if (useNative) {
    return (
      <View
        testID={HOME_SURFACE_TEST_IDS.root}
        style={[styles.nativeHost, disabled ? styles.disabled : null]}
        pointerEvents="box-none"
        accessibilityRole="tablist"
        accessibilityLabel="Superficie"
      >
        <NucleoGlassSegment
          optionIds={['chat', 'nucleo']}
          optionLabels={['Chat', 'Núcleo']}
          selectedId={value}
          isEnabled={!disabled}
          themeVariant={isDark ? 'dark' : 'light'}
          reduceMotion={reduceMotion}
          onIntentChange={(event) => {
            handleNativeChange(event.nativeEvent.intent);
          }}
          style={styles.nativeView}
        />
      </View>
    );
  }

  return (
    <SolidCapsuleFallback
      value={value}
      selectedIndex={homeSurfaceToIndex(value)}
      disabled={disabled}
      isDark={isDark}
      reduceMotion={reduceMotion}
      onChange={onChange}
    />
  );
}

function SolidCapsuleFallback({
  value,
  selectedIndex,
  disabled,
  isDark,
  reduceMotion,
  onChange,
}: {
  value: HomeSurface;
  selectedIndex: 0 | 1;
  disabled: boolean;
  isDark: boolean;
  reduceMotion: boolean;
  onChange: (surface: HomeSurface) => void;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue<number>(selectedIndex);
  const dragOrigin = useSharedValue<number>(selectedIndex);
  const mountedGen = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const gen = ++mountedGen.current;
    return () => {
      mountedGen.current = gen + 1;
    };
  }, []);

  useEffect(() => {
    if (shouldAnimateHomeSurfaceThumb(reduceMotion)) {
      progress.value = withSpring(selectedIndex, SPRING);
    } else {
      progress.value = withTiming(selectedIndex, { duration: motion.instant.duration });
    }
  }, [progress, reduceMotion, selectedIndex]);

  const commitIndex = useCallback(
    (nextIndex: number) => {
      const gen = mountedGen.current;
      const commit = resolveHomeSurfaceCommit({
        current: valueRef.current,
        nextIndex,
      });
      if (shouldAnimateHomeSurfaceThumb(reduceMotion)) {
        progress.value = withSpring(commit.index, SPRING);
      } else {
        progress.value = commit.index;
      }
      if (!commit.changed) return;
      if (gen !== mountedGen.current) return;
      fireHomeSurfaceHaptic();
      onChange(commit.surface);
    },
    [onChange, progress, reduceMotion]
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      'worklet';
      dragOrigin.value = progress.value;
    })
    .onUpdate((event) => {
      'worklet';
      const next = dragOrigin.value + event.translationX / HOME_SURFACE_THUMB_TRAVEL;
      progress.value = next < 0 ? 0 : next > 1 ? 1 : next;
    })
    .onEnd((event) => {
      'worklet';
      const projected = progress.value + event.velocityX / 2400;
      const index: 0 | 1 = projected >= 0.5 ? 1 : 0;
      runOnJS(commitIndex)(index);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * HOME_SURFACE_THUMB_TRAVEL }],
  }));

  const trackBg = colors.background.whiteFade10;
  const trackBorder = colors.border.subtle;
  const thumbBg = isDark ? colors.background.whiteFade22 : colors.background.whiteFade96;
  const thumbBorder = colors.border.subtle;
  const activeColor = isDark ? colors.background.lightSendFillAlt : colors.background.intentTrack;
  const mutedColor = colors.text.secondary;

  return (
    <GestureDetector gesture={pan}>
      <View
        testID={HOME_SURFACE_TEST_IDS.root}
        accessibilityRole="tablist"
        accessibilityLabel="Superficie"
        style={[styles.fallbackTrack, disabled ? styles.disabled : null]}
      >
        <View
          pointerEvents="none"
          testID={HOME_SURFACE_TEST_IDS.trackSurface}
          style={[
            StyleSheet.absoluteFill,
            styles.fallbackTrackSurface,
            { backgroundColor: trackBg, borderColor: trackBorder },
          ]}
        />
        <Animated.View pointerEvents="none" style={[styles.fallbackThumb, thumbStyle]}>
          <View
            testID={HOME_SURFACE_TEST_IDS.thumbSurface}
            style={[
              styles.fallbackThumbSurface,
              {
                backgroundColor: thumbBg,
                borderColor: thumbBorder,
              },
            ]}
          />
        </Animated.View>
        <View style={styles.fallbackRow} pointerEvents="box-none">
          {HOME_SURFACE_OPTIONS.map((option) => {
            const isSelected = option.id === value;
            return (
              <Pressable
                key={option.id}
                testID={
                  option.id === 'nucleo'
                    ? HOME_SURFACE_TEST_IDS.optionNucleo
                    : HOME_SURFACE_TEST_IDS.optionChat
                }
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={homeSurfaceAccessibilityLabel(option.id)}
                disabled={disabled}
                onPress={() => commitIndex(option.id === 'nucleo' ? 1 : 0)}
                style={styles.fallbackSegment}
              >
                <Text
                  style={[
                    styles.fallbackLabel,
                    { color: isSelected ? activeColor : mutedColor },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  nativeHost: {
    width: NATIVE_OUTER_WIDTH + NATIVE_OVERFLOW_PAD * 2,
    height: NATIVE_HOST_HEIGHT + NATIVE_OVERFLOW_PAD * 2,
    marginHorizontal: -NATIVE_OVERFLOW_PAD,
    marginVertical: -NATIVE_OVERFLOW_PAD,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  nativeView: {
    width: NATIVE_OUTER_WIDTH + NATIVE_OVERFLOW_PAD * 2,
    height: NATIVE_HOST_HEIGHT + NATIVE_OVERFLOW_PAD * 2,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  fallbackTrack: {
    width: HOME_SURFACE_TRACK_WIDTH,
    height: HOME_SURFACE_LAYOUT.trackHeight,
    borderRadius: HOME_SURFACE_LAYOUT.trackHeight / 2,
    padding: HOME_SURFACE_LAYOUT.trackPad,
    justifyContent: 'center',
    overflow: 'visible',
  },
  fallbackTrackSurface: {
    borderRadius: HOME_SURFACE_LAYOUT.trackHeight / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackThumb: {
    position: 'absolute',
    left: HOME_SURFACE_LAYOUT.trackPad,
    top: HOME_SURFACE_LAYOUT.trackPad,
    width: HOME_SURFACE_LAYOUT.segmentWidth,
    height: HOME_SURFACE_THUMB_HEIGHT,
  },
  fallbackThumbSurface: {
    flex: 1,
    borderRadius: HOME_SURFACE_THUMB_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  fallbackSegment: {
    width: HOME_SURFACE_LAYOUT.segmentWidth,
    height: HOME_SURFACE_THUMB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  fallbackLabel: {
    fontSize: type.calloutSemibold.fontSize,
    fontWeight: type.calloutSemibold.fontWeight,
    letterSpacing: type.calloutSemibold.letterSpacing,
  },
  disabled: {
    opacity: 0.4,
  },
});
