import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import ThinkingOrbWebView from './ThinkingOrbWebView';
import NucleoLoadingBorderBeam from './NucleoLoadingBorderBeam';
import { formatCollectionProgress } from '@shared/collections';
import {
  ANALYZING_SOURCE_LABEL,
  GenerationProgressBar,
  LoadingPhaseLabel,
  LOADING_PHASE_LABELS,
} from './loadingGenerationUi';
import { useAppSession } from '../context/AppSessionContext';
import { useTheme, useThemeColors } from '../context/ThemeContext';
import { useGenerationSoftStage } from '../hooks/useGenerationSoftStage';
import { resolveThinkingOrbState } from '@shared/resolveThinkingOrbState';
import { motion, radius, type } from '@shared/design-tokens';

/**
 * Approximate continuous corner radius of recent iPhone displays so the beam
 * follows the physical screen silhouette (not an inset card).
 */
const SCREEN_CORNER_RADIUS = Platform.OS === 'ios' ? 55 : 24;

type LoadingStateProps = {
  onCancel?: () => void;
};

export default function LoadingState(_props: LoadingStateProps) {
  const session = useAppSession();
  const { isDark } = useTheme();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const softStage = useGenerationSoftStage(
    session.isStreamGenerating || session.isAnalyzingSource
  );
  const thinkingState = resolveThinkingOrbState({
    isAnalyzingSource: session.isAnalyzingSource,
    streamLoadPhase: session.streamLoadPhase,
    softStage,
  });
  const isGenerating = session.isStreamGenerating || session.isAnalyzingSource;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sub as any)?.remove?.();
    };
  }, []);

  const phaseLabel = session.isAnalyzingSource
    ? ANALYZING_SOURCE_LABEL
    : session.collectionGenerationProgress
      ? formatCollectionProgress(
          session.collectionGenerationProgress.completed,
          session.collectionGenerationProgress.total
        )
      : LOADING_PHASE_LABELS[session.streamLoadPhase] ?? LOADING_PHASE_LABELS[0];

  return (
    <View style={styles.host} collapsable={false}>
      <NucleoLoadingBorderBeam
        active={isGenerating}
        borderRadius={SCREEN_CORNER_RADIUS}
        style={{ width, height, overflow: 'visible' }}
      >
        <View
          style={[
            styles.fill,
            {
              width,
              height,
              borderRadius: SCREEN_CORNER_RADIUS,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingLeft: Math.max(insets.left, 28),
              paddingRight: Math.max(insets.right, 28),
              backgroundColor: colors.background.canvas,
            },
          ]}
          collapsable={false}
        >
          <ThinkingOrbWebView
            state={thinkingState}
            size={64}
            paused={reduceMotion}
            speed={reduceMotion ? 0 : 1}
            theme={isDark ? 'dark' : 'light'}
          />
          <View style={styles.labelSlot}>
            <LoadingPhaseLabel text={phaseLabel} reduceMotion={reduceMotion} />
          </View>
          <View style={styles.progressSlot}>
            <GenerationProgressBar
              progressShared={session.streamProgressShared}
              reduceMotion={reduceMotion}
            />
          </View>
        </View>
      </NucleoLoadingBorderBeam>
    </View>
  );
}

type LoadingFadeOverlayProps = {
  onComplete: () => void;
};

export function LoadingFadeOverlay({ onComplete }: LoadingFadeOverlayProps) {
  const opacity = useSharedValue(1);
  const colors = useThemeColors();

  useEffect(() => {
    opacity.value = withTiming(0, { duration: motion.fade.duration }, (finished) => {
      if (finished) runOnJS(onComplete)();
    });
  }, [onComplete, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        animatedStyle,
        styles.overlay,
        { backgroundColor: colors.background.canvas },
      ]}
    >
      <LoadingState />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    overflow: 'visible',
  },
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelSlot: {
    marginTop: 24,
    minHeight: 22,
    justifyContent: 'center',
  },
  progressSlot: {
    marginTop: 16,
  },
  overlay: {
    zIndex: 50,
  },
});
