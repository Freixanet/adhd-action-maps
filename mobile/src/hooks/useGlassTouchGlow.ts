import { useCallback } from 'react';
import {
  cancelAnimation,
  Easing,
  SharedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  GLASS_TOUCH_GLOW_CENTER_OPACITY_DARK,
  GLASS_TOUCH_GLOW_CENTER_OPACITY_LIGHT,
  GLASS_TOUCH_GLOW_FADE_IN_MS,
  GLASS_TOUCH_GLOW_FADE_OUT_MS,
  GLASS_TOUCH_GLOW_REDUCE_MOTION_OPACITY,
} from '@shared/uiTokens';

export type GlassTouchGlowOptions = {
  fadeInMs?: number;
  releaseFadeMs?: number;
  /** Absolute center opacity after release while input stays focused. */
  holdCenterOpacity?: number;
  holdSettleMs?: number;
  /** Peak dwell before auto-settle (keyboard-open / focus path). */
  peakDwellMs?: number;
  /** Overrides default radial center opacity (composer uses a brighter peak). */
  centerOpacity?: number;
};

export type GlassTouchGlowState = {
  glowOpacity: SharedValue<number>;
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  centerOpacity: number;
  onPressIn: (locationX: number, locationY: number) => void;
  onPressOut: () => void;
  /** Composer: settle to hold opacity instead of fading out on release. */
  onReleaseHold: () => void;
  /** Composer: fade in → dwell at peak → settle to hold (first TextInput focus). */
  onFocusPressIn: (locationX: number, locationY: number) => void;
};

const DEFAULT_HOLD_SETTLE_MS = 180;

export function useGlassTouchGlow(
  reduceMotion: boolean,
  isDark = true,
  options: GlassTouchGlowOptions = {}
): GlassTouchGlowState {
  const {
    fadeInMs = GLASS_TOUCH_GLOW_FADE_IN_MS,
    releaseFadeMs = GLASS_TOUCH_GLOW_FADE_OUT_MS,
    holdCenterOpacity,
    holdSettleMs = DEFAULT_HOLD_SETTLE_MS,
    peakDwellMs = 0,
    centerOpacity: centerOpacityOverride,
  } = options;

  const glowOpacity = useSharedValue(0);
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const defaultCenterOpacity = isDark
    ? GLASS_TOUCH_GLOW_CENTER_OPACITY_DARK
    : GLASS_TOUCH_GLOW_CENTER_OPACITY_LIGHT;
  const centerOpacity = centerOpacityOverride ?? defaultCenterOpacity;

  const holdOpacityRatio =
    holdCenterOpacity != null ? holdCenterOpacity / centerOpacity : 0;

  const setTouchLocation = useCallback(
    (locationX: number, locationY: number) => {
      touchX.value = locationX;
      touchY.value = locationY;
    },
    [touchX, touchY]
  );

  const onPressIn = useCallback(
    (locationX: number, locationY: number) => {
      cancelAnimation(glowOpacity);
      setTouchLocation(locationX, locationY);

      if (reduceMotion) {
        glowOpacity.value = GLASS_TOUCH_GLOW_REDUCE_MOTION_OPACITY / centerOpacity;
        return;
      }

      glowOpacity.value = withTiming(1, { duration: fadeInMs });
    },
    [centerOpacity, fadeInMs, glowOpacity, reduceMotion, setTouchLocation]
  );

  const onFocusPressIn = useCallback(
    (locationX: number, locationY: number) => {
      cancelAnimation(glowOpacity);
      setTouchLocation(locationX, locationY);

      if (reduceMotion) {
        glowOpacity.value = holdOpacityRatio;
        return;
      }

      if (peakDwellMs <= 0) {
        onPressIn(locationX, locationY);
        return;
      }

      glowOpacity.value = withSequence(
        withTiming(1, { duration: fadeInMs, easing: Easing.out(Easing.cubic) }),
        withDelay(
          peakDwellMs,
          withTiming(holdOpacityRatio, {
            duration: holdCenterOpacity != null ? holdSettleMs : releaseFadeMs,
            easing: Easing.out(Easing.cubic),
          })
        )
      );
    },
    [
      fadeInMs,
      glowOpacity,
      holdCenterOpacity,
      holdOpacityRatio,
      holdSettleMs,
      onPressIn,
      peakDwellMs,
      reduceMotion,
      releaseFadeMs,
      setTouchLocation,
    ]
  );

  const onPressOut = useCallback(() => {
    cancelAnimation(glowOpacity);

    if (reduceMotion) {
      glowOpacity.value = 0;
      return;
    }

    glowOpacity.value = withTiming(0, {
      duration: releaseFadeMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [glowOpacity, reduceMotion, releaseFadeMs]);

  const onReleaseHold = useCallback(() => {
    cancelAnimation(glowOpacity);

    if (holdCenterOpacity == null) {
      onPressOut();
      return;
    }

    if (reduceMotion) {
      glowOpacity.value = holdOpacityRatio;
      return;
    }

    glowOpacity.value = withTiming(holdOpacityRatio, {
      duration: holdSettleMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [glowOpacity, holdCenterOpacity, holdOpacityRatio, holdSettleMs, onPressOut, reduceMotion]);

  return {
    glowOpacity,
    touchX,
    touchY,
    centerOpacity,
    onPressIn,
    onPressOut,
    onReleaseHold,
    onFocusPressIn,
  };
}
