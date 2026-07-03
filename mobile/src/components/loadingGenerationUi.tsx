import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ACCENT } from '@shared/uiTokens';

type GenerationProgressBarProps = {
  progress: number;
  width?: number;
  fullWidth?: boolean;
  height?: number;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GenerationProgressBar({
  progress,
  width = 200,
  fullWidth = false,
  height = 4,
  reduceMotion = false,
  style,
}: GenerationProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const fillWidth = useSharedValue(fullWidth ? clamped : (width * clamped) / 100);

  useEffect(() => {
    if (fullWidth) {
      fillWidth.value = reduceMotion ? clamped : withTiming(clamped, { duration: 280 });
      return;
    }
    const target = (width * clamped) / 100;
    fillWidth.value = reduceMotion ? target : withTiming(target, { duration: 280 });
  }, [clamped, fillWidth, fullWidth, reduceMotion, width]);

  const fillStyle = useAnimatedStyle(() =>
    fullWidth
      ? { width: `${fillWidth.value}%` }
      : { width: fillWidth.value }
  );

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
