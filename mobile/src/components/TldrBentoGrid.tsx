import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography } from '@shared/design-tokens';
import { useTheme } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import { resolveTldrBentoIcon } from '../logic/tldrBentoIcon';

export type TldrBentoItem = {
  title: string;
  desc: string;
};

type TldrBentoGridProps = {
  items: TldrBentoItem[];
};

const ICON_SLOT = 32;
const ICON_SIZE = 28;

/**
 * “En 60 segundos” as a clean editorial list: icon, title and subtitle only.
 * No cards, wells, borders, fills or shadows.
 */
export default function TldrBentoGrid({ items }: TldrBentoGridProps) {
  const { colors } = useTheme();
  const { font } = useTypography();
  if (!items.length) return null;

  return (
    <View style={styles.column}>
      {items.map((item, index) => {
        const Icon = resolveTldrBentoIcon(item.title, item.desc, index);
        return (
          <View key={`${item.title}-${index}`} style={styles.row}>
            <View
              style={styles.iconSlot}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon size={ICON_SIZE} color={colors.action.primary} strokeWidth={1.7} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.itemTitle, { color: colors.text.primary, fontFamily: font.family }]}>
                {item.title}
              </Text>
              <Text
                style={[styles.itemSubtitle, { color: colors.text.secondary, fontFamily: font.family }]}
              >
                {item.desc}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    gap: 20,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconSlot: {
    width: ICON_SLOT,
    minHeight: ICON_SLOT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    ...typography('inputTitle'),
  },
  itemSubtitle: {
    marginTop: 4,
    ...typography('callout'),
    opacity: 1,
  },
});
