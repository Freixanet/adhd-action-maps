import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const SLIDE_PX = 24;
const ENTER_MS = 250;
const EXIT_MS = 250;
const EXIT_OPACITY_MS = 180;

type StepSlideTransitionProps = {
  step: number;
  reduceMotion: boolean;
  disabled?: boolean;
  children: (step: number) => React.ReactNode;
};

export default function StepSlideTransition({
  step,
  reduceMotion,
  disabled = false,
  children,
}: StepSlideTransitionProps) {
  const [stepA, setStepA] = useState(step);
  const [stepB, setStepB] = useState(step);
  const [frontIsA, setFrontIsA] = useState(true);
  const displayedStepRef = useRef(step);
  const frontIsARef = useRef(true);

  const opacityA = useSharedValue(1);
  const opacityB = useSharedValue(0);
  const translateA = useSharedValue(0);
  const translateB = useSharedValue(0);

  useEffect(() => {
    frontIsARef.current = frontIsA;
  }, [frontIsA]);

  useEffect(() => {
    if (disabled || reduceMotion) {
      setStepA(step);
      setStepB(step);
      setFrontIsA(true);
      frontIsARef.current = true;
      displayedStepRef.current = step;
      opacityA.value = 1;
      opacityB.value = 0;
      translateA.value = 0;
      translateB.value = 0;
      return;
    }

    const previousStep = displayedStepRef.current;
    if (step === previousStep) return;

    const dir = step > previousStep ? 1 : -1;
    displayedStepRef.current = step;

    const markFrontB = () => {
      frontIsARef.current = false;
      setFrontIsA(false);
    };
    const markFrontA = () => {
      frontIsARef.current = true;
      setFrontIsA(true);
    };

    if (frontIsARef.current) {
      setStepB(step);
      opacityA.value = withTiming(0, { duration: EXIT_OPACITY_MS });
      translateA.value = withTiming(-dir * SLIDE_PX, { duration: EXIT_MS });
      translateB.value = dir * SLIDE_PX;
      opacityB.value = 0;
      translateB.value = withTiming(0, { duration: ENTER_MS });
      opacityB.value = withTiming(1, { duration: ENTER_MS }, (finished) => {
        if (finished) runOnJS(markFrontB)();
      });
      return;
    }

    setStepA(step);
    opacityB.value = withTiming(0, { duration: EXIT_OPACITY_MS });
    translateB.value = withTiming(-dir * SLIDE_PX, { duration: EXIT_MS });
    translateA.value = dir * SLIDE_PX;
    opacityA.value = 0;
    translateA.value = withTiming(0, { duration: ENTER_MS });
    opacityA.value = withTiming(1, { duration: ENTER_MS }, (finished) => {
      if (finished) runOnJS(markFrontA)();
    });
  }, [disabled, opacityA, opacityB, reduceMotion, step, translateA, translateB]);

  const panelAStyle = useAnimatedStyle(() => ({
    opacity: opacityA.value,
    transform: [{ translateX: translateA.value }],
  }));

  const panelBStyle = useAnimatedStyle(() => ({
    opacity: opacityB.value,
    transform: [{ translateX: translateB.value }],
  }));

  if (disabled || reduceMotion) {
    return <View>{children(step)}</View>;
  }

  return (
    <View style={styles.host}>
      <Animated.View
        style={[styles.panel, panelAStyle, !frontIsA ? styles.absolutePanel : null]}
        pointerEvents={frontIsA ? 'auto' : 'none'}
      >
        {children(stepA)}
      </Animated.View>
      <Animated.View
        style={[styles.panel, panelBStyle, frontIsA ? styles.absolutePanel : null]}
        pointerEvents={frontIsA ? 'none' : 'auto'}
      >
        {children(stepB)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'relative',
  },
  panel: {
    width: '100%',
  },
  absolutePanel: {
    ...StyleSheet.absoluteFill,
  },
});
