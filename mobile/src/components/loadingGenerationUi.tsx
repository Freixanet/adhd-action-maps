import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ACCENT } from '@shared/uiTokens';

function clampRatio(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

function progressFillStyle(ratio: number) {
  'worklet';
  return {
    width: '100%' as const,
    transform: [{ scaleX: clampRatio(ratio) }],
    transformOrigin: 'left center' as const,
  };
}

type GenerationProgressBarProps = {
  /** 0–100; ignored when progressShared is set. */
  progress?: number;
  /** 0–100 on the UI thread (stream generation). */
  progressShared?: SharedValue<number>;
  width?: number;
  fullWidth?: boolean;
  height?: number;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GenerationProgressBar({
  progress = 0,
  progressShared,
  width = 200,
  fullWidth = false,
  height = 4,
  reduceMotion = false,
  style,
}: GenerationProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const fillRatio = useSharedValue(clamped / 100);

  useEffect(() => {
    if (progressShared) return;
    const target = clamped / 100;
    fillRatio.value = reduceMotion
      ? target
      : withTiming(target, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [clamped, fillRatio, progressShared, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => {
    const ratio = progressShared
      ? clampRatio(progressShared.value / 100)
      : fillRatio.value;
    return progressFillStyle(ratio);
  });

  return (
    <View
      style={[
        styles.track,
        fullWidth ? styles.trackFullWidth : null,
        {
          width: fullWidth ? undefined : width,
          height,
          borderRadius: height / 2,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: ACCENT,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#2C2E37',
    overflow: 'hidden',
  },
  trackFullWidth: {
    width: '100%',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

export const LOADING_PHASE_LABELS = [
  'Leyendo la fuente…',
  'Destilando la idea central…',
  'Construyendo tu Núcleo…',
] as const;

type PhaseLabelProps = {
  text: string;
  reduceMotion: boolean;
};

export function LoadingPhaseLabel({ text, reduceMotion }: PhaseLabelProps) {
  const duration = reduceMotion ? 0 : 200;

  return (
    <Animated.Text
      key={text}
      entering={duration ? FadeIn.duration(duration) : undefined}
      exiting={duration ? FadeOut.duration(duration) : undefined}
      className="text-[15px] text-center text-body"
    >
      {text}
    </Animated.Text>
  );
}
