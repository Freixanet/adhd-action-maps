import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Surface } from 'heroui-native';
import { ACCENT, RADII } from '@shared/uiTokens';
import { useTheme } from '../context/ThemeContext';
import { resolveTldrBentoIcon } from '../logic/tldrBentoIcon';

export type TldrBentoItem = {
  title: string;
  desc: string;
};

type TldrBentoGridProps = {
  items: TldrBentoItem[];
};

/** Title line (24) + gap (6) + two body lines (48). */
const TEXT_BLOCK_HEIGHT = 78;
/** Square well matched to the text block so icon and copy share the same height. */
const ICON_WELL = TEXT_BLOCK_HEIGHT;
const ICON_SIZE = 46;
/** Floor for the tile: text block plus Surface padding. Longer copy grows the tile. */
const TILE_MIN_HEIGHT = TEXT_BLOCK_HEIGHT + 32;

/**
 * “En 60 segundos” as a single-column bento: equal-size full-width tiles,
 * theme icon on the left, same Surface secondary language as Continuar.
 */
export default function TldrBentoGrid({ items }: TldrBentoGridProps) {
  const { isDark } = useTheme();
  if (!items.length) return null;

  const wellBg = isDark ? 'rgba(139,143,245,0.14)' : 'rgba(139,143,245,0.12)';

  return (
    <View style={styles.column}>
      {items.map((item, index) => {
        const Icon = resolveTldrBentoIcon(item.title, item.desc, index);
        return (
          <Surface
            key={`${item.title}-${index}`}
            variant="secondary"
            animation="disable-all"
            className="w-full overflow-hidden"
            style={styles.tile}
          >
            <View style={styles.row}>
              <View
                style={[styles.iconWell, { backgroundColor: wellBg }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Icon size={ICON_SIZE} color={ACCENT} strokeWidth={1.6} />
              </View>
              <View style={styles.copy}>
                <Text
                  className="text-[18px] font-bold leading-[24px] text-primary"
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  className="mt-1.5 text-[16px] leading-[24px] text-body"
                  maxFontSizeMultiplier={1.2}
                >
                  {item.desc}
                </Text>
              </View>
            </View>
          </Surface>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    gap: 12,
  },
  tile: {
    width: '100%',
    minHeight: TILE_MIN_HEIGHT,
    borderRadius: RADII.lg,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWell: {
    width: ICON_WELL,
    height: ICON_WELL,
    borderRadius: RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
});
