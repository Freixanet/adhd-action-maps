import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CTA_FILL, RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import NativeGlassButton from './NativeGlassButton';
import { usePressScale } from '../hooks/usePressScale';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import {
  shouldUseNativeGlassButton,
  shouldUseNativeGlassFilledCta,
} from '../logic/nativeGlassButtons';
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
  const { reduceTransparency } = useGlassAccessibility();
  const isAccent = variant === 'accent';

  const neutralOverlay = isDark ? 'bg-white/[0.05]' : 'bg-white/45';

  const showLoading = loading;
  const isButtonDisabled = disabled || loading;

  const spinnerColor = isAccent
    ? '#ffffff'
    : isDark
      ? '#d4d4d4'
      : '#525252';

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
  const native = isAccent
    ? shouldUseNativeGlassFilledCta(reduceTransparency)
    : shouldUseNativeGlassButton(reduceTransparency);

  if (native) {
    return (
      <NativeGlassButton
        onPress={onPress}
        accessibilityLabel={resolvedLabel}
        variant={isAccent ? 'prominentGlass' : 'glass'}
        cornerRadius={RADII.lg}
        tintColor={isAccent ? CTA_FILL : undefined}
        disabled={isButtonDisabled}
        style={styles.nativeShell}
      >
        {content}
      </NativeGlassButton>
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
          // Solid fill — liquid glass + deferred mount sometimes left this CTA with no background.
          <View style={styles.accentShell}>{content}</View>
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
  /** Native button sizes itself, so mirror the JS content minHeight. */
  nativeShell: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 52,
  },
  accentShell: {
    width: '100%',
    borderRadius: RADII.lg,
    overflow: 'hidden',
    backgroundColor: CTA_FILL,
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
