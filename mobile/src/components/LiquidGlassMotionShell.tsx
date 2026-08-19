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
import LiquidGlassSurface, { type LiquidGlassVariant } from './LiquidGlassSurface';
import GlassPerimeterHighlight from './GlassPerimeterRing';
import GlassTouchGlow from './GlassTouchGlow';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useGlassTouchGlow } from '../hooks/useGlassTouchGlow';
import {
  COMPOSER_GLASS_HOSTS_CONTENT,
  COMPOSER_NATIVE_CORNERS,
  COMPOSER_NATIVE_INTERACTIVE_ONLY,
} from '../logic/nativeGlassComposer';
import { COMPOSER_REST_INPUT_HEIGHT } from '../logic/composerText';
import { useTheme, useThemeColors } from '../context/ThemeContext';
import { GLASS_TOUCH_GLOW_COMPOSER_CENTER_OPACITY_DARK, GLASS_TOUCH_GLOW_COMPOSER_CENTER_OPACITY_LIGHT, GLASS_TOUCH_GLOW_COMPOSER_PEAK_DWELL_MS, GLASS_TOUCH_GLOW_COMPOSER_RADIUS_SCALE, GLASS_TOUCH_GLOW_FADE_IN_MS_COMPOSER, liquidGlassShellClasses } from '@shared/uiTokens';

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
  const colors = useThemeColors();
  const { reduceMotion } = useGlassAccessibility();
  const touchGlow = useGlassTouchGlow(reduceMotion, isDark, {
    fadeInMs: GLASS_TOUCH_GLOW_FADE_IN_MS_COMPOSER,
    releaseFadeMs: 900,
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

  // Native Liquid Glass: no tint — same as UIButton.Configuration.glass().
  const resolvedTint = tintColor;

  const settleScale = useCallback(
    (isFocused: boolean) => (isFocused ? FOCUSED_IDLE_SCALE : 1),
    []
  );

  const firePulse = useCallback(
    (isFocused: boolean) => {
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
    (isFocused: boolean) => {
      const now = Date.now();
      if (now - lastPulseAt.current < PULSE_DEBOUNCE_MS) return;
      lastPulseAt.current = now;
      firePulse(isFocused);
    },
    [firePulse]
  );

  const triggerPressGlow = useCallback(
    (event: import('react-native').GestureResponderEvent) => {
      const { locationX, locationY } = event.nativeEvent;
      glowStartedThisFocusRef.current = true;
      pendingFocusGlowRef.current = false;
      touchGlow.onPressIn(locationX, locationY);
      requestPulse(focused);
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

  const handleTouchRelease = useCallback(() => {
    touchGlow.onPressOut();
  }, [touchGlow]);

  useEffect(() => {
    const wasFocused = prevFocusedRef.current;
    prevFocusedRef.current = focused;

    if (focused && !wasFocused) {
      requestPulse(true);
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
    const bandWidth = shellWidth.value || 1;
    return {
      opacity: interpolate(sheenProgress.value, [0, 0.18, 0.55, 1], [0, 0.1, 0.06, 0]),
      transform: [
        { translateX: interpolate(sheenProgress.value, [0, 1], [-bandWidth * 0.55, bandWidth * 0.9]) },
      ],
    };
  });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    shellWidth.value = width;
    setShellSize({ width, height });
  }, [shellWidth]);

  const sheenColor = isDark ? colors.background.sheenDark : colors.background.whiteFade22;

  // UIKit's interactive glass already answers the touch, so the JS ornaments
  // (pulse, sheen, glow, perimeter ring) come off together.
  const nativeOnly = COMPOSER_NATIVE_INTERACTIVE_ONLY;
  const nativeCorners = variant === 'composer' && COMPOSER_NATIVE_CORNERS;
  const glassHostsContent = COMPOSER_GLASS_HOSTS_CONTENT;
  // Rest pill: stadium (half the short bar). Taller chrome (image, paste) or
  // focus: keep radius.composer so the glass stays a rounded rect.
  const restCapsuleMax = COMPOSER_REST_INPUT_HEIGHT + 36;
  const clipRadius =
    variant === 'composer' &&
    !focused &&
    shellSize.height > 0 &&
    shellSize.height <= restCapsuleMax
      ? shellSize.height / 2
      : borderRadius;

  const ornaments = (
    <>
      {nativeOnly ? null : (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.sheenClip, { borderRadius }]}
        >
          <Animated.View
            style={[
              styles.sheenBand,
              { backgroundColor: sheenColor, borderRadius: borderRadius * 0.85 },
              sheenStyle,
            ]}
          />
        </View>
      )}

      {!nativeOnly && shellSize.width > 0 && shellSize.height > 0 ? (
        <GlassTouchGlow
          width={shellSize.width}
          height={shellSize.height}
          borderRadius={borderRadius}
          isDark={isDark}
          edgeInset={0}
          glowOpacity={touchGlow.glowOpacity}
          touchX={touchGlow.touchX}
          touchY={touchGlow.touchY}
          centerOpacity={touchGlow.centerOpacity}
          radiusScale={GLASS_TOUCH_GLOW_COMPOSER_RADIUS_SCALE}
        />
      ) : null}

      {!nativeOnly && liquidBorder === 'perimeter' ? (
        <GlassPerimeterHighlight
          width={shellSize.width}
          height={shellSize.height}
          borderRadius={borderRadius}
          isDark={isDark}
        />
      ) : null}
    </>
  );

  // The effect view is the shell itself, so touches reach UIKit on their way to
  // the field and the toolbar.
  if (glassHostsContent) {
    return (
      <Animated.View
        style={[nativeOnly ? null : shellMotionStyle, styles.motionShell]}
        onLayout={handleLayout}
      >
        <LiquidGlassSurface
          hostsContent
          style={[styles.shell, nativeCorners ? styles.shellNativeCorners : null, style]}
          borderRadius={clipRadius}
          variant={variant}
          tintColor={resolvedTint}
          interactive
        >
          {ornaments}
          <View style={styles.content} className={contentClassName}>
            {children}
          </View>
        </LiquidGlassSurface>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[nativeOnly ? null : shellMotionStyle, styles.motionShell]}
      onLayout={handleLayout}
    >
      <View
        className={liquidGlassShellClasses(className)}
        style={[
          styles.shell,
          { borderRadius },
          nativeCorners ? styles.shellNativeCorners : null,
          style,
        ]}
        onStartShouldSetResponder={() => false}
        onTouchStart={nativeOnly ? undefined : handleGlowTouch}
        onTouchEnd={nativeOnly ? undefined : handleTouchRelease}
        onTouchCancel={nativeOnly ? undefined : handleTouchRelease}
      >
          <LiquidGlassSurface
            style={StyleSheet.absoluteFill}
            borderRadius={borderRadius}
            variant={variant}
            tintColor={resolvedTint}
            interactive
          >
          <View />
        </LiquidGlassSurface>

        {ornaments}

        <View style={styles.content} className={contentClassName}>
          {children}
        </View>
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
  /** UIKit shapes the glass edge, so the shell must not clip it. */
  shellNativeCorners: {
    overflow: 'visible',
  },
  content: {
    position: 'relative',
    zIndex: 20,
  },
  sheenClip: {
    overflow: 'hidden',
  },
  sheenBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '34%',
  },
});
