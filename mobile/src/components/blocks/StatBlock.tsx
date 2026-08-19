import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { RADII } from '@shared/uiTokens';
import type { StepContentBlockStat } from '@shared/contracts';
import GlassSurface from '../GlassSurface';
import { useTheme } from '../../context/ThemeContext';
import { useGlassAccessibility } from '../../hooks/useGlassAccessibility';
import { useInViewportOnce } from '../../hooks/useInViewportOnce';
import BlockEnter from './BlockEnter';
import { motion, typography } from '@shared/design-tokens';

function parseStatValue(raw: string): {
  prefix: string;
  number: number;
  suffix: string;
  decimals: number;
  animate: boolean;
} {
  const match = raw.match(/^([^\d\-+]*)([-+]?\d+(?:[.,]\d+)?)(.*)$/);
  if (!match) {
    return { prefix: '', number: 0, suffix: raw, decimals: 0, animate: false };
  }
  const numRaw = match[2]!.replace(',', '.');
  const decimals = numRaw.includes('.') ? (numRaw.split('.')[1]?.length ?? 0) : 0;
  return {
    prefix: match[1] ?? '',
    number: Number(numRaw),
    suffix: match[3] ?? '',
    decimals,
    animate: Number.isFinite(Number(numRaw)),
  };
}

function formatCounted(n: number, decimals: number, prefix: string, suffix: string): string {
  const formatted =
    decimals > 0
      ? n.toFixed(decimals)
      : String(Math.round(n));
  return `${prefix}${formatted}${suffix}`;
}

type Props = {
  block: StepContentBlockStat;
  index?: number;
};

export default function StatBlock({ block, index = 0 }: Props) {
  const { isDark, colors } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const { visible, onLayout } = useInViewportOnce();
  const emphasis = block.emphasis ?? 'normal';
  const isHero = emphasis === 'hero';
  const parsed = parseStatValue(block.value);
  const count = useSharedValue(parsed.animate && !reduceMotion ? 0 : parsed.number);
  const [display, setDisplay] = useState(
    parsed.animate
      ? formatCounted(
          reduceMotion ? parsed.number : 0,
          parsed.decimals,
          parsed.prefix,
          parsed.suffix
        )
      : block.value
  );

  // formatCounted must run on the JS thread — never as a runOnJS() argument (UI eval).
  const syncDisplay = useCallback(
    (value: number) => {
      setDisplay(formatCounted(value, parsed.decimals, parsed.prefix, parsed.suffix));
    },
    [parsed.decimals, parsed.prefix, parsed.suffix]
  );

  useAnimatedReaction(
    () => count.value,
    (value) => {
      if (!parsed.animate) return;
      runOnJS(syncDisplay)(value);
    },
    [parsed.animate, syncDisplay]
  );

  useEffect(() => {
    if (!visible || !isHero) return;
    if (!parsed.animate || reduceMotion) {
      setDisplay(block.value);
      count.value = parsed.number;
      return;
    }
    count.value = 0;
    count.value = withTiming(parsed.number, {
      duration: motion.page.duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [block.value, count, isHero, parsed.animate, parsed.number, reduceMotion, visible]);

  if (!isHero) {
    return (
      <BlockEnter delayMs={index * 60}>
        <View
          style={[styles.compact, emphasis === 'quiet' && styles.quiet]}
          accessibilityRole="text"
          accessibilityLabel={`${block.value} ${block.label}`}
        >
          <Text style={[styles.compactValue, { color: colors.text.primary }]}>{block.value}</Text>
          <Text style={[styles.compactLabel, { color: colors.text.body }]}>{block.label}</Text>
          {block.source ? <Text style={[styles.source, { color: colors.text.secondary }]}>{block.source}</Text> : null}
        </View>
      </BlockEnter>
    );
  }

  return (
    <BlockEnter delayMs={index * 60}>
      <View onLayout={onLayout} style={styles.heroShell}>
        <GlassSurface
          liquid
          borderRadius={RADII.md}
          className="rounded-2xl overflow-hidden"
          style={styles.glass}
          overlayClassName={isDark ? 'bg-white/[0.05]' : 'bg-white/45'}
        >
          <View style={styles.heroInner}>
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <LinearGradient id="statAccent" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={colors.action.primary} stopOpacity="0.22" />
                  <Stop offset="1" stopColor={colors.action.primary} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#statAccent)" />
            </Svg>
            <Text
              style={[styles.heroValue, { color: colors.text.primary }]}
              maxFontSizeMultiplier={1.35}
              accessibilityRole="text"
              accessibilityLabel={`${block.value} ${block.label}`}
            >
              {display}
            </Text>
            <Text style={[styles.heroLabel, { color: colors.text.body }]} maxFontSizeMultiplier={1.35}>
              {block.label}
            </Text>
            {block.source ? (
              <Text style={[styles.source, { color: colors.text.secondary }]} maxFontSizeMultiplier={1.3}>
                {block.source}
              </Text>
            ) : null}
          </View>
        </GlassSurface>
      </View>
    </BlockEnter>
  );
}

const styles = StyleSheet.create({
  heroShell: {
    marginVertical: 12,
  },
  glass: {
    borderRadius: RADII.md,
    overflow: 'hidden',
  },
  heroInner: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 8,
    minHeight: 120,
    justifyContent: 'center',
  },
  heroValue: {
    ...typography('display'),
  },
  heroLabel: {
    ...typography('title'),
  },
  source: {
    ...typography('caption'),
    marginTop: 2,
  },
  compact: {
    marginVertical: 10,
    gap: 2,
  },
  quiet: {
    opacity: 0.85,
  },
  compactValue: {
    ...typography('pageTitleTight'),
  },
  compactLabel: {
    ...typography('body'),
  },
});
