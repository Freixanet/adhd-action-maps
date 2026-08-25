import React, { useCallback, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from '../icons';
import StepFooterGlassButton from './StepFooterGlassButton';
import { useAppSession } from '../context/AppSessionContext';
import { useThemeColors } from '../context/ThemeContext';

type StepFooterNavProps = {
  completeLabel?: string;
  /** Shared with tap/scroll chrome — hides the complete CTA with the footer. */
  chromeVisibleShared?: SharedValue<boolean>;
  onRevealLayout?: (height: number) => void;
};

/**
 * Last-step complete CTA only. Page turns use the vertical swipe — no Atrás/Siguiente.
 */
export default function StepFooterNav({
  completeLabel = 'Completar Núcleo',
  chromeVisibleShared,
  onRevealLayout,
}: StepFooterNavProps) {
  const session = useAppSession();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const ctaIconColor = colors.text.onAccent;
  const isLastReadingStep =
    !session.viewAll &&
    !session.isComplete &&
    session.currentStep > 0 &&
    session.currentStep >= session.totalSteps;
  const [layoutVisible, setLayoutVisible] = useState(
    () => chromeVisibleShared?.value ?? true
  );
  // The initially visible footer must compensate the page too, not only later reveals.
  const revealLayoutPendingRef = useRef(layoutVisible);

  const commitLayoutVisibility = useCallback((visible: boolean) => {
    if (visible) revealLayoutPendingRef.current = true;
    setLayoutVisible(visible);
  }, []);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = Math.ceil(event.nativeEvent.layout.height);
      if (height <= 0) return;
      if (revealLayoutPendingRef.current) {
        revealLayoutPendingRef.current = false;
        onRevealLayout?.(height);
      }
    },
    [onRevealLayout]
  );

  useAnimatedReaction(
    () => chromeVisibleShared?.value ?? true,
    (visible, previous) => {
      if (previous === null || visible === previous) return;
      runOnJS(commitLayoutVisibility)(visible);
    },
    [chromeVisibleShared, commitLayoutVisibility]
  );

  if (!isLastReadingStep || !layoutVisible) return null;

  return (
    <View
      style={styles.footerShell}
      className="border-t border-neutral-200 border-white/10 bg-base"
      onLayout={handleLayout}
    >
      <View
        className="px-7"
        style={{ paddingTop: 16, paddingBottom: insets.bottom + 16 }}
      >
        <StepFooterGlassButton
          variant="primary"
          label={completeLabel}
          onPress={session.handleCompleteMap}
          icon={<Check size={20} color={ctaIconColor} />}
          iconPlacement="leading"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerShell: {
    flexShrink: 0,
  },
});
