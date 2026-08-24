import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { hapticSuccess, hapticWarning } from '../../logic/haptics';
import { RADII } from '@shared/uiTokens';
import type { StepContentBlockQuiz } from '@shared/contracts';
import GlassSurface from '../GlassSurface';
import { useTheme, useThemeColors } from '../../context/ThemeContext';
import { useGlassAccessibility } from '../../hooks/useGlassAccessibility';
import BlockEnter from './BlockEnter';
import { contentEnterStagger } from '../../motion/contentEnter';
import { motion, typography } from '@shared/design-tokens';

type Props = {
  block: StepContentBlockQuiz;
  index?: number;
  questionStyle?: StyleProp<TextStyle>;
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
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (state !== 'wrong' || reduceMotion) return;
    shake.value = withSequence(
      withTiming(-6, { duration: motion.feedback.duration }),
      withTiming(6, { duration: motion.feedback.duration }),
      withTiming(-4, { duration: motion.feedback.duration }),
      withTiming(0, { duration: motion.feedback.duration })
    );
  }, [reduceMotion, shake, state]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: scale.value }],
  }));

  const borderColor =
    state === 'correct'
      ? colors.text.success
      : state === 'wrong'
        ? colors.text.danger
        : colors.border.default;
  const backgroundColor =
    state === 'correct'
      ? colors.background.successFade16
      : state === 'wrong'
        ? colors.background.dangerFade14
        : colors.background.whiteFade04;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          if (!disabled && !reduceMotion) {
            scale.value = withTiming(motion.press.scale, {
              duration: motion.press.duration,
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            });
          }
        }}
        onPressOut={() => {
          scale.value = withTiming(1, {
            duration: motion.press.duration,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          });
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[styles.option, { borderColor, backgroundColor }]}
      >
        <Text
          style={[
            styles.optionText,
            { color: state === 'missed' ? colors.text.secondary : colors.text.body },
          ]}
          maxFontSizeMultiplier={1.35}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function QuizBlock({ block, index = 0, questionStyle }: Props) {
  const { isDark, colors } = useTheme();
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
      hapticSuccess();
    } else {
      hapticWarning();
    }
    feedbackProgress.value = reduceMotion
      ? 1
      : withTiming(1, { duration: motion.quizSettle.duration, easing: Easing.out(Easing.cubic) });
  };

  return (
    <BlockEnter delayMs={contentEnterStagger(index)}>
      <View style={styles.wrap} accessibilityRole="summary">
        <Text style={[styles.question, questionStyle, { color: colors.text.primary }]} maxFontSizeMultiplier={1.35}>
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
                    { color: isCorrect ? colors.text.success : colors.text.danger },
                  ]}
                >
                  {isCorrect ? 'Acertado' : 'Casi'}
                </Text>
                <Text style={[styles.feedbackText, { color: colors.text.body }]} maxFontSizeMultiplier={1.35}>
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
    ...typography('inputStrong'),
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
    ...typography('body'),
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
    ...typography('metaBold'),
    textTransform: 'uppercase',
  },
  feedbackText: {
    ...typography('body'),
  },
});
