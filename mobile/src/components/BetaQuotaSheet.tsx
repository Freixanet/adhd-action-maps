import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import { stepHaptic } from '../context/AppSessionContext';
import { type } from '@shared/design-tokens';
import { useThemeColors } from '../context/ThemeContext';

type BetaQuotaSheetProps = {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
};

/**
 * Private-beta anon cap: ask for login instead of a red error toast.
 */
export default function BetaQuotaSheet({ visible, onClose, onLogin }: BetaQuotaSheetProps) {
  const colors = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={styles.sheetHost} pointerEvents="box-none">
          <GlassSurface liquid borderRadius={RADII.lg} style={styles.sheet}>
            <View className="px-5 pt-5 pb-6">
              <Text className="text-label font-bold uppercase tracking-widest text-secondary">
                beta
              </Text>
              <Text className="mt-2 text-heading font-extrabold leading-8 text-primary">
                Has usado tus 5 Núcleos gratis de hoy
              </Text>
              <Text className="mt-3 text-title leading-6 text-body">
                Inicia sesión para seguir, es gratis en beta
              </Text>

              <Pressable
                onPress={() => {
                  stepHaptic();
                  onLogin();
                }}
                accessibilityRole="button"
                accessibilityLabel="Iniciar sesión"
                className="mt-6 items-center justify-center rounded-full bg-accent px-5 py-4 active:opacity-90"
              >
                <Text className="text-title font-bold text-primary">Iniciar sesión</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  stepHaptic();
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel="Quizás mañana"
                className="mt-3 items-center py-3"
              >
                <Text className="text-body text-secondary">Quizás mañana</Text>
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
