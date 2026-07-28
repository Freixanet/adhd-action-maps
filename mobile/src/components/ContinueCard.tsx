import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ACCENT } from '@shared/uiTokens';
import { getEntrySourceLabel } from '@shared/categories';
import { useTheme } from '../context/ThemeContext';
import { CONTINUE_CARD_RADIUS } from '../logic/continueTransition';
import { resolveEntrySourceIcon } from '../logic/entrySourceIcon';
import type { HistoryEntry } from '../logic/history';

type ContinueCardProps = {
  entry: HistoryEntry;
  onPress: () => void;
};

/** Single title line, vertically centered in the row. */
const TEXT_BLOCK_HEIGHT = 34;
/** Square well matched to the text row. */
const ICON_WELL = TEXT_BLOCK_HEIGHT;
const ICON_SIZE = 20;
/** Compact Surface padding around the text/icon row. */
const TILE_PAD_V = 8;
const TILE_PAD_H = 12;
const TILE_MIN_HEIGHT = TEXT_BLOCK_HEIGHT + TILE_PAD_V * 2;

const ContinueCard = forwardRef<View, ContinueCardProps>(function ContinueCard(
  { entry, onPress },
  ref
) {
  const { isDark } = useTheme();
  const Icon = resolveEntrySourceIcon(entry);
  const sourceLabel = getEntrySourceLabel(entry);
  const wellBg = isDark ? 'rgba(139,143,245,0.14)' : 'rgba(139,143,245,0.12)';

  return (
    <View ref={ref} collapsable={false} style={styles.wrap}>
      <View style={styles.shell}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Continuar ${entry.title} · ${sourceLabel}`}
          style={styles.press}
          className="active:opacity-80"
        >
          <View
            style={[styles.iconWell, { backgroundColor: wellBg }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon size={ICON_SIZE} color={ACCENT} strokeWidth={1.6} />
          </View>
          <Text
            className="text-[16px] font-bold text-primary"
            style={styles.title}
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
          >
            {entry.title}
          </Text>
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
    paddingHorizontal: TILE_PAD_H,
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
    lineHeight: 20,
  },
});
