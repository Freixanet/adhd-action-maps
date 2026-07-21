import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { HAIRLINE, RADII, TEXT_BODY, TEXT_PRIMARY, TEXT_SECONDARY } from '@shared/uiTokens';
import type { StepContentBlockComparison } from '@shared/contracts';
import GlassSurface from '../GlassSurface';
import { useTheme } from '../../context/ThemeContext';
import { useGlassAccessibility } from '../../hooks/useGlassAccessibility';
import { useInViewportOnce } from '../../hooks/useInViewportOnce';
import BlockEnter from './BlockEnter';

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
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      side === 'left' ? 0 : 80,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })
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
      <GlassSurface
        liquid
        borderRadius={RADII.sm}
        className="rounded-xl overflow-hidden"
        style={styles.sideGlass}
        overlayClassName="bg-white/[0.05]"
      >
        <View style={styles.sideInner}>
          <Text style={styles.colTitle} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          {rows.map((row) => (
            <View key={row.label} style={styles.sideRow}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

export default function ComparisonBlock({ block, index = 0 }: Props) {
  const { isDark } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const { visible, onLayout } = useInViewportOnce();
  const cols = block.columns;

  if (cols.length === 2) {
    const left = cols[0]!;
    const right = cols[1]!;
    return (
      <BlockEnter delayMs={index * 60}>
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
    <BlockEnter delayMs={index * 60}>
      <View onLayout={onLayout} style={styles.wrap}>
        <GlassSurface
          liquid
          borderRadius={RADII.md}
          className="rounded-2xl overflow-hidden"
          style={styles.tableGlass}
          overlayClassName={isDark ? 'bg-white/[0.05]' : 'bg-white/45'}
        >
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.headerRow]}>
              <Text style={[styles.cell, styles.headerCell, styles.labelCell]}> </Text>
              {cols.map((col) => (
                <Text key={col} style={[styles.cell, styles.headerCell]}>
                  {col}
                </Text>
              ))}
            </View>
            {block.rows.map((row, rowIndex) => (
              <View
                key={`${row.label}-${rowIndex}`}
                style={[
                  styles.tableRow,
                  rowIndex < block.rows.length - 1 && styles.rowDivider,
                ]}
              >
                <Text style={[styles.cell, styles.labelCell]}>{row.label}</Text>
                {row.values.map((value, i) => (
                  <Text key={`${row.label}-${i}`} style={styles.cell}>
                    {value}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </GlassSurface>
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
  sideGlass: {
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
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },
  sideRow: {
    gap: 2,
  },
  rowLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowValue: {
    color: TEXT_BODY,
    fontSize: 14,
    lineHeight: 20,
  },
  tableGlass: {
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
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  cell: {
    flex: 1,
    color: TEXT_BODY,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  headerCell: {
    color: TEXT_PRIMARY,
    fontWeight: '700',
    fontSize: 12,
  },
  labelCell: {
    flex: 1.1,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
});
