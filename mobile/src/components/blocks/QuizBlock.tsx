import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { hapticSuccess, hapticWarning } from '../../logic/haptics';
import { RADII } from '@shared/uiTokens';
import type { StepContentBlockQuiz } from '@shared/contracts';
import ElevatedSurface from '../ElevatedSurface';
import { Check, X } from '../../icons';
import { useCalmPress } from '../../hooks/useCalmPress';
import { useTheme, useThemeColors } from '../../context/ThemeContext';
import { useGlassAccessibility } from '../../hooks/useGlassAccessibility';
import BlockEnter from './BlockEnter';
import { contentEnterStagger } from '../../motion/contentEnter';
import { control, motion, typography } from '@shared/design-tokens';

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
}: {
  label: string;
  disabled: boolean;
  state: OptionState;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const { style: pressStyle, handlers } = useCalmPress();

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
  const glyphColor = state === 'correct' ? colors.text.success : colors.text.danger;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlers.onPressIn}
      onPressOut={handlers.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Animated.View style={pressStyle}>
        <View style={[styles.option, { borderColor, backgroundColor }]}>
          {state === 'correct' ? <Check size={control.iconSm} color={glyphColor} /> : null}
          {state === 'wrong' ? <X size={control.iconSm} color={glyphColor} /> : null}
          <Text
            style={[
              styles.optionText,
              { color: state === 'missed' ? colors.text.secondary : colors.text.body },
            ]}
            maxFontSizeMultiplier={1.35}
          >
            {label}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function QuizBlock({ block, index = 0, questionStyle }: Props) {
  const { colors } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const [selected, setSelected] = useState<number | null>(null);
  const feedbackProgress = useSharedValue(0);

  const answered = selected !== null;
  const isCorrect = answered && selected === block.correct;

  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackProgress.value,
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
      : withTiming(1, { duration: motion.feedback.duration, easing: Easing.out(Easing.cubic) });
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
                onPress={() => choose(optionIndex)}
              />
            );
          })}
        </View>
        {answered ? (
          <Animated.View style={feedbackStyle}>
            <ElevatedSurface borderRadius={RADII.sm} style={styles.feedbackSurface}>
              <View style={styles.feedbackInner}>
                <View style={styles.feedbackKickerRow}>
                  {isCorrect ? (
                    <Check size={control.iconSm} color={colors.text.success} />
                  ) : (
                    <X size={control.iconSm} color={colors.text.danger} />
                  )}
                  <Text
                    style={[
                      styles.feedbackKicker,
                      { color: isCorrect ? colors.text.success : colors.text.danger },
                    ]}
                  >
                    {isCorrect ? 'Acertado' : 'Casi'}
                  </Text>
                </View>
                <Text style={[styles.feedbackText, { color: colors.text.body }]} maxFontSizeMultiplier={1.35}>
                  {block.feedback}
                </Text>
              </View>
            </ElevatedSurface>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionText: {
    ...typography('body'),
    flex: 1,
  },
  feedbackSurface: {
    borderRadius: RADII.sm,
    overflow: 'hidden',
    marginTop: 4,
  },
  feedbackInner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  feedbackKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackKicker: {
    ...typography('metaBold'),
    textTransform: 'uppercase',
  },
  feedbackText: {
    ...typography('body'),
  },
});
