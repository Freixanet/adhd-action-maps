import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';

/** Fixed height — Atrás and Siguiente must match without flex growth. */
export const STEP_FOOTER_BUTTON_HEIGHT = 52;
const STEP_FOOTER_PRIMARY_BG = '#6A6FE0';
const STEP_FOOTER_PRIMARY_TEXT = '#FFFFFF';

type StepFooterGlassButtonProps = {
  onPress: () => void;
  label: string;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
  iconPlacement?: 'leading' | 'trailing';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export default function StepFooterGlassButton({
  onPress,
  label,
  variant = 'primary',
  icon,
  iconPlacement = 'trailing',
  style,
  accessibilityLabel,
  disabled = false,
}: StepFooterGlassButtonProps) {
  const isPrimary = variant === 'primary';

  const content = (
    <View style={styles.content}>
      {iconPlacement === 'leading' ? icon : null}
      <Text
        className={isPrimary ? 'text-[17px] font-semibold' : 'text-[17px] font-semibold text-body'}
        style={isPrimary ? styles.primaryLabel : undefined}
      >
        {label}
      </Text>
      {iconPlacement === 'trailing' ? icon : null}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pressable,
        style,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      {isPrimary ? (
        <View style={[styles.shell, styles.primaryShell]}>{content}</View>
      ) : (
        <GlassSurface
          liquid
          liquidBorder="perimeter"
          borderRadius={RADII.lg}
          style={[styles.shell, styles.secondaryShell]}
          contentClassName="h-full w-full items-center justify-center"
        >
          {content}
        </GlassSurface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  shell: {
    width: '100%',
    height: STEP_FOOTER_BUTTON_HEIGHT,
  },
  primaryShell: {
    backgroundColor: STEP_FOOTER_PRIMARY_BG,
    borderRadius: RADII.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: STEP_FOOTER_PRIMARY_TEXT,
  },
  content: {
    height: STEP_FOOTER_BUTTON_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  secondaryShell: {
    borderRadius: RADII.lg,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
