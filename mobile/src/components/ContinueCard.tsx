import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import { getEntrySourceLabel } from '@shared/categories';
import { resolveContinueProgress } from '@shared/homeFeed';
import { CONTINUE_CARD_RADIUS } from '../logic/continueTransition';
import { resolveEntrySourceIcon } from '../logic/entrySourceIcon';
import type { HistoryEntry } from '../logic/history';
import { type } from '@shared/design-tokens';

type ContinueCardProps = {
  entry: HistoryEntry;
  onPress: () => void;
};

/** Two-line semantic resume row. */
const TEXT_BLOCK_HEIGHT = 56;
/** Square well matched to the text row. */
const ICON_WELL = TEXT_BLOCK_HEIGHT;
const ICON_SIZE = 18;
/** Compact vertical padding around the text/icon row. */
const TILE_PAD_V = 6;
const TILE_MIN_HEIGHT = TEXT_BLOCK_HEIGHT + TILE_PAD_V * 2;

const ContinueCard = forwardRef<View, ContinueCardProps>(function ContinueCard(
  { entry, onPress },
  ref
) {
  const { colors } = useTheme();
  const { font } = useTypography();
  const Icon = resolveEntrySourceIcon(entry);
  const sourceLabel = getEntrySourceLabel(entry);
  const progress = resolveContinueProgress(entry);
  const wellBg = colors.background.accentSoft;

  return (
    <View ref={ref} collapsable={false} style={styles.wrap}>
      <View style={styles.shell}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${progress.ctaLabel}: ${entry.title}. ${progress.metaLabel}. ${progress.pointLabel}`}
          style={styles.press}
          className="active:opacity-80"
        >
          <View
            style={[styles.iconWell, { backgroundColor: wellBg }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon size={ICON_SIZE} color={colors.action.primary} strokeWidth={1.6} />
          </View>
          <View style={styles.textBlock}>
            <View style={styles.titleRow}>
              <Text
                className="text-title font-bold text-primary"
                style={[styles.title, { fontFamily: font.family }]}
                maxFontSizeMultiplier={1.5}
                numberOfLines={1}
              >
                {entry.title}
              </Text>
              <Text
                className="text-meta font-semibold text-accent"
                style={{ fontFamily: font.family }}
                maxFontSizeMultiplier={1.5}
                numberOfLines={1}
              >
                {progress.ctaLabel}
              </Text>
            </View>
            <Text
              className="mt-1 text-caption leading-4 text-secondary"
              style={{ fontFamily: font.family }}
              maxFontSizeMultiplier={1.5}
              numberOfLines={1}
            >
              {progress.metaLabel}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
});

export default ContinueCard;

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  shell: {
    width: '100%',
    minHeight: TILE_MIN_HEIGHT,
    borderRadius: CONTINUE_CARD_RADIUS,
    paddingVertical: TILE_PAD_V,
    // Flush with the composer glass left/right — same ComposerDock column, no extra inset.
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  press: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: TEXT_BLOCK_HEIGHT,
    minWidth: 0,
  },
  iconWell: {
    width: ICON_WELL,
    height: ICON_WELL,
    borderRadius: ICON_WELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    flex: 1,
    minWidth: 0,
    lineHeight: type.continueTitle.lineHeight,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
});
