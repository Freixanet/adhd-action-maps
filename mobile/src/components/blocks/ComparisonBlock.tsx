import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { HAIRLINE, RADII } from '@shared/uiTokens';
import type { StepContentBlockComparison } from '@shared/contracts';
import ElevatedSurface from '../ElevatedSurface';
import { useTheme } from '../../context/ThemeContext';
import { useGlassAccessibility } from '../../hooks/useGlassAccessibility';
import { useInViewportOnce } from '../../hooks/useInViewportOnce';
import BlockEnter from './BlockEnter';
import { contentEnterStagger } from '../../motion/contentEnter';
import { motion, typography } from '@shared/design-tokens';

type Props = {
  block: StepContentBlockComparison;
  index?: number;
};

function SideCard({
  title,
  rows,
  side,
  visible,
  reduceMotion,
}: {
  title: string;
  rows: { label: string; value: string }[];
  side: 'left' | 'right';
  visible: boolean;
  reduceMotion: boolean;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      side === 'left' ? 0 : 80,
      withTiming(1, { duration: motion.reveal.duration, easing: Easing.out(Easing.cubic) })
    );
  }, [progress, reduceMotion, side, visible]);

  const animatedStyle = useAnimatedStyle(() => {
    const from = side === 'left' ? -18 : 18;
    return {
      opacity: progress.value,
      transform: [{ translateX: (1 - progress.value) * from }],
      flex: 1,
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <ElevatedSurface borderRadius={RADII.sm} style={styles.sideSurface}>
        <View style={styles.sideInner}>
          <Text style={[styles.colTitle, { color: colors.text.primary }]} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          {rows.map((row) => (
            <View key={row.label} style={styles.sideRow}>
              <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>{row.label}</Text>
              <Text style={[styles.rowValue, { color: colors.text.body }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      </ElevatedSurface>
    </Animated.View>
  );
}

export default function ComparisonBlock({ block, index = 0 }: Props) {
  const { colors } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const { visible, onLayout } = useInViewportOnce();
  const cols = block.columns;

  if (cols.length === 2) {
    const left = cols[0]!;
    const right = cols[1]!;
    return (
      <BlockEnter delayMs={contentEnterStagger(index)}>
        <View onLayout={onLayout} style={styles.wrap} accessibilityRole="summary">
          <View style={styles.twoCol}>
            <SideCard
              title={left}
              side="left"
              visible={visible}
              reduceMotion={reduceMotion}
              rows={block.rows.map((row) => ({
                label: row.label,
                value: row.values[0] ?? '',
              }))}
            />
            <SideCard
              title={right}
              side="right"
              visible={visible}
              reduceMotion={reduceMotion}
              rows={block.rows.map((row) => ({
                label: row.label,
                value: row.values[1] ?? '',
              }))}
            />
          </View>
        </View>
      </BlockEnter>
    );
  }

  return (
    <BlockEnter delayMs={contentEnterStagger(index)}>
      <View onLayout={onLayout} style={styles.wrap}>
        <ElevatedSurface borderRadius={RADII.md} style={styles.tableSurface}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.headerRow]}>
              <Text style={[styles.cell, styles.headerCell, styles.labelCell, { color: colors.text.secondary }]}> </Text>
              {cols.map((col) => (
                <Text key={col} style={[styles.cell, styles.headerCell, { color: colors.text.primary }]}>
                  {col}
                </Text>
              ))}
            </View>
            {block.rows.map((row, rowIndex) => (
              <View
                key={`${row.label}-${rowIndex}`}
                style={[
                  styles.tableRow,
                  rowIndex < block.rows.length - 1 && [styles.rowDivider, { borderBottomColor: colors.border.subtle }],
                ]}
              >
                <Text style={[styles.cell, styles.labelCell, { color: colors.text.secondary }]}>{row.label}</Text>
                {row.values.map((value, i) => (
                  <Text key={`${row.label}-${i}`} style={[styles.cell, { color: colors.text.body }]}>
                    {value}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ElevatedSurface>
      </View>
    </BlockEnter>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 12,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  sideSurface: {
    borderRadius: RADII.sm,
    overflow: 'hidden',
    flex: 1,
  },
  sideInner: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  colTitle: {
    ...typography('calloutBold'),
  },
  sideRow: {
    gap: 2,
  },
  rowLabel: {
    ...typography('captionSemiboldTrack'),
    textTransform: 'uppercase',
  },
  rowValue: {
    ...typography('callout'),
  },
  tableSurface: {
    borderRadius: RADII.md,
    overflow: 'hidden',
  },
  table: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  headerRow: {
    paddingBottom: 8,
  },
  rowDivider: {
    borderBottomWidth: HAIRLINE,
  },
  cell: {
    flex: 1,
    ...typography('label'),
    paddingHorizontal: 4,
  },
  headerCell: {
    ...typography('captionBold'),
  },
  labelCell: {
    flex: 1.1,
    ...typography('labelSemibold'),
  },
});
