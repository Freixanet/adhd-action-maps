import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ACCENT, RADII, TEXT_BODY, TEXT_PRIMARY, TEXT_SECONDARY } from '@shared/uiTokens';
import type { StepContentBlockStat } from '@shared/contracts';
import GlassSurface from '../GlassSurface';
import { useTheme } from '../../context/ThemeContext';
import { useGlassAccessibility } from '../../hooks/useGlassAccessibility';
import { useInViewportOnce } from '../../hooks/useInViewportOnce';
import BlockEnter from './BlockEnter';

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
  const { isDark } = useTheme();
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

  useAnimatedReaction(
    () => count.value,
    (value) => {
      if (!parsed.animate) return;
      runOnJS(setDisplay)(
        formatCounted(value, parsed.decimals, parsed.prefix, parsed.suffix)
      );
    },
    [parsed.animate, parsed.decimals, parsed.prefix, parsed.suffix]
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
      duration: 800,
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
          <Text style={styles.compactValue}>{block.value}</Text>
          <Text style={styles.compactLabel}>{block.label}</Text>
          {block.source ? <Text style={styles.source}>{block.source}</Text> : null}
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
                  <Stop offset="0" stopColor={ACCENT} stopOpacity="0.22" />
                  <Stop offset="1" stopColor={ACCENT} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#statAccent)" />
            </Svg>
            <Text
              style={styles.heroValue}
              maxFontSizeMultiplier={1.35}
              accessibilityRole="text"
              accessibilityLabel={`${block.value} ${block.label}`}
            >
              {display}
            </Text>
            <Text style={styles.heroLabel} maxFontSizeMultiplier={1.35}>
              {block.label}
            </Text>
            {block.source ? (
              <Text style={styles.source} maxFontSizeMultiplier={1.3}>
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
    color: TEXT_PRIMARY,
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 50,
  },
  heroLabel: {
    color: TEXT_BODY,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  source: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
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
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  compactLabel: {
    color: TEXT_BODY,
    fontSize: 15,
    lineHeight: 21,
  },
});
