import React, { memo, useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { radius, shadow, space, type } from '@shared/design-tokens';
import type { HistoryEntry } from '@shared/history';
import { isChatHistoryEntry } from '@shared/historyKind';
import { useCalmPress } from '../hooks/useCalmPress';
import { useTheme } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import NucleoCover from './NucleoCover';

/** Square card side length bounds (width = height). */
export const RECENT_NUCLEO_CARD_WIDTH_MIN = 200;
export const RECENT_NUCLEO_CARD_WIDTH_MAX = 220;
/** Cover / illustration band as a fraction of card height. Rest is title. */
export const RECENT_NUCLEO_COVER_RATIO = 0.76;
/** Illustration size relative to the art plane. */
export const RECENT_NUCLEO_ART_SCALE = 1.12;

type RecentNucleoCardProps = {
  entry: HistoryEntry;
  width: number;
  onPress: (id: string) => void;
  slotIndex?: number;
  slotInterval?: number;
  scrollX?: SharedValue<number>;
};

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
  const { style: pressStyle, handlers } = useCalmPress();
  const size = width;
  const coverHeight = Math.round(size * RECENT_NUCLEO_COVER_RATIO);
  const cardRadius = radius.card;
  const idleScroll = useSharedValue(0);
  const trackX = scrollX ?? idleScroll;

  const cardShadow = isDark ? shadow.homeCardDark : shadow.homeCardLight;

  const handlePress = useCallback(() => {
    onPress(entry.id);
  }, [entry.id, onPress]);

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
      onPressIn={handlers.onPressIn}
      onPressOut={handlers.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={
        isChatHistoryEntry(entry) ? `Abrir chat: ${entry.title}` : `Abrir Núcleo: ${entry.title}`
      }
    >
      <Animated.View
        style={[
          cardShadow,
          {
            width: size,
            height: size,
            borderRadius: cardRadius,
          },
          pressStyle,
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
              backgroundColor: colors.background.canvas,
            },
            Platform.OS === 'ios' ? styles.continuous : null,
          ]}
        >
          <View style={{ width: size, height: coverHeight, overflow: 'hidden' }}>
            <NucleoCover entry={entry} width={size} height={coverHeight} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.veil,
                { backgroundColor: colors.background.scrim },
                veilStyle,
              ]}
            />
          </View>
          <View
            style={[
              styles.titleBand,
              {
                height: size - coverHeight,
                paddingHorizontal: space.stack.md,
                paddingBottom: space.stack.sm,
              },
            ]}
          >
            <Text
              numberOfLines={2}
              style={{
                fontFamily: font.family,
                fontSize: type.continueTitle.fontSize,
                lineHeight: type.continueTitle.lineHeight,
                fontWeight: type.continueTitle.fontWeight,
                letterSpacing: type.continueTitle.letterSpacing,
                color: colors.text.primary,
              }}
            >
              {entry.title}
            </Text>
          </View>
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
  veil: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  titleBand: {
    justifyContent: 'flex-end',
  },
});
