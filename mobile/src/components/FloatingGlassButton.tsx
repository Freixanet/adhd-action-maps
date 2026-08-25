import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pressable } from 'react-native-gesture-handler';
import GlassBarShell, { GLASS_BAR_BUTTON_RADIUS } from './GlassBarShell';
import GlassSurface from './GlassSurface';
import NativeGlassButton from './NativeGlassButton';
import { usePressScale } from '../hooks/usePressScale';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import {
  shouldUseNativeGlassButton,
} from '../logic/nativeGlassButtons';
import { SIDEBAR_TOGGLE_BUTTON_SIZE } from './sidebarLayout';
import { useTheme } from '../context/ThemeContext';
import { ACCENT } from '@shared/uiTokens';
import { radius, color, primitive, type, shadow } from '@shared/design-tokens';

type FloatingGlassButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  children?: React.ReactNode;
  shape?: 'circle' | 'pill' | 'rounded';
  /**
   * `accent` → the single primary CTA on that surface (prominentGlass).
   * `neutral` → standard glass (nav / icons / secondary).
   */
  tone?: 'neutral' | 'accent';
  /** Circle diameter in points. Defaults to {@link FLOATING_CIRCLE_SIZE}. */
  size?: number;
  compact?: boolean;
  fullWidth?: boolean;
  /** Prefer SF Symbol inside UIButton over RN children. */
  systemImage?: string;
  title?: string;
  symbolPointSize?: number;
};

/** Profile circle diameter and paired bar height (e.g. Nuevo Núcleo in history). */
export const FLOATING_CIRCLE_SIZE = 52;
export const FLOATING_BAR_HEIGHT = FLOATING_CIRCLE_SIZE;
export const FLOATING_PILL_MIN_HEIGHT = 48;
/** Capsule ends — avoids rough native glass at borderRadius 9999. */
export const FLOATING_PILL_RADIUS = FLOATING_PILL_MIN_HEIGHT / 2;

export function FloatingGlassShell({
  children,
  shape = 'pill',
  tone = 'neutral',
  size = FLOATING_CIRCLE_SIZE,
  compact = false,
  fullWidth = false,
  prominent = false,
}: Pick<FloatingGlassButtonProps, 'children' | 'shape' | 'tone' | 'size' | 'compact' | 'fullWidth'> & {
  prominent?: boolean;
}) {
  const { isDark } = useTheme();
  const isAccent = tone === 'accent';
  const isCircle = shape === 'circle';
  const isRounded = shape === 'rounded';

  const circleSizeStyle = {
    width: size,
    height: size,
  };

  const accentTint = isDark ? color.background.accentTintDark : color.background.accentTintLight;
  const accentOverlay = isDark ? 'bg-accent/100/32' : 'bg-accent/28';

  if (isAccent) {
    if (isCircle) {
      const radius = size / 2;
      return (
        <View style={circleSizeStyle}>
          <GlassSurface
            liquid
            liquidBorder="none"
            borderRadius={radius}
            style={[styles.circleGlass, { width: size, height: size, borderRadius: radius }]}
            tintColor={accentTint}
            overlayClassName={accentOverlay}
            contentClassName="h-full w-full items-center justify-center"
          >
            <View style={styles.circleContent}>{children}</View>
          </GlassSurface>
        </View>
      );
    }

    return (
      <GlassBarShell
        style={[styles.accentBar, fullWidth ? styles.fullWidth : null]}
        tintColor={accentTint}
        overlayClassName={accentOverlay}
        contentClassName="h-full w-full items-center justify-center"
      >
        <View
          style={[
            compact ? styles.pillContentAccentCompact : styles.pillContentAccent,
            fullWidth ? styles.fullWidth : null,
          ]}
        >
          {children}
        </View>
      </GlassBarShell>
    );
  }

  if (isCircle) {
    const radius = size / 2;
    const circleGlass = (
      <GlassSurface
        liquid
        interactive
        liquidBorder="perimeter"
        liquidMaterial={prominent ? 'regular' : 'clear'}
        glassInset={prominent ? 0 : 1}
        borderRadius={radius}
        style={[styles.circleGlass, { width: size, height: size, borderRadius: radius }]}
        overlayClassName={
          prominent
            ? isDark
              ? 'bg-white/12'
              : 'bg-white/68'
            : isDark
              ? 'bg-white/[0.05]'
              : 'bg-white/40'
        }
        tintColor={
          prominent
            ? isDark
              ? color.background.neutralProminentDark
              : color.background.neutralProminentLight
            : undefined
        }
        contentClassName="h-full w-full items-center justify-center"
      >
        <View style={styles.circleContent}>{children}</View>
      </GlassSurface>
    );

    if (size < SIDEBAR_TOGGLE_BUTTON_SIZE) {
      return circleGlass;
    }

    return (
      <View style={[styles.shadow, prominent ? styles.shadowProminent : null, circleSizeStyle]}>
        {circleGlass}
      </View>
    );
  }

  if (isRounded) {
    return (
      <GlassBarShell>
        <View style={styles.barContent}>{children}</View>
      </GlassBarShell>
    );
  }

  return (
    <View style={[styles.shadow, compact ? styles.shadowCompact : null]}>
      <GlassSurface
        liquid
        interactive
        liquidBorder="perimeter"
        borderRadius={FLOATING_PILL_RADIUS}
        style={styles.neutralPill}
        contentClassName="h-full w-full items-center justify-center"
      >
        <View style={compact ? styles.pillContentCompact : styles.pillContent}>{children}</View>
      </GlassSurface>
    </View>
  );
}

