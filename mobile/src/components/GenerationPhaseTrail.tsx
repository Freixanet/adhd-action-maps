import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import ThinkingOrbWebView from './ThinkingOrbWebView';
import { GENERATION_PHASE_STEPS } from '../logic/generationPhaseTrail';
import { formatCollectionProgress } from '@shared/collections';
import { typography } from '@shared/design-tokens';
import { useThemeColors } from '../context/ThemeContext';

type GenerationPhaseTrailProps = {
  activeIndex: number;
  reduceMotion?: boolean;
  /** When set, show collection part progress instead of the soft phase labels. */
  collectionProgress?: { completed: number; total: number } | null;
};

/**
 * Perplexity-style model step: one label at a time (swap, never stack).
 */
export default function GenerationPhaseTrail({
  activeIndex,
  reduceMotion = false,
  collectionProgress = null,
}: GenerationPhaseTrailProps) {
  const colors = useThemeColors();
  const clamped = Math.max(0, Math.min(GENERATION_PHASE_STEPS.length - 1, activeIndex));
  const step = GENERATION_PHASE_STEPS[clamped]!;
  const label = collectionProgress
    ? `Generando colección… ${formatCollectionProgress(
        collectionProgress.completed,
        collectionProgress.total
      )}`
    : step.label;
  const orb = collectionProgress ? 'composing' : step.orb;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Animated.View
        key={collectionProgress ? `collection-${collectionProgress.completed}` : step.id}
        entering={reduceMotion ? undefined : FadeIn.duration(220)}
        exiting={reduceMotion ? undefined : FadeOut.duration(160)}
        style={styles.row}
      >
        <View style={styles.orbSlot}>
          <ThinkingOrbWebView
            state={orb}
            size={20}
            paused={reduceMotion}
            speed={reduceMotion ? 0 : 1.15}
            theme="dark"
          />
        </View>
        <Text style={[styles.label, { color: colors.text.secondary }]} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingTop: 4,
    minHeight: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 28,
  },
  orbSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    ...typography('callout'),
    opacity: 0.92,
  },
});
