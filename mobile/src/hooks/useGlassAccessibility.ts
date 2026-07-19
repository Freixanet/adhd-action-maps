import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { canUseNativeLiquidGlass } from '../logic/glassAvailability';

export function useGlassAccessibility() {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    const transparencySub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    );
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      transparencySub.remove();
      motionSub.remove();
    };
  }, []);

  return {
    reduceTransparency,
    reduceMotion,
    nativeGlass: canUseNativeLiquidGlass(reduceTransparency),
  };
}
