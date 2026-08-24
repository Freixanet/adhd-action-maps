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
import type { MapIntent } from '@shared/contracts';
import {
  INTENT_SELECTOR_LAYOUT,
  INTENT_SELECTOR_TEST_IDS,
  INTENT_SELECTOR_THUMB_HEIGHT,
  INTENT_SELECTOR_THUMB_TRAVEL,
  INTENT_SELECTOR_TRACK_WIDTH,
  INTENT_SELECTOR_OPTIONS,
  intentSelectorAccessibilityLabel,
  intentToSelectorIndex,
  resolveIntentSelectorCommit,
  shouldAnimateIntentThumb,
  type IntentSelectorOptionId,
} from '@shared/intentSelectorModel';
import { NucleoGlassSegment } from '../../modules/nucleo-glass-segment/src';
import { shouldUseNativeGlassSegment } from '../logic/nativeGlassSegment';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useTheme } from '../context/ThemeContext';
import { SIDEBAR_TOGGLE_BUTTON_SIZE } from './sidebarLayout';
import { motion, type } from '@shared/design-tokens';

type IntentSelectorProps = {
  value: MapIntent;
  onChange: (intent: IntentSelectorOptionId) => void;
  disabled?: boolean;
};

/** Outer track width — system control owns indicator metrics. */
const NATIVE_OUTER_WIDTH = 196;
/**
 * Extra space so the press-expanded Liquid Glass lens is not clipped by the
 * Expo/RN host. Negative margin keeps the header row from growing.
 */
const NATIVE_OVERFLOW_PAD = 24;
/** Align optical center with sidebar toggle. */
const NATIVE_HOST_HEIGHT = SIDEBAR_TOGGLE_BUTTON_SIZE;

const SPRING = { damping: 26, stiffness: 380, mass: 0.72 } as const;

/**
 * Entender / Aplicar.
 * Product path (iOS 26+): system SwiftUI Picker(.segmented) at controlSize.large.
 * The system owns the expanding Liquid Glass thumb on press.
 * Solid RN capsule only when the native module is absent.
 */
export default function IntentSelector({
  value,
  onChange,
  disabled = false,
}: IntentSelectorProps) {
  const { isDark, colors } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const useNative = shouldUseNativeGlassSegment(false);
  const selectedIntent: IntentSelectorOptionId =
    value === 'apply' ? 'apply' : 'understand';

  const handleNativeChange = (next: string) => {
    if (next !== 'understand' && next !== 'apply') return;
    const commit = resolveIntentSelectorCommit({
      current: value,
      nextIndex: next === 'apply' ? 1 : 0,
    });
    if (commit.changed) onChange(commit.intent);
  };

  if (useNative) {
    return (
      <View
        testID={INTENT_SELECTOR_TEST_IDS.root}
        style={[styles.nativeHost, disabled ? styles.disabled : null]}
        pointerEvents="box-none"
      >
        <NucleoGlassSegment
          selectedIntent={selectedIntent}
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
      selectedIndex={intentToSelectorIndex(value)}
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
  value: MapIntent;
  selectedIndex: 0 | 1;
  disabled: boolean;
  isDark: boolean;
  reduceMotion: boolean;
  onChange: (intent: IntentSelectorOptionId) => void;
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
    if (shouldAnimateIntentThumb(reduceMotion)) {
      progress.value = withSpring(selectedIndex, SPRING);
    } else {
      progress.value = withTiming(selectedIndex, { duration: motion.instant.duration });
    }
  }, [progress, reduceMotion, selectedIndex]);

  const commitIndex = useCallback(
    (nextIndex: number) => {
      const gen = mountedGen.current;
      const commit = resolveIntentSelectorCommit({
        current: valueRef.current,
        nextIndex,
      });
      if (shouldAnimateIntentThumb(reduceMotion)) {
        progress.value = withSpring(commit.index, SPRING);
      } else {
        progress.value = commit.index;
      }
      if (!commit.changed) return;
      if (gen !== mountedGen.current) return;
      hapticSegment();
      onChange(commit.intent);
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
      const next = dragOrigin.value + event.translationX / INTENT_SELECTOR_THUMB_TRAVEL;
      progress.value = next < 0 ? 0 : next > 1 ? 1 : next;
    })
    .onEnd((event) => {
      'worklet';
      const projected = progress.value + event.velocityX / 2400;
      const index: 0 | 1 = projected >= 0.5 ? 1 : 0;
      runOnJS(commitIndex)(index);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * INTENT_SELECTOR_THUMB_TRAVEL }],
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
        testID={INTENT_SELECTOR_TEST_IDS.root}
        accessibilityRole="tablist"
        accessibilityLabel="Modo"
        style={[styles.fallbackTrack, disabled ? styles.disabled : null]}
      >
        <View
          pointerEvents="none"
          testID={INTENT_SELECTOR_TEST_IDS.trackSurface}
          style={[
            StyleSheet.absoluteFill,
            styles.fallbackTrackSurface,
            { backgroundColor: trackBg, borderColor: trackBorder },
          ]}
        />
        <Animated.View pointerEvents="none" style={[styles.fallbackThumb, thumbStyle]}>
          <View
            testID={INTENT_SELECTOR_TEST_IDS.thumbSurface}
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
          {INTENT_SELECTOR_OPTIONS.map((option) => {
            const isSelected =
              option.id === 'apply' ? value === 'apply' : value !== 'apply';
            return (
              <Pressable
                key={option.id}
                testID={
                  option.id === 'apply'
                    ? INTENT_SELECTOR_TEST_IDS.optionApply
                    : INTENT_SELECTOR_TEST_IDS.optionUnderstand
                }
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={intentSelectorAccessibilityLabel(option.id)}
                disabled={disabled}
                onPress={() => commitIndex(option.id === 'apply' ? 1 : 0)}
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
    width: INTENT_SELECTOR_TRACK_WIDTH,
    height: INTENT_SELECTOR_LAYOUT.trackHeight,
    borderRadius: INTENT_SELECTOR_LAYOUT.trackHeight / 2,
    padding: INTENT_SELECTOR_LAYOUT.trackPad,
    justifyContent: 'center',
    overflow: 'visible',
  },
  fallbackTrackSurface: {
    borderRadius: INTENT_SELECTOR_LAYOUT.trackHeight / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackThumb: {
    position: 'absolute',
    left: INTENT_SELECTOR_LAYOUT.trackPad,
    top: INTENT_SELECTOR_LAYOUT.trackPad,
    width: INTENT_SELECTOR_LAYOUT.segmentWidth,
    height: INTENT_SELECTOR_THUMB_HEIGHT,
  },
  fallbackThumbSurface: {
    flex: 1,
    borderRadius: INTENT_SELECTOR_THUMB_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  fallbackSegment: {
    width: INTENT_SELECTOR_LAYOUT.segmentWidth,
    height: INTENT_SELECTOR_THUMB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  fallbackLabel: {
    fontSize: INTENT_SELECTOR_LAYOUT.labelFontSize,
    fontWeight: INTENT_SELECTOR_LAYOUT.labelFontWeight,
    letterSpacing: type.intentLabel.letterSpacing,
  },
  disabled: {
    opacity: 0.4,
  },
});
