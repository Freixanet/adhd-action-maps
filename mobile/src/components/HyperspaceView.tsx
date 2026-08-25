import React, { useEffect, useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colorsFor, control, font, motion, primitive, radius, space, type } from '@shared/design-tokens';
import { isSkiaAvailable } from '../logic/skiaAvailability';
import { rubberband } from '../logic/motionWorklets';
import { HYPERSPACE_SKSL } from './hyperspaceSksl';

const RUN_SECONDS = 5;
const DISMISS_DISTANCE = 0.18;
const DISMISS_VELOCITY = 1100;
const lightChrome = colorsFor('light');
const VOID = primitive.color.neutral.black;

const DISMISS_SPRING = {
  duration: motion.fade.duration,
  dampingRatio: 1,
  overshootClamping: true,
} as const;

const SNAP_SPRING = {
  duration: motion.fade.duration,
  dampingRatio: 0.8,
} as const;

type HyperspaceEffect = ReturnType<typeof Skia.RuntimeEffect.Make>;

let effectCache: HyperspaceEffect | null | undefined;

function getHyperspaceEffect(): HyperspaceEffect | null {
  if (effectCache !== undefined) return effectCache;
  if (!isSkiaAvailable()) {
    effectCache = null;
    return effectCache;
  }
  try {
    const make = Skia.RuntimeEffect?.Make;
    if (typeof make !== 'function') {
      effectCache = null;
      return effectCache;
    }
    effectCache = make(HYPERSPACE_SKSL);
    if (__DEV__ && !effectCache) {
      console.warn('[hyperspace] RuntimeEffect.Make returned null — SkSL did not compile');
    }
  } catch {
    effectCache = null;
  }
  return effectCache;
}

function runTime(startedAt: number, clock: number) {
  'worklet';
  const epoch = startedAt < 0 ? -RUN_SECONDS * 1000 : startedAt;
  return (clock - epoch) / 1000;
}

type HyperspaceSceneProps = {
  onClose: () => void;
};

function HyperspaceScene({ onClose }: HyperspaceSceneProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clock = useClock();
  const reduceMotion = useReducedMotion();
  const startedAt = useSharedValue(reduceMotion ? -1 : 0);
  const dragY = useSharedValue(0);
  const dragOrigin = useSharedValue(0);
  const source = useMemo(() => getHyperspaceEffect(), []);

  const uniforms = useDerivedValue(() => {
    'worklet';
    return {
      uResolution: [width, height],
      uTime: runTime(startedAt.value, clock.value),
    };
  }, [width, height]);

  const jump = () => {
    if (reduceMotion || !source) return;
    startedAt.value = clock.value;
  };

  useEffect(() => {
    dragY.value = 0;
  }, [dragY]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .onBegin(() => {
          dragOrigin.value = dragY.value;
        })
        .onUpdate((event) => {
          const next = dragOrigin.value + event.translationY;
          dragY.value = next >= 0 ? next : rubberband(next, height);
        })
        .onEnd((event) => {
          const projected = dragY.value + event.velocityY * 0.18;
          const shouldClose =
            projected > height * DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
          if (shouldClose) {
            const settle = reduceMotion
              ? height
              : withSpring(height, { ...DISMISS_SPRING, velocity: event.velocityY }, (finished) => {
                  if (finished) scheduleOnRN(onClose);
                });
            dragY.value = settle;
            if (reduceMotion) {
              scheduleOnRN(onClose);
            }
            return;
          }
          dragY.value = reduceMotion
            ? 0
            : withSpring(0, { ...SNAP_SPRING, velocity: event.velocityY });
        }),
    [dragOrigin, dragY, height, onClose, reduceMotion]
  );

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel="Preview hyperspace"
        accessibilityHint="Desliza hacia abajo para cerrar"
        onAccessibilityEscape={onClose}
        style={[styles.root, dragStyle]}
      >
        {source ? (
          <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Fill>
              <Shader source={source} uniforms={uniforms} />
            </Fill>
          </Canvas>
        ) : (
          <Animated.View style={styles.fallback} accessibilityRole="text">
            <Text style={[styles.fallbackText, { color: colorsFor('dark').text.body }]}>
              Skia no está disponible en este build.
            </Text>
          </Animated.View>
        )}

        {source && !reduceMotion ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to lightspeed"
            onPress={jump}
            style={[
              styles.jump,
              {
                backgroundColor: lightChrome.background.surface,
                marginBottom: insets.bottom + space.stack.lg,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.jumpLabel,
                {
                  color: lightChrome.text.primary,
                  fontSize: type.bodyStrong.fontSize,
                  lineHeight: type.bodyStrong.lineHeight,
                  fontWeight: type.bodyStrong.fontWeight,
                  letterSpacing: type.bodyStrong.letterSpacing,
                },
              ]}
            >
              Jump to lightspeed
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

type HyperspacePreviewProps = {
  visible: boolean;
  onClose: () => void;
};

/** DEV overlay: full-screen hyperspace shader. */
export default function HyperspacePreview({ visible, onClose }: HyperspacePreviewProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {visible ? (
        <GestureHandlerRootView style={styles.host}>
          <StatusBar style="light" />
          <HyperspaceScene onClose={onClose} />
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: VOID,
  },
  root: {
    flex: 1,
    backgroundColor: VOID,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.screen.horizontal,
  },
  fallbackText: {
    textAlign: 'center',
  },
  jump: {
    alignSelf: 'center',
    minHeight: control.touchMin,
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.stack.xl,
    paddingVertical: space.stack.md,
  },
  jumpLabel: {
    fontFamily: font.family,
  },
});
