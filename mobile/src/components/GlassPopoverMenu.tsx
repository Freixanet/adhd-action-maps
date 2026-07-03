import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { stepHaptic } from '../context/AppSessionContext';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import type { AttachAnchorRect } from '../hooks/useAttachMenuAnchor';
import GlassSurface from './GlassSurface';

// Mirrors the feel of a native iOS UIMenu, as a custom popover so the content
// (icons on the left, compact width) is fully under our control.
//
// Native Liquid Glass caveat: a UIGlassEffect initialized while its view has
// alpha 0 captures an empty backdrop and stays transparent forever. So the
// entrance is SCALE-ONLY (opacity stays 1); on settle we remount the glass once
// as a safety net so the resting state is always a correct glass surface.
const OPEN_SPRING = { damping: 32, stiffness: 600, mass: 1 } as const;
const CLOSE_DURATION = 180;
const REDUCED_DURATION = 120;

type GlassPopoverMenuProps = {
  open: boolean;
  onClose: () => void;
  /** Anchor position (window coords) the popover grows from. */
  anchorRect: AttachAnchorRect | null;
  width: number;
  /** Vertical gap between the anchor top and the popover bottom. */
  gap?: number;
  borderRadius?: number;
  /** Scale/transform origin corner nearest the anchor. */
  transformOrigin?: string;
  accessibilityLabel?: string;
  children: React.ReactNode;
};

export default function GlassPopoverMenu({
  open,
  onClose,
  anchorRect,
  width,
  gap = 10,
  borderRadius = 20,
  transformOrigin = 'bottom left',
  accessibilityLabel = 'Cerrar menú',
  children,
}: GlassPopoverMenuProps) {
  const { reduceMotion } = useGlassAccessibility();
  const [mounted, setMounted] = useState(open);
  const [glassKey, setGlassKey] = useState(0);
  // opacity is never animated to 0 while open (see caveat above).
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(1);

  const bumpGlass = useCallback(() => setGlassKey((key) => key + 1), []);
  const unmount = useCallback(() => setMounted(false), []);

  // Keep last anchor so the close animation can still position after the
  // controller clears anchorRect on close.
  const lastRectRef = useRef<AttachAnchorRect | null>(anchorRect);
  if (anchorRect) {
    lastRectRef.current = anchorRect;
  }
  const rect = anchorRect ?? lastRectRef.current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      opacity.value = 1;
      stepHaptic();
      if (reduceMotion) {
        scale.value = 1;
        runOnJS(bumpGlass)();
      } else {
        scale.value = 0.2;
        scale.value = withSpring(1, OPEN_SPRING, (finished) => {
          if (finished) runOnJS(bumpGlass)();
        });
      }
      return;
    }

    if (!mounted) return;
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: REDUCED_DURATION }, (finished) => {
        if (finished) runOnJS(unmount)();
      });
    } else {
      scale.value = withTiming(0.92, {
        duration: CLOSE_DURATION,
        easing: Easing.out(Easing.quad),
      });
      opacity.value = withTiming(
        0,
        { duration: CLOSE_DURATION, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(unmount)();
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!mounted || !rect) {
    return null;
  }

  const screenHeight = Dimensions.get('window').height;
  const menuBottom = screenHeight - rect.y + gap;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {/* No dim — a native UIMenu doesn't darken the background. Tap outside closes. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel={accessibilityLabel}
      />

      <Animated.View
        style={[
          styles.menu,
          { left: rect.x, bottom: menuBottom, width, transformOrigin },
          animatedStyle,
        ]}
        accessibilityRole="menu"
      >
        <GlassSurface liquid borderRadius={borderRadius} glassRefreshKey={glassKey}>
          {children}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  menu: {
    position: 'absolute',
    zIndex: 110,
  },
});
