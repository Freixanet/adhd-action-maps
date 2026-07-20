import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import { usePressScale } from '../hooks/usePressScale';
import { useTheme } from '../context/ThemeContext';

type CompletionGlassButtonProps = {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  variant?: 'neutral' | 'accent';
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

export default function CompletionGlassButton({
  label,
  onPress,
  icon,
  variant = 'neutral',
  accessibilityLabel,
  disabled = false,
  loading = false,
  loadingLabel,
}: CompletionGlassButtonProps) {
  const { isDark } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const isAccent = variant === 'accent';

  const accentTint = isDark ? 'rgba(139, 143, 245, 0.52)' : 'rgba(139, 143, 245, 0.46)';
  const accentOverlay = isDark ? 'bg-accent/100/32' : 'bg-accent/28';
  const neutralOverlay = isDark ? 'bg-white/[0.05]' : 'bg-white/45';

  const showLoading = loading;
  const isButtonDisabled = disabled || loading;

  const spinnerColor = isAccent
    ? '#ffffff'
    : isDark
      ? '#d4d4d4'
      : '#525252';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isButtonDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (showLoading ? (loadingLabel ?? label) : label)}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !isButtonDisabled ? styles.pressedOpacity : null,
        isButtonDisabled ? styles.disabled : null,
      ]}
    >
      <Animated.View style={[styles.pressableInner, animatedStyle]}>
      <GlassSurface
        liquid
        liquidBorder="none"
        borderRadius={RADII.lg}
        style={styles.shell}
        tintColor={isAccent ? accentTint : undefined}
        overlayClassName={isAccent ? accentOverlay : neutralOverlay}
        contentClassName="w-full items-center justify-center"
      >
        <View style={styles.content}>
          {showLoading ? (
            <ActivityIndicator size="small" color={spinnerColor} />
          ) : (
            icon
          )}
          <Text
            className={
              isAccent
                ? 'text-center font-semibold text-white'
                : 'text-center font-semibold text-body'
            }
          >
            {showLoading ? (loadingLabel ?? label) : label}
          </Text>
        </View>
      </GlassSurface>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
    alignSelf: 'stretch',
  },
  pressableInner: {
    width: '100%',
  },
  shell: {
    width: '100%',
    borderRadius: RADII.lg,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 52,
  },
  pressedOpacity: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
});
