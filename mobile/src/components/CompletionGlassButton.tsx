import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import NativeGlassButton from './NativeGlassButton';
import { usePressScale } from '../hooks/usePressScale';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { shouldUseNativeGlassButton } from '../logic/nativeGlassButtons';
import { useTheme } from '../context/ThemeContext';
import { type } from '@shared/design-tokens';

type CompletionGlassButtonProps = {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  /** `accent` = the single primary CTA on that surface (prominentGlass). */
  variant?: 'neutral' | 'accent';
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  /** SF Symbol drawn inside UIButton when native. */
  systemImage?: string;
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
  systemImage,
}: CompletionGlassButtonProps) {
  const { isDark, colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const { reduceTransparency } = useGlassAccessibility();
  const isAccent = variant === 'accent';

  const neutralOverlay = isDark ? 'bg-white/[0.05]' : 'bg-white/45';

  const showLoading = loading;
  const isButtonDisabled = disabled || loading;

  const spinnerColor = isAccent
    ? colors.text.onAccent
    : colors.icon.muted;

  const labelNode = (
    <Text
      className={
        isAccent
          ? 'text-center font-semibold text-white'
          : 'text-center font-semibold text-body'
      }
    >
      {showLoading ? (loadingLabel ?? label) : label}
    </Text>
  );

  const content = (
    <View style={styles.content}>
      {showLoading ? <ActivityIndicator size="small" color={spinnerColor} /> : icon}
      {labelNode}
    </View>
  );

  const resolvedLabel = accessibilityLabel ?? (showLoading ? (loadingLabel ?? label) : label);
  const native = shouldUseNativeGlassButton(reduceTransparency);
  const displayLabel = showLoading ? (loadingLabel ?? label) : label;
  // Light-mode prominentGlass washes out on pale surfaces — keep the CTA solid.
  const useNativeChrome = native && !(isAccent && !isDark);

  if (useNativeChrome) {
    return (
      <NativeGlassButton
        onPress={onPress}
        accessibilityLabel={resolvedLabel}
        variant={isAccent ? 'prominentGlass' : 'glass'}
        title={displayLabel}
        systemImage={showLoading ? undefined : systemImage}
        cornerRadius={RADII.lg}
        disabled={isButtonDisabled}
        loading={showLoading}
        style={styles.nativeShell}
      />
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isButtonDisabled}
      accessibilityRole="button"
      accessibilityLabel={resolvedLabel}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !isButtonDisabled ? styles.pressedOpacity : null,
        isButtonDisabled ? styles.disabled : null,
      ]}
    >
      <Animated.View style={[styles.pressableInner, animatedStyle]}>
        {isAccent ? (
          <View style={[styles.accentShell, { backgroundColor: colors.action.cta }]}>{content}</View>
        ) : (
          <GlassSurface
            liquid
            liquidBorder="none"
            borderRadius={RADII.lg}
            style={styles.shell}
            overlayClassName={neutralOverlay}
            contentClassName="w-full items-center justify-center"
          >
            {content}
          </GlassSurface>
        )}
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
  nativeShell: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 52,
  },
  accentShell: {
    width: '100%',
    borderRadius: RADII.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
