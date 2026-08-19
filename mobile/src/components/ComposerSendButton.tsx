import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pressable } from 'react-native-gesture-handler';
import { ArrowUp } from '../icons';
import { usePressScale } from '../hooks/usePressScale';
import { useTheme } from '../context/ThemeContext';
import { control, radius } from '@shared/design-tokens';
import { COMPOSER_CONTROL_SIZE } from '../logic/composerText';

const STOP_SIZE = 12;

type ComposerSendButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  /** Send arrow (default) or stop square while a Núcleo is generating. */
  mode?: 'send' | 'stop';
  accessibilityLabel?: string;
};

/**
 * Solid send disc on the composer glass. No nested Liquid Glass.
 */
export default function ComposerSendButton({
  onPress,
  disabled = false,
  mode = 'send',
  accessibilityLabel,
}: ComposerSendButtonProps) {
  const { isDark, colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const isStop = mode === 'stop';
  const effectivelyDisabled = isStop ? false : disabled;
  const label = accessibilityLabel ?? (isStop ? 'Detener generación' : 'Enviar');

  const fill = effectivelyDisabled
    ? isDark
      ? colors.background.whiteFade06
      : colors.background.mutedFade08
    : colors.action.primary;

  const iconColor = effectivelyDisabled
    ? colors.text.muted
    : colors.text.onAccent;

  const glyph = isStop ? (
    <View style={[styles.stopGlyph, { backgroundColor: iconColor }]} />
  ) : (
    <ArrowUp size={control.iconSm} color={iconColor} strokeWidth={2.25} />
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={effectivelyDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: effectivelyDisabled }}
    >
      <Animated.View style={animatedStyle}>
        <View style={[styles.shell, { backgroundColor: fill }]}>{glyph}</View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: COMPOSER_CONTROL_SIZE,
    height: COMPOSER_CONTROL_SIZE,
    borderRadius: COMPOSER_CONTROL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopGlyph: {
    width: STOP_SIZE,
    height: STOP_SIZE,
    borderRadius: radius.hairlineMd,
  },
});
