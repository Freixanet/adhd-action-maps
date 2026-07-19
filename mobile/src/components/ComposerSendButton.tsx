import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pressable } from 'react-native-gesture-handler';
import { ArrowUp } from 'lucide-react-native';
import GlassSurface from './GlassSurface';
import { usePressScale } from '../hooks/usePressScale';
import { useTheme } from '../context/ThemeContext';

const SIZE = 38;
const ICON_SIZE = 17;

type ComposerSendButtonProps = {
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel?: string;
};

export default function ComposerSendButton({
  onPress,
  disabled,
  accessibilityLabel = 'Enviar',
}: ComposerSendButtonProps) {
  const { isDark } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  const iconColor = disabled
    ? isDark
      ? '#737373'
      : '#a3a3a3'
    : isDark
      ? '#e8eaff'
      : '#3730a3';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed && !disabled ? styles.pressedOpacity : null]}
    >
      <Animated.View style={animatedStyle}>
      {disabled ? (
        <View
          style={[
            styles.shell,
            isDark ? styles.disabledShellDark : styles.disabledShellLight,
          ]}
        >
          <ArrowUp size={ICON_SIZE} color={iconColor} strokeWidth={2.25} />
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
          <ArrowUp size={ICON_SIZE} color={iconColor} strokeWidth={2.25} />
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
