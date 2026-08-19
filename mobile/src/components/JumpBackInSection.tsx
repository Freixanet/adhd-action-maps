import React, { useCallback, useMemo } from 'react';
import {
  ListRenderItemInfo,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { JUMP_BACK_IN_SECTION_TITLE } from '@shared/homeFeed';
import type { HistoryEntry } from '@shared/history';
import { type } from '@shared/design-tokens';
import { useThemeColors } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import { SIDEBAR_EDGE_INSET } from './sidebarLayout';
import RecentNucleoCard, {
  RECENT_NUCLEO_CARD_WIDTH_MAX,
  RECENT_NUCLEO_CARD_WIDTH_MIN,
} from './RecentNucleoCard';

const CARD_GAP = 14;
const SECTION_TOP = 72;
const SECTION_BOTTOM = 8;
/** Vertical room so the ambient shadow is not clipped by the list. */
const LIST_PAD_V = 14;
/** Peek of the next card when the row overflows (signals horizontal scroll). */
const OVERFLOW_PEEK = 32;
/** Cards away from the leading snap slot. */
const TRAILING_CARD_SCALE = 0.92;
const TRAILING_CARD_OPACITY = 0.55;

type JumpBackInSectionProps = {
  /** Already filtered via `selectLatestCreatedNucleos` (max 5). */
  items: readonly HistoryEntry[];
  onSelect: (id: string) => void;
};

type JumpBackCardProps = {
  entry: HistoryEntry;
  width: number;
  index: number;
  interval: number;
  scrollX: SharedValue<number>;
  onSelect: (id: string) => void;
};

function JumpBackCard({
  entry,
  width,
  index,
  interval,
  scrollX,
  onSelect,
}: JumpBackCardProps) {
  const slotStyle = useAnimatedStyle(() => {
    const span = interval > 0 ? interval : 1;
    const featured = interpolate(
      scrollX.value,
      [(index - 1) * span, index * span, (index + 1) * span],
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale: TRAILING_CARD_SCALE + featured * (1 - TRAILING_CARD_SCALE) }],
      opacity: TRAILING_CARD_OPACITY + featured * (1 - TRAILING_CARD_OPACITY),
    };
  });

  return (
    <Animated.View collapsable={false} style={[{ width, height: width }, slotStyle]}>
      <RecentNucleoCard
        entry={entry}
        width={width}
        onPress={onSelect}
        slotIndex={index}
        slotInterval={interval}
        scrollX={scrollX}
      />
    </Animated.View>
  );
}

export default function JumpBackInSection({ items, onSelect }: JumpBackInSectionProps) {
  const colors = useThemeColors();
  const { font } = useTypography();
  const { width: windowWidth } = useWindowDimensions();
  const scrollX = useSharedValue(0);

  const leadingInset = SIDEBAR_EDGE_INSET;
  const overflows = items.length > 1;

  const cardWidth = useMemo(() => {
    if (!overflows) {
      const available = windowWidth - leadingInset * 2;
      return Math.round(
        Math.min(RECENT_NUCLEO_CARD_WIDTH_MAX, Math.max(RECENT_NUCLEO_CARD_WIDTH_MIN, available))
      );
    }
    // Full-bleed track: only a leading inset; trailing edge is the screen edge.
    const available = windowWidth - leadingInset;
    const target = available - OVERFLOW_PEEK;
    return Math.round(
      Math.min(RECENT_NUCLEO_CARD_WIDTH_MAX, Math.max(RECENT_NUCLEO_CARD_WIDTH_MIN, target))
    );
  }, [leadingInset, overflows, windowWidth]);

  const snapInterval = cardWidth + CARD_GAP;
  const snapOffsets = useMemo(
    () => items.map((_, index) => index * snapInterval),
    [items, snapInterval]
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const keyExtractor = useCallback((item: HistoryEntry) => item.id, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<HistoryEntry>) => (
      <JumpBackCard
        entry={item}
        width={cardWidth}
        index={index}
        interval={snapInterval}
        scrollX={scrollX}
        onSelect={onSelect}
      />
    ),
    [cardWidth, onSelect, scrollX, snapInterval]
  );

  const ItemSeparator = useCallback(() => <View style={{ width: CARD_GAP }} />, []);

  const listGutter = useCallback(
    () => <View style={{ width: leadingInset }} />,
    [leadingInset]
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.headingWrap, { paddingHorizontal: leadingInset }]}>
        <Text
          style={[
            styles.heading,
            {
              color: colors.text.primary,
              fontFamily: font.family,
            },
          ]}
          maxFontSizeMultiplier={1.3}
          accessibilityRole="header"
        >
          {JUMP_BACK_IN_SECTION_TITLE}
        </Text>
      </View>
      <Animated.FlatList
        data={items as HistoryEntry[]}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={listGutter}
        ListFooterComponent={overflows ? null : listGutter}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces
        overScrollMode="never"
        nestedScrollEnabled
        directionalLockEnabled
        contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
        scrollIndicatorInsets={{ top: 0, left: 0, bottom: 0, right: 0 }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    marginTop: SECTION_TOP,
    marginBottom: SECTION_BOTTOM,
    backgroundColor: 'transparent',
  },
  headingWrap: {
    alignSelf: 'stretch',
  },
  heading: {
    fontSize: type.sectionTitle.fontSize,
    lineHeight: type.sectionTitle.lineHeight,
    fontWeight: type.sectionTitle.fontWeight as '600',
    letterSpacing: type.sectionTitle.letterSpacing,
  },
  list: {
    width: '100%',
    // Square cards: side ≤ WIDTH_MAX; list room matches that plus shadow pad.
    minHeight: RECENT_NUCLEO_CARD_WIDTH_MAX + LIST_PAD_V * 2,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  listContent: {
    paddingTop: LIST_PAD_V,
    paddingBottom: LIST_PAD_V,
    // Horizontal lists default to stretch on the cross-axis; that
    // elongates each card's shadow into a full-width section band.
    alignItems: 'center',
  },
});
