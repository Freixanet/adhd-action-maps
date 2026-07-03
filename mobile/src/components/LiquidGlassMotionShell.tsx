import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import LiquidGlassSurface, { type LiquidGlassVariant } from './LiquidGlassSurface';
import GlassPerimeterHighlight from './GlassPerimeterRing';
import GlassTouchGlow from './GlassTouchGlow';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useGlassTouchGlow } from '../hooks/useGlassTouchGlow';
import { useTheme } from '../context/ThemeContext';
import { COMPOSER_DARK_SURFACE, GLASS_TOUCH_GLOW_COMPOSER_CENTER_OPACITY_DARK, GLASS_TOUCH_GLOW_COMPOSER_CENTER_OPACITY_LIGHT, GLASS_TOUCH_GLOW_COMPOSER_HOLD_SETTLE_MS, GLASS_TOUCH_GLOW_COMPOSER_PEAK_DWELL_MS, GLASS_TOUCH_GLOW_COMPOSER_RADIUS_SCALE, GLASS_TOUCH_GLOW_FADE_IN_MS_COMPOSER, GLASS_TOUCH_GLOW_FOCUSED_HOLD_OPACITY, liquidGlassShellClasses } from '@shared/uiTokens';

/**
 * Composer-only glass motion shell.
 *
 * **Native (expo-glass-effect):** stable `regular` material + optional `isInteractive`.
 * Material does NOT change on focus — motion is overlay/wrapper only.
 *
 * **Reanimated:** scale pulse + sheen sweep. Never GlassView opacity.
 */
type LiquidGlassMotionShellProps = {
  children: React.ReactNode;
  borderRadius: number;
  variant?: LiquidGlassVariant;
  tintColor?: string;
  focused?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
  className?: string;
  style?: StyleProp<ViewStyle>;
  contentClassName?: string;
  /** Perimeter highlight via SVG; `none` to opt out. */
  liquidBorder?: 'perimeter' | 'none';
};

const PEAK_SCALE = 1.018;
const FOCUSED_IDLE_SCALE = 1.006;
/** Deterministic pop: timing (not spring) so the return is not delayed by a spring tail. */
const PEAK_UP_MS = 110;
const SETTLE_MS = 130;
const BLUR_SPRING = { damping: 22, stiffness: 560, mass: 0.55 };

const SHEEN_MS = 180;
const PULSE_DEBOUNCE_MS = 140;

function triggerHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export default function LiquidGlassMotionShell({
  children,
  borderRadius,
  variant = 'composer',
  tintColor,
  focused = false,
  inputRef,
  className = '',
  style,
  contentClassName = '',
  liquidBorder = 'perimeter',
}: LiquidGlassMotionShellProps) {
  const { isDark } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const touchGlow = useGlassTouchGlow(reduceMotion, isDark, {
    fadeInMs: GLASS_TOUCH_GLOW_FADE_IN_MS_COMPOSER,
    holdCenterOpacity: GLASS_TOUCH_GLOW_FOCUSED_HOLD_OPACITY,
    holdSettleMs: GLASS_TOUCH_GLOW_COMPOSER_HOLD_SETTLE_MS,
    peakDwellMs: GLASS_TOUCH_GLOW_COMPOSER_PEAK_DWELL_MS,
    centerOpacity: isDark
      ? GLASS_TOUCH_GLOW_COMPOSER_CENTER_OPACITY_DARK
      : GLASS_TOUCH_GLOW_COMPOSER_CENTER_OPACITY_LIGHT,
  });

  const scale = useSharedValue(1);
  const sheenProgress = useSharedValue(0);
  const shellWidth = useSharedValue(0);
  const [shellSize, setShellSize] = useState({ width: 0, height: 0 });
  const lastPulseAt = useRef(0);
  const prevFocusedRef = useRef(focused);
  const glowStartedThisFocusRef = useRef(false);
  const pendingFocusGlowRef = useRef(false);

  const beginFocusGlow = useCallback(() => {
    const { width, height } = shellSize;
    if (width <= 0 || height <= 0) {
      pendingFocusGlowRef.current = true;
      return;
    }

    pendingFocusGlowRef.current = false;
    glowStartedThisFocusRef.current = true;
    const x = width * 0.5;
    const y = Math.max(1, height * 0.38);
    touchGlow.onFocusPressIn(x, y);
  }, [shellSize, touchGlow]);

  const resolvedTint =
    tintColor ??
    (variant === 'composer'
      ? isDark
        ? COMPOSER_DARK_SURFACE
        : 'rgba(255, 255, 255, 0.45)'
      : undefined);

  const settleScale = useCallback(
    (isFocused: boolean) => (isFocused ? FOCUSED_IDLE_SCALE : 1),
    []
  );

  const firePulse = useCallback(
    (isFocused: boolean, withHaptic: boolean) => {
      if (withHaptic) triggerHaptic();

      if (reduceMotion) {
        scale.value = settleScale(isFocused);
        sheenProgress.value = 0;
        return;
      }

      scale.value = withSequence(
        withTiming(PEAK_SCALE, { duration: PEAK_UP_MS, easing: Easing.out(Easing.quad) }),
        withTiming(settleScale(isFocused), {
          duration: SETTLE_MS,
          easing: Easing.out(Easing.cubic),
        })
      );

      sheenProgress.value = 0;
      sheenProgress.value = withTiming(1, {
        duration: SHEEN_MS,
        easing: Easing.out(Easing.cubic),
      });
    },
    [reduceMotion, scale, settleScale, sheenProgress]
  );

  const requestPulse = useCallback(
    (isFocused: boolean, withHaptic: boolean) => {
      const now = Date.now();
      if (now - lastPulseAt.current < PULSE_DEBOUNCE_MS) return;
      lastPulseAt.current = now;
      firePulse(isFocused, withHaptic);
    },
    [firePulse]
  );

  const triggerPressGlow = useCallback(
    (event: import('react-native').GestureResponderEvent) => {
      const { locationX, locationY } = event.nativeEvent;
      glowStartedThisFocusRef.current = true;
      pendingFocusGlowRef.current = false;
      touchGlow.onPressIn(locationX, locationY);
      requestPulse(focused, true);
    },
    [focused, requestPulse, touchGlow]
  );

  // Touch events bubble even when a child (button / TextInput) owns the gesture,
  // so the press glow fires for taps anywhere inside the shell.
  const handleGlowTouch = useCallback(
    (event: import('react-native').GestureResponderEvent) => {
      triggerPressGlow(event);
    },
    [triggerPressGlow]
  );

  // Responder only claims taps on the empty chrome (no child claimed them):
  // focus the input plus fire the glow.
  const handleTouchGrant = useCallback(
    (event: import('react-native').GestureResponderEvent) => {
      triggerPressGlow(event);
      inputRef?.current?.focus();
    },
    [inputRef, triggerPressGlow]
  );

  const handleTouchRelease = useCallback(() => {
    touchGlow.onReleaseHold();
  }, [touchGlow]);

  useEffect(() => {
    const wasFocused = prevFocusedRef.current;
    prevFocusedRef.current = focused;

    if (focused && !wasFocused) {
      requestPulse(true, true);
      if (!glowStartedThisFocusRef.current) {
        beginFocusGlow();
      }
      return;
    }

    if (!focused && wasFocused) {
      glowStartedThisFocusRef.current = false;
      pendingFocusGlowRef.current = false;
      touchGlow.onPressOut();
    }

    if (!focused) {
      if (reduceMotion) {
        scale.value = 1;
        sheenProgress.value = 0;
        return;
      }

      scale.value = withSpring(1, BLUR_SPRING);
    }
  }, [
    beginFocusGlow,
    focused,
    reduceMotion,
    requestPulse,
    scale,
    sheenProgress,
    touchGlow,
  ]);

  useEffect(() => {
    if (!focused || glowStartedThisFocusRef.current || !pendingFocusGlowRef.current) return;
    if (shellSize.width <= 0 || shellSize.height <= 0) return;
    beginFocusGlow();
  }, [beginFocusGlow, focused, shellSize.height, shellSize.width]);

  const shellMotionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sheenStyle = useAnimatedStyle(() => {
    const width = shellWidth.value || 1;
    return {
      opacity: interpolate(sheenProgress.value, [0, 0.2, 0.65, 1], [0, 0.12, 0.08, 0]),
      transform: [
        { skewX: '-14deg' },
        { translateX: interpolate(sheenProgress.value, [0, 1], [-width * 0.6, width]) },
      ],
    };
  });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    shellWidth.value = width;
    setShellSize({ width, height });
  }, [shellWidth]);

  const sheenColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.22)';

  return (
    <Animated.View style={[shellMotionStyle, styles.motionShell]} onLayout={handleLayout}>
      <View
        className={liquidGlassShellClasses(className)}
        style={[styles.shell, { borderRadius }, style]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouchGrant}
        onResponderRelease={handleTouchRelease}
        onResponderTerminate={handleTouchRelease}
        onResponderTerminationRequest={() => true}
        onTouchStart={handleGlowTouch}
        onTouchEnd={handleTouchRelease}
        onTouchCancel={handleTouchRelease}
      >
          <LiquidGlassSurface
            style={StyleSheet.absoluteFill}
            borderRadius={borderRadius}
            variant={variant}
            tintColor={resolvedTint}
            interactive={focused}
          >
          <View />
        </LiquidGlassSurface>

        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.sheenClip, { borderRadius }]}
        >
          <Animated.View style={[styles.sheenBand, { backgroundColor: sheenColor }, sheenStyle]} />
        </View>

        {shellSize.width > 0 && shellSize.height > 0 ? (
          <GlassTouchGlow
            width={shellSize.width}
            height={shellSize.height}
            borderRadius={borderRadius}
            isDark={isDark}
            edgeInset={2}
            glowOpacity={touchGlow.glowOpacity}
            touchPoint={touchGlow.touchPoint}
            centerOpacity={touchGlow.centerOpacity}
            radiusScale={GLASS_TOUCH_GLOW_COMPOSER_RADIUS_SCALE}
          />
        ) : null}

        {liquidBorder === 'perimeter' ? (
          <GlassPerimeterHighlight
            width={shellSize.width}
            height={shellSize.height}
            borderRadius={borderRadius}
            isDark={isDark}
          />
        ) : null}

        <View className={`relative z-20 ${contentClassName}`.trim()}>{children}</View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  motionShell: {
    overflow: 'visible',
  },
  shell: {
    position: 'relative',
    overflow: 'hidden',
  },
  sheenClip: {
    overflow: 'hidden',
  },
  sheenBand: {
    position: 'absolute',
    top: -16,
    bottom: -16,
    width: '28%',
  },
});
