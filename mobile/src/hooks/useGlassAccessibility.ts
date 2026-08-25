import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { canUseNativeLiquidGlass } from '../logic/glassAvailability';

export function useGlassAccessibility() {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const media =
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-reduced-motion: reduce)')
          : null;
      if (media) {
        setReduceMotion(media.matches);
        const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
      }
      return;
    }

    const transparencyQuery = AccessibilityInfo.isReduceTransparencyEnabled?.();
    const motionQuery = AccessibilityInfo.isReduceMotionEnabled?.();
    if (transparencyQuery && typeof transparencyQuery.then === 'function') {
      void transparencyQuery.then(setReduceTransparency);
    }
    if (motionQuery && typeof motionQuery.then === 'function') {
      void motionQuery.then(setReduceMotion);
    }

    const transparencySub = AccessibilityInfo.addEventListener?.(
      'reduceTransparencyChanged',
      setReduceTransparency
    );
    const motionSub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      transparencySub?.remove?.();
      motionSub?.remove?.();
    };
  }, []);

  return {
    reduceTransparency,
    reduceMotion,
    nativeGlass: canUseNativeLiquidGlass(reduceTransparency),
  };
}
