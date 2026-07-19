import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import ResultScreen from '../screens/ResultScreen';
import { ContinueTransitionPreviewProvider } from '../context/ContinueTransitionPreviewContext';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import {
  clampContinueProgress,
  CONTINUE_EXPAND_SPRING,
  CONTINUE_MASK_BORDER_RADIUS,
  CONTINUE_MASK_RADIUS_ZERO_START,
  CONTINUE_REDUCED_MOTION_MS,
  type ContinueTransitionSnapshot,
} from '../logic/continueTransition';
import { debugTransitionLog } from '../logic/debugTransitionLog';

type ContinueExpandTransitionProps = {
  transition: ContinueTransitionSnapshot;
  onExpandComplete: () => void;
  onCollapseComplete: () => void;
};

function maskRadiusForProgress(progress: number): number {
  'worklet';
  const p = clampContinueProgress(progress);
  if (p >= CONTINUE_MASK_RADIUS_ZERO_START) {
    return interpolate(
      p,
      [CONTINUE_MASK_RADIUS_ZERO_START, 1],
      [CONTINUE_MASK_BORDER_RADIUS, 0],
      Extrapolation.CLAMP
    );
  }
  return CONTINUE_MASK_BORDER_RADIUS;
}

export default function ContinueExpandTransition({
  transition,
  onExpandComplete,
  onCollapseComplete,
}: ContinueExpandTransitionProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useGlassAccessibility();
  const { chipRect, mode } = transition;

  const progress = useSharedValue(mode === 'collapse' ? 1 : 0);
  const reducedOpacity = useSharedValue(mode === 'collapse' ? 1 : 0);
  const overshootLogged = useSharedValue(false);
  const animationGenerationRef = useRef(0);

  const logSpringOvershoot = useCallback(
    (rawProgress: number, maskTop: number, maskHeight: number) => {
      debugTransitionLog('H11', 'ContinueExpandTransition.tsx:overshoot', 'spring overshoot detected', {
        rawProgress,
        maskTop,
        maskHeight,
        screenH,
      });
    },
    [screenH]
  );

  useAnimatedReaction(
    () => progress.value,
    (rawProgress) => {
      if (overshootLogged.value) return;
      const unclampedTop = chipRect.y * (1 - rawProgress);
      const unclampedHeight = chipRect.height + (screenH - chipRect.height) * rawProgress;
      if (
        rawProgress > 1.001 ||
        rawProgress < -0.001 ||
        unclampedTop < -0.5 ||
        unclampedHeight > screenH + 0.5
      ) {
        overshootLogged.value = true;
        runOnJS(logSpringOvershoot)(rawProgress, unclampedTop, unclampedHeight);
      }
    },
    [chipRect.height, chipRect.y, logSpringOvershoot, screenH]
  );

  useEffect(() => {
    const generation = ++animationGenerationRef.current;

    // #region agent log
    debugTransitionLog('H1', 'ContinueExpandTransition.tsx:mount', 'overlay mount metrics', {
      mode,
      screenW,
      screenH,
      insetTop: insets.top,
      stableInsetTop: initialWindowMetrics?.insets.top ?? null,
      chipX: chipRect.x,
      chipY: chipRect.y,
      chipW: chipRect.width,
      chipH: chipRect.height,
      generation,
    });
    // #endregion

    if (mode === 'collapse') {
      if (reduceMotion) {
        reducedOpacity.value = withTiming(0, { duration: CONTINUE_REDUCED_MOTION_MS }, (finished) => {
          if (finished && animationGenerationRef.current === generation) {
            runOnJS(onCollapseComplete)();
          }
        });
        return;
      }

      progress.value = withSpring(0, CONTINUE_EXPAND_SPRING, (finished) => {
        if (finished && animationGenerationRef.current === generation) {
          progress.value = 0;
          runOnJS(onCollapseComplete)();
        }
      });
      return;
    }

    if (reduceMotion) {
      reducedOpacity.value = withTiming(1, { duration: CONTINUE_REDUCED_MOTION_MS }, (finished) => {
        if (finished && animationGenerationRef.current === generation) {
          runOnJS(onExpandComplete)();
        }
      });
      return;
    }

    progress.value = withSpring(1, CONTINUE_EXPAND_SPRING, (finished) => {
      if (finished && animationGenerationRef.current === generation) {
        progress.value = 1;
        // #region agent log
        runOnJS(debugTransitionLog)(
          'H3',
          'ContinueExpandTransition.tsx:expandDone',
          'expand spring finished',
          {
            insetTop: insets.top,
            stableInsetTop: initialWindowMetrics?.insets.top ?? null,
            screenW,
            screenH,
            generation,
          },
          'post-fix-v6'
        );
        // #endregion
        runOnJS(onExpandComplete)();
      }
    });
  }, [
    chipRect.height,
    chipRect.width,
    chipRect.x,
    chipRect.y,
    mode,
    onCollapseComplete,
    onExpandComplete,
    progress,
    reduceMotion,
    reducedOpacity,
    screenH,
    screenW,
  ]);

  const maskStyle = useAnimatedStyle(() => {
    const p = clampContinueProgress(progress.value);
    const left = chipRect.x * (1 - p);
    const top = chipRect.y * (1 - p);
    const width = chipRect.width + (screenW - chipRect.width) * p;
    const height = chipRect.height + (screenH - chipRect.height) * p;

    return {
      position: 'absolute',
      left,
      top,
      width,
      height,
      borderRadius: maskRadiusForProgress(p),
      overflow: 'hidden',
    };
  }, [chipRect.height, chipRect.width, chipRect.x, chipRect.y, screenH, screenW]);

  const maskedContentStyle = useAnimatedStyle(() => {
    const p = clampContinueProgress(progress.value);
    const left = chipRect.x * (1 - p);
    const top = chipRect.y * (1 - p);

    return {
      width: screenW,
      height: screenH,
      transform: [{ translateX: -left }, { translateY: -top }],
    };
  }, [chipRect.x, chipRect.y, screenH, screenW]);

  const reducedFadeStyle = useAnimatedStyle(() => ({
    opacity: reducedOpacity.value,
  }));

  const resultPreview = (
    <ContinueTransitionPreviewProvider active>
      <ResultScreen previewMode suppressStepTransitions />
    </ContinueTransitionPreviewProvider>
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <Animated.View style={styles.root} pointerEvents="box-none">
        {reduceMotion ? (
          <Animated.View style={[StyleSheet.absoluteFill, reducedFadeStyle]}>
            {resultPreview}
          </Animated.View>
        ) : (
          <Animated.View style={maskStyle} pointerEvents="none">
            <Animated.View style={maskedContentStyle}>{resultPreview}</Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
