import { control } from '@shared/design-tokens';
import React from 'react';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keyboardLiftPx, keyboardInputHeight, composerGrowProgress } from '../logic/composerKeyboardLift';

export const COMPOSER_DOCK_GAP = 12;
/** Horizontal inset of the dock column (Continue + composer glass share this). */
export const COMPOSER_DOCK_PADDING_H = 16;
/**
 * Inner content inset inside the composer glass (TextInput / chips).
 * Continue’s icon+title should start on this same x within the dock column.
 */
export const COMPOSER_CONTENT_PADDING_H = 20;

type ComposerDockProps = {
  children: React.ReactNode;
  gap?: number;
  onHeightChange?: (height: number) => void;
};

/** Matches ComposerDock lift so scroll content moves up with the keyboard. */
export function useComposerKeyboardLift(gap = COMPOSER_DOCK_GAP): AnimatedStyle<ViewStyle> {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const insetBottom = insets.bottom;

  return useAnimatedStyle(() => {
    const closedBottom = Math.max(insetBottom, gap);
    const bottom = keyboardLiftPx(keyboard.height.value, insetBottom, gap);
    return { marginBottom: bottom - closedBottom };
  }, [insetBottom, gap]);
}

function useComposerExpandedFlag(expanded: boolean) {
  const expandedSV = useSharedValue(expanded ? 1 : 0);
  expandedSV.value = expanded ? 1 : 0;
  return expandedSV;
}

/** Widens the rest pill to full dock width in step with the keyboard / focus. */
export function useComposerKeyboardInset(
  restInset: number,
  expanded = false
): AnimatedStyle<ViewStyle> {
  const keyboard = useAnimatedKeyboard();
  const expandedSV = useComposerExpandedFlag(expanded);
  return useAnimatedStyle(() => {
    const t = composerGrowProgress(keyboard.height.value, expandedSV.value === 1);
    return {
      marginHorizontal: interpolate(t, [0, 1], [restInset, 0], Extrapolation.CLAMP),
    };
  }, [restInset]);
}

/** Grows the composer field from rest to focused height with the keyboard / focus. */
export function useComposerKeyboardInputHeight(
  restHeight: number,
  focusedHeight: number,
  expanded = false
): AnimatedStyle<ViewStyle> {
  const keyboard = useAnimatedKeyboard();
  const expandedSV = useComposerExpandedFlag(expanded);
  return useAnimatedStyle(() => {
    return {
      height: keyboardInputHeight(
        keyboard.height.value,
        restHeight,
        focusedHeight,
        expandedSV.value === 1
      ),
    };
  }, [restHeight, focusedHeight]);
}

/** Rest vs expanded text insets ride the same grow progress as height. */
export function useComposerKeyboardTextFrameStyle(rest: {
  paddingLeft: number;
  paddingRight: number;
  paddingBottom: number;
  paddingTop: number;
}, focused: {
  paddingLeft: number;
  paddingRight: number;
  paddingBottom: number;
  paddingTop: number;
}, expanded = false): AnimatedStyle<ViewStyle> {
  const keyboard = useAnimatedKeyboard();
  const expandedSV = useComposerExpandedFlag(expanded);
  const restLeft = rest.paddingLeft;
  const restRight = rest.paddingRight;
  const restBottom = rest.paddingBottom;
  const restTop = rest.paddingTop;
  const focusedLeft = focused.paddingLeft;
  const focusedRight = focused.paddingRight;
  const focusedBottom = focused.paddingBottom;
  const focusedTop = focused.paddingTop;

  return useAnimatedStyle(() => {
    const t = composerGrowProgress(keyboard.height.value, expandedSV.value === 1);
    return {
      paddingLeft: interpolate(t, [0, 1], [restLeft, focusedLeft], Extrapolation.CLAMP),
      paddingRight: interpolate(t, [0, 1], [restRight, focusedRight], Extrapolation.CLAMP),
      paddingBottom: interpolate(t, [0, 1], [restBottom, focusedBottom], Extrapolation.CLAMP),
      paddingTop: interpolate(t, [0, 1], [restTop, focusedTop], Extrapolation.CLAMP),
    };
  }, [restLeft, restRight, restBottom, restTop, focusedLeft, focusedRight, focusedBottom, focusedTop]);
}

export default function ComposerDock({
  children,
  gap = COMPOSER_DOCK_GAP,
  onHeightChange,
}: ComposerDockProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const insetBottom = insets.bottom;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      bottom: keyboardLiftPx(keyboard.height.value, insetBottom, gap),
    };
  }, [insetBottom, gap]);

  return (
    <Animated.View
      // Position via StyleSheet — Uniwind className on Reanimated views is unreliable
      // for absolute docking (composer was rendering at the top of the screen).
      style={[styles.dock, animatedStyle]}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: COMPOSER_DOCK_PADDING_H,
    overflow: 'visible',
    zIndex: 40,
    elevation: control.composerDockElevation,
  },
});
