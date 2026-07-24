import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import ThinkingOrbWebView from './ThinkingOrbWebView';
import { formatCollectionProgress } from '@shared/collections';
import {
  ANALYZING_SOURCE_LABEL,
  GenerationProgressBar,
  LoadingPhaseLabel,
  LOADING_PHASE_LABELS,
} from './loadingGenerationUi';
import { useAppSession } from '../context/AppSessionContext';
import { useGenerationSoftStage } from '../hooks/useGenerationSoftStage';
import { resolveThinkingOrbState } from '@shared/resolveThinkingOrbState';

type LoadingStateProps = {
  onCancel?: () => void;
};

export default function LoadingState(_props: LoadingStateProps) {
  const session = useAppSession();
  const [reduceMotion, setReduceMotion] = useState(false);
  const softStage = useGenerationSoftStage(
    session.isStreamGenerating || session.isAnalyzingSource
  );
  const thinkingState = resolveThinkingOrbState({
    isAnalyzingSource: session.isAnalyzingSource,
    streamLoadPhase: session.streamLoadPhase,
    softStage,
  });

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
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
    <View className="flex-1 items-center justify-center px-6 bg-base">
      <ThinkingOrbWebView
        state={thinkingState}
        size={64}
        paused={reduceMotion}
        speed={reduceMotion ? 0 : 1}
        theme="dark"
      />
      <View className="mt-6 min-h-[22px] justify-center">
        <LoadingPhaseLabel text={phaseLabel} reduceMotion={reduceMotion} />
      </View>
      <View className="mt-4">
        <GenerationProgressBar progressShared={session.streamProgressShared} reduceMotion={reduceMotion} />
      </View>
    </View>
  );
}

type LoadingFadeOverlayProps = {
  onComplete: () => void;
};

export function LoadingFadeOverlay({ onComplete }: LoadingFadeOverlayProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) runOnJS(onComplete)();
    });
  }, [onComplete, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, animatedStyle]}
      className="z-50 bg-base"
    >
      <LoadingState />
    </Animated.View>
  );
}
