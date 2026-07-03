import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
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
      disabled={isButtonDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (showLoading ? (loadingLabel ?? label) : label)}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !isButtonDisabled ? styles.pressed : null,
        isButtonDisabled ? styles.disabled : null,
      ]}
    >
      <GlassSurface
        liquid
        liquidBorder="none"
        borderRadius={RADII.md}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
    alignSelf: 'stretch',
  },
  shell: {
    width: '100%',
    borderRadius: RADII.md,
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
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
