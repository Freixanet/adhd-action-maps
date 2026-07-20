import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import StepFooterGlassButton from './StepFooterGlassButton';
import { GenerationProgressBar } from './loadingGenerationUi';
import { useAppSession } from '../context/AppSessionContext';

/** CTA icon over the solid step-footer primary fill (SPEC §3.3). */
const CTA_ICON_COLOR = '#FFFFFF';

type StepFooterNavProps = {
  completeLabel?: string;
};

export default function StepFooterNav({ completeLabel = 'Completar Núcleo' }: StepFooterNavProps) {
  const session = useAppSession();
  const insets = useSafeAreaInsets();
  const showStepFooter = !session.viewAll && !session.isComplete;
  const totalReadingPages = session.totalSteps + 1;

  if (!showStepFooter) return null;

  return (
    <View className="border-t border-neutral-200 border-white/10 bg-base">
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
              label="Ver mapa visual"
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
  },
  backSlot: {
    flex: 1,
    minWidth: 0,
  },
  forwardSlot: {
    flex: 2,
    minWidth: 0,
  },
  footerProgress: {
    width: '100%',
    marginBottom: 8,
  },
});