function FloatingGlassButton({
  onPress,
  accessibilityLabel,
  children,
  shape = 'pill',
  tone = 'neutral',
  size = FLOATING_CIRCLE_SIZE,
  compact = false,
  fullWidth = false,
  systemImage,
  title,
  symbolPointSize,
}: FloatingGlassButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const { reduceTransparency } = useGlassAccessibility();
  const isAccent = tone === 'accent';
  const native = shouldUseNativeGlassButton(reduceTransparency);
  const hitSlop =
    shape === 'circle' && size < 44
      ? { top: 6, bottom: 6, left: 6, right: 6 }
      : undefined;

  if (native) {
    const isCircle = shape === 'circle';
    const height = isCircle ? size : compact ? FLOATING_PILL_MIN_HEIGHT : FLOATING_BAR_HEIGHT;
    const ownsLabel = Boolean(title || systemImage);
    return (
      <NativeGlassButton
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        variant={isAccent ? 'prominentGlass' : 'glass'}
        title={title}
        systemImage={systemImage}
        symbolPointSize={symbolPointSize ?? (isCircle ? 20 : 17)}
        cornerRadius={isCircle ? size / 2 : undefined}
        style={[
          { height },
          isCircle ? { width: size } : null,
          fullWidth ? styles.fullWidth : null,
          !isCircle && !fullWidth ? styles.nativePillPadding : null,
        ]}
      >
        {ownsLabel ? null : children}
      </NativeGlassButton>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={fullWidth ? styles.fullWidth : undefined}
    >
      <Animated.View style={animatedStyle}>
        <FloatingGlassShell
          shape={shape}
          tone={tone}
          size={size}
          compact={compact}
          fullWidth={fullWidth}
        >
          {children}
        </FloatingGlassShell>
      </Animated.View>
    </Pressable>
  );
}

export default React.memo(FloatingGlassButton);

const styles = StyleSheet.create({
  shadow: {
    ...shadow.glassFloating,
  },
  shadowCompact: {
    ...shadow.glassFloatingCompact,
  },
  accentShadow: {
    ...shadow.glassFloatingAccent,
  },
  shadowProminent: {
    ...shadow.glassFloatingProminent,
  },
  circleShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGlass: {
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  /** Native pills size to content, so keep the JS horizontal breathing room. */
  nativePillPadding: {
    paddingHorizontal: 16,
  },
  accentBar: {
    height: FLOATING_BAR_HEIGHT,
    borderRadius: GLASS_BAR_BUTTON_RADIUS,
    overflow: 'hidden',
  },
  neutralPill: {
    height: FLOATING_PILL_MIN_HEIGHT,
    borderRadius: FLOATING_PILL_RADIUS,
    overflow: 'hidden',
  },
  pillContent: {
    height: FLOATING_PILL_MIN_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  pillContentCompact: {
    height: FLOATING_PILL_MIN_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  pillContentAccent: {
    height: FLOATING_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
  },
  pillContentAccentCompact: {
    height: FLOATING_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  barContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
