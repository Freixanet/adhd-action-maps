import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import { hapticCommit } from '../logic/haptics';
import { type, color } from '@shared/design-tokens';

type ApplicationReplanConfirmDialogProps = {
  visible: boolean;
  started?: boolean;
  hasReview?: boolean;
  busy?: boolean;
  onKeepCurrent: () => void;
  onReplace: () => void;
};

/**
 * Explicit confirmation when replacing a started or reviewed application plan.
 * Not a network-error banner — keep / replace only.
 */
export default function ApplicationReplanConfirmDialog({
  visible,
  started,
  hasReview,
  busy,
  onKeepCurrent,
  onReplace,
}: ApplicationReplanConfirmDialogProps) {
  const detail =
    started && hasReview
      ? 'Ya lo empezaste y dejaste una revisión. Reemplazarlo archiva ese progreso en favor de la nueva adaptación.'
      : started
        ? 'Ya lo empezaste. Reemplazarlo archiva ese inicio en favor de la nueva adaptación.'
        : hasReview
          ? 'Ya lo revisaste. Reemplazarlo archiva esa revisión en favor de la nueva adaptación.'
          : 'Reemplazarlo cambia el plan activo de este mapa.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepCurrent}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onKeepCurrent}
          accessibilityLabel="Conservar plan actual"
        />
        <View style={styles.sheetHost} pointerEvents="box-none">
          <GlassSurface liquid borderRadius={RADII.lg} style={styles.sheet}>
            <View className="px-5 pt-5 pb-6">
              <Text className="text-label font-bold uppercase tracking-widest text-secondary">
                Replanificar
              </Text>
              <Text className="mt-2 text-page-title font-extrabold leading-7 text-primary">
                Este plan ya se empezó o revisó
              </Text>
              <Text className="mt-3 text-body leading-6 text-body">{detail}</Text>

              <Pressable
                onPress={() => {
                  if (busy) return;
                  hapticCommit();
                  onReplace();
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Reemplazar con la nueva adaptación"
                className={`mt-6 items-center justify-center rounded-full bg-accent px-5 py-4 ${
                  busy ? 'opacity-50' : 'active:opacity-90'
                }`}
              >
                <Text className="text-title font-bold text-primary">
                  Reemplazar con la nueva adaptación
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (busy) return;
                  onKeepCurrent();
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Conservar plan actual"
                className="mt-3 items-center py-3"
              >
                <Text className="text-body text-secondary">Conservar plan actual</Text>
              </Pressable>
            </View>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.background.overlay,
    justifyContent: 'flex-end',
  },
  sheetHost: {
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  sheet: {
    overflow: 'hidden',
  },
});
