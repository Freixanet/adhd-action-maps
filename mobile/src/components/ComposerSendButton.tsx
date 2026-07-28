import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pressable } from 'react-native-gesture-handler';
import { ACCENT } from '@shared/uiTokens';
import { ArrowUp } from '../icons';
import GlassSurface from './GlassSurface';
import NativeGlassButton from './NativeGlassButton';
import { usePressScale } from '../hooks/usePressScale';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { shouldUseNativeGlassFilledCta } from '../logic/nativeGlassButtons';
import { useTheme } from '../context/ThemeContext';

const SIZE = 38;
const ICON_SIZE = 17;
const STOP_SIZE = 12;

type ComposerSendButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  /** Send arrow (default) or stop square while a Núcleo is generating. */
  mode?: 'send' | 'stop';
  accessibilityLabel?: string;
};

export default function ComposerSendButton({
  onPress,
  disabled = false,
  mode = 'send',
  accessibilityLabel,
}: ComposerSendButtonProps) {
  const { isDark } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const { reduceTransparency } = useGlassAccessibility();
  const isStop = mode === 'stop';
  const effectivelyDisabled = isStop ? false : disabled;
  const label = accessibilityLabel ?? (isStop ? 'Detener generación' : 'Enviar');

  const iconColor = effectivelyDisabled
    ? isDark
      ? '#737373'
      : '#a3a3a3'
    : isDark
      ? '#e8eaff'
      : '#3730a3';

  const glyph = isStop ? (
    <View style={[styles.stopGlyph, { backgroundColor: iconColor }]} />
  ) : (
    <ArrowUp size={ICON_SIZE} color={iconColor} strokeWidth={2.25} />
  );

  // Enabled send is an accent CTA, so it follows the filled-CTA switch.
  if (!effectivelyDisabled && shouldUseNativeGlassFilledCta(reduceTransparency)) {
    return (
      <NativeGlassButton
        onPress={onPress}
        accessibilityLabel={label}
        variant="prominentGlass"
        tintColor={ACCENT}
        style={styles.shell}
      >
        {glyph}
      </NativeGlassButton>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={effectivelyDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [pressed && !effectivelyDisabled ? styles.pressedOpacity : null]}
    >
      <Animated.View style={animatedStyle}>
        {effectivelyDisabled ? (
          <View
            style={[
              styles.shell,
              isDark ? styles.disabledShellDark : styles.disabledShellLight,
            ]}
          >
            {glyph}
          </View>
        ) : (
          <GlassSurface
            liquid
            interactive
            liquidBorder="perimeter"
            glassInset={1}
            borderRadius={SIZE / 2}
            style={styles.shell}
            tintColor={isDark ? 'rgba(139, 143, 245, 0.62)' : 'rgba(139, 143, 245, 0.54)'}
            overlayClassName={isDark ? 'bg-accent/100/32' : 'bg-accent/28'}
            contentClassName="h-full w-full items-center justify-center"
          >
            {glyph}
          </GlassSurface>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopGlyph: {
    width: STOP_SIZE,
    height: STOP_SIZE,
    borderRadius: 2.5,
  },
  disabledShellLight: {
    backgroundColor: 'rgba(115, 115, 115, 0.08)',
  },
  disabledShellDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  pressedOpacity: {
    opacity: 0.9,
  },
});
