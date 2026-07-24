import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from '../icons';
import StepFooterGlassButton from './StepFooterGlassButton';
import { GenerationProgressBar } from './loadingGenerationUi';
import { useAppSession } from '../context/AppSessionContext';

/** CTA icon over the solid step-footer primary fill (SPEC §3.3). */
const CTA_ICON_COLOR = '#FFFFFF';
/** Approximate chrome height for slide-off (buttons + padding; safe area added at runtime). */
const FOOTER_CHROME_BASE = 84;

type StepFooterNavProps = {
  completeLabel?: string;
  /** Same shared value as the reading header — tap/scroll hides both. */
  chromeVisibleShared?: SharedValue<boolean>;
};

export default function StepFooterNav({
  completeLabel = 'Completar Núcleo',
  chromeVisibleShared,
}: StepFooterNavProps) {
  const session = useAppSession();
  const insets = useSafeAreaInsets();
  const showStepFooter = !session.viewAll && !session.isComplete;
  const totalReadingPages = session.totalSteps + 1;
  const hideDistance = FOOTER_CHROME_BASE + insets.bottom;

  const footerStyle = useAnimatedStyle(() => {
    if (!chromeVisibleShared) {
      return { transform: [{ translateY: 0 }], opacity: 1 };
    }
    const visible = chromeVisibleShared.value;
    return {
      transform: [
        {
          translateY: withTiming(visible ? 0 : hideDistance, { duration: 250 }),
        },
      ],
      opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
    };
  });

  const footerAnimatedProps = useAnimatedProps(() => {
    if (!chromeVisibleShared) {
      return { pointerEvents: 'auto' as const };
    }
    return {
      pointerEvents: chromeVisibleShared.value ? ('auto' as const) : ('none' as const),
    };
  });

  if (!showStepFooter) return null;

  return (
    <Animated.View
      animatedProps={footerAnimatedProps}
      style={footerStyle}
      className="border-t border-neutral-200 border-white/10 bg-base"
    >
      <View
        className="px-7"
        style={{ paddingTop: 16, paddingBottom: insets.bottom + 16 }}
      >
        {session.currentStep === 0 ? (
          session.isStreamGenerating ? (
            <View>
              <GenerationProgressBar
                progressShared={session.streamProgressShared}
                fullWidth
                height={2}
                style={styles.footerProgress}
              />
              <StepFooterGlassButton
                variant="primary"
                label="Generando pasos…"
                disabled
                onPress={() => undefined}
              />
            </View>
          ) : (
            <StepFooterGlassButton
              variant="primary"
              label="Explorar el Núcleo"
              onPress={() => session.goToStep(1)}
            />
          )
        ) : (
          <View className="flex-row gap-3" style={styles.row}>
            <View style={styles.backSlot}>
              <StepFooterGlassButton
                variant="secondary"
                label="Atrás"
                onPress={() => session.goToStep(session.currentStep - 1)}
              />
            </View>
            <View style={styles.forwardSlot}>
              {session.currentStep < totalReadingPages ? (
                <StepFooterGlassButton
                  variant="primary"
                  label="Siguiente"
                  onPress={() => session.goToStep(session.currentStep + 1)}
                />
              ) : (
                <StepFooterGlassButton
                  variant="primary"
                  label={completeLabel}
                  onPress={session.handleCompleteMap}
                  icon={<Check size={20} color={CTA_ICON_COLOR} />}
                  iconPlacement="leading"
                />
              )}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    alignItems: 'stretch',
  },
  /** Fixed-ish width so Liquid Glass is not crushed / edge-clipped next to Siguiente. */
  backSlot: {
    width: 108,
    flexGrow: 0,
    flexShrink: 0,
  },
  forwardSlot: {
    flex: 1,
    minWidth: 0,
  },
  footerProgress: {
    width: '100%',
    marginBottom: 8,
  },
});
