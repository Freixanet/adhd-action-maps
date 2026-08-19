import React, { memo, useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  motion,
  radius,
  shadow,
  space,
  type,
} from '@shared/design-tokens';
import type { HistoryEntry } from '@shared/history';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useTheme } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import { stepHaptic } from '../logic/stepHaptic';
import NucleoCover from './NucleoCover';

/** Square card side length bounds (width = height). */
export const RECENT_NUCLEO_CARD_WIDTH_MIN = 200;
export const RECENT_NUCLEO_CARD_WIDTH_MAX = 220;
/** Cover / illustration band as a fraction of card height. */
export const RECENT_NUCLEO_COVER_RATIO = 0.76;

type RecentNucleoCardProps = {
  entry: HistoryEntry;
  width: number;
  onPress: (id: string) => void;
  slotIndex?: number;
  slotInterval?: number;
  scrollX?: SharedValue<number>;
};

const PRESS_DURATION = motion.homeCardPress.duration;
const PRESS_SCALE = motion.homeCardPress.scale;

function RecentNucleoCard({
  entry,
  width,
  onPress,
  slotIndex = 0,
  slotInterval = 1,
  scrollX,
}: RecentNucleoCardProps) {
  const { isDark, colors } = useTheme();
  const { font } = useTypography();
  const { reduceMotion } = useGlassAccessibility();
  const size = width;
  const textBand = Math.round(size * (1 - RECENT_NUCLEO_COVER_RATIO));
  const cardRadius = radius.card;
  const press = useSharedValue(0);
  const idleScroll = useSharedValue(0);
  const trackX = scrollX ?? idleScroll;

  const cardShadow = isDark ? shadow.homeCardDark : shadow.homeCardLight;

  const handlePress = useCallback(() => {
    stepHaptic();
    onPress(entry.id);
  }, [entry.id, onPress]);

  const handlePressIn = useCallback(() => {
    press.value = withTiming(1, { duration: PRESS_DURATION });
  }, [press]);

  const handlePressOut = useCallback(() => {
    press.value = withTiming(0, { duration: PRESS_DURATION });
  }, [press]);

  const motionStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { transform: [{ scale: 1 }] };
    }
    return {
      transform: [{ scale: interpolate(press.value, [0, 1], [1, PRESS_SCALE]) }],
    };
  }, [reduceMotion]);

  const veilStyle = useAnimatedStyle(() => {
    const span = slotInterval > 0 ? slotInterval : 1;
    return {
      opacity: interpolate(
        trackX.value,
        [(slotIndex - 1) * span, slotIndex * span, (slotIndex + 1) * span],
        [1, 0, 1],
        Extrapolation.CLAMP
      ),
    };
  }, [trackX, slotIndex, slotInterval]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Abrir Núcleo: ${entry.title}`}
    >
      <Animated.View
        style={[
          cardShadow,
          {
            width: size,
            height: size,
            borderRadius: cardRadius,
          },
          motionStyle,
          Platform.OS === 'ios' ? styles.continuous : null,
        ]}
      >
        <View
          style={[
            styles.surface,
            {
              width: size,
              height: size,
              borderRadius: cardRadius,
              backgroundColor: colors.background.accentSoft,
            },
            Platform.OS === 'ios' ? styles.continuous : null,
          ]}
        >
          <NucleoCover
            entry={entry}
            width={size}
            height={size}
            contentInsetBottom={textBand}
            artOffsetY={-space.stack.lg}
            artScale={1.12}
          />
          <View style={[styles.textPad, { height: textBand }]}>
            <Text
              style={[styles.title, { color: colors.text.primary, fontFamily: font.family }]}
              numberOfLines={2}
              maxFontSizeMultiplier={1.35}
            >
              {entry.title}
            </Text>
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.veil,
              { backgroundColor: colors.background.scrim },
              veilStyle,
            ]}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default memo(RecentNucleoCard);

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
    minHeight: 44,
  },
  continuous: {
    borderCurve: 'continuous',
  },
  textPad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    justifyContent: 'center',
    paddingHorizontal: space.stack.md,
    paddingBottom: space.stack.sm,
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  title: {
    fontSize: type.continueTitle.fontSize,
    lineHeight: type.continueTitle.lineHeight,
    fontWeight: type.continueTitle.fontWeight as '700',
    letterSpacing: type.continueTitle.letterSpacing,
  },
});
