import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  RADII,
  SEM_ALERTA,
  SEM_EJEMPLO,
  TEXT_BODY,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@shared/uiTokens';
import type { StepContentBlockQuiz } from '@shared/contracts';
import GlassSurface from '../GlassSurface';
import { useTheme } from '../../context/ThemeContext';
import { useGlassAccessibility } from '../../hooks/useGlassAccessibility';
import BlockEnter from './BlockEnter';

type Props = {
  block: StepContentBlockQuiz;
  index?: number;
};

type OptionState = 'idle' | 'correct' | 'wrong' | 'missed';

function QuizOptionRow({
  label,
  disabled,
  state,
  onPress,
  reduceMotion,
}: {
  label: string;
  disabled: boolean;
  state: OptionState;
  onPress: () => void;
  reduceMotion: boolean;
}) {
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (state !== 'wrong' || reduceMotion) return;
    shake.value = withSequence(
      withTiming(-6, { duration: 40 }),
      withTiming(6, { duration: 50 }),
      withTiming(-4, { duration: 45 }),
      withTiming(0, { duration: 40 })
    );
  }, [reduceMotion, shake, state]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: scale.value }],
  }));

  const borderColor =
    state === 'correct'
      ? SEM_EJEMPLO
      : state === 'wrong'
        ? SEM_ALERTA
        : 'rgba(255,255,255,0.12)';
  const backgroundColor =
    state === 'correct'
      ? 'rgba(111,191,143,0.16)'
      : state === 'wrong'
        ? 'rgba(224,122,107,0.14)'
        : 'rgba(255,255,255,0.04)';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          if (!disabled && !reduceMotion) {
            scale.value = withSpring(0.97, { damping: 26, stiffness: 600 });
          }
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 20, stiffness: 400 });
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[styles.option, { borderColor, backgroundColor }]}
      >
        <Text
          style={[
            styles.optionText,
            state === 'missed' && styles.optionMissed,
          ]}
          maxFontSizeMultiplier={1.35}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function QuizBlock({ block, index = 0 }: Props) {
  const { isDark } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const [selected, setSelected] = useState<number | null>(null);
  const feedbackProgress = useSharedValue(0);

  const answered = selected !== null;
  const isCorrect = answered && selected === block.correct;

  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackProgress.value,
    transform: [{ translateY: (1 - feedbackProgress.value) * 8 }],
  }));

  const choose = (optionIndex: number) => {
    if (answered) return;
    setSelected(optionIndex);
    const ok = optionIndex === block.correct;
    if (ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    feedbackProgress.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  };

  return (
    <BlockEnter delayMs={index * 60}>
      <View style={styles.wrap} accessibilityRole="summary">
        <Text style={styles.question} maxFontSizeMultiplier={1.35}>
          {block.question}
        </Text>
        <View style={styles.options}>
          {block.options.map((option, optionIndex) => {
            let state: OptionState = 'idle';
            if (answered) {
              if (optionIndex === block.correct) state = 'correct';
              else if (optionIndex === selected) state = 'wrong';
              else state = 'missed';
            }
            return (
              <QuizOptionRow
                key={`${option}-${optionIndex}`}
                label={option}
                disabled={answered}
                state={state}
                reduceMotion={reduceMotion}
                onPress={() => choose(optionIndex)}
              />
            );
          })}
        </View>
        {answered ? (
          <Animated.View style={feedbackStyle}>
            <GlassSurface
              liquid
              borderRadius={RADII.sm}
              className="rounded-xl overflow-hidden"
              style={styles.feedbackGlass}
              overlayClassName={isDark ? 'bg-white/[0.05]' : 'bg-white/45'}
            >
              <View style={styles.feedbackInner}>
                <Text
                  style={[
                    styles.feedbackKicker,
                    { color: isCorrect ? SEM_EJEMPLO : SEM_ALERTA },
                  ]}
                >
                  {isCorrect ? 'Acertado' : 'Casi'}
                </Text>
                <Text style={styles.feedbackText} maxFontSizeMultiplier={1.35}>
                  {block.feedback}
                </Text>
              </View>
            </GlassSurface>
          </Animated.View>
        ) : null}
      </View>
    </BlockEnter>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 12,
    gap: 12,
  },
  question: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  options: {
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderRadius: RADII.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    color: TEXT_BODY,
    fontSize: 15,
    lineHeight: 21,
  },
  optionMissed: {
    color: TEXT_SECONDARY,
  },
  feedbackGlass: {
    borderRadius: RADII.sm,
    overflow: 'hidden',
    marginTop: 4,
  },
  feedbackInner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  feedbackKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  feedbackText: {
    color: TEXT_BODY,
    fontSize: 15,
    lineHeight: 21,
  },
});
