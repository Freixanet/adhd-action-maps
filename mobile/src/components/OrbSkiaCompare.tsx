import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BG_BASE } from '@shared/uiTokens';
import NucleoOrb from './NucleoOrb';
import NucleoGlyphOrb from './NucleoGlyphOrb';
import ThinkingOrbsGalleryWebView from './ThinkingOrbsGalleryWebView';

const COMPARE_SIZE = 72;

type OrbSkiaCompareProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Dev preview: production orbs + full thinking-orbs gallery to pick a replacement.
 */
export default function OrbSkiaCompare({ visible, onClose }: OrbSkiaCompareProps) {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (!visible) return;
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, [visible]);

  if (!__DEV__) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: BG_BASE }}>
        <View
          className="absolute left-0 right-0 z-10 items-center px-3"
          style={{ top: insets.top + 12 }}
          pointerEvents="box-none"
        >
          <Text className="text-center text-lg font-semibold text-primary">Orb preview</Text>
          <Text className="mt-1 text-center text-xs text-secondary">
            Actual · thinking-orbs (elige uno)
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom + 88,
            paddingHorizontal: 20,
            gap: 28,
          }}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <View className="gap-4">
            <Text className="text-xs font-bold uppercase tracking-widest text-secondary">
              Actual
            </Text>
            <View className="flex-row items-center justify-around">
              <View className="items-center">
                <NucleoGlyphOrb size={COMPARE_SIZE} reduceMotion={reduceMotion} />
                <Text className="mt-3 text-xs text-secondary">Glifo · carga</Text>
              </View>
              <View className="items-center">
                <NucleoOrb size={COMPARE_SIZE} state="thinking" reduceMotion={reduceMotion} />
                <Text className="mt-3 text-xs text-secondary">Three.js</Text>
              </View>
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-xs font-bold uppercase tracking-widest text-secondary">
              thinking-orbs
            </Text>
            <Text className="text-xs leading-4 text-secondary">
              Seis estados · tamaño 64 y 20 · theme dark
            </Text>
            <ThinkingOrbsGalleryWebView />
          </View>
        </ScrollView>

        <View
          className="absolute left-0 right-0 items-center px-3"
          style={{ bottom: insets.bottom + 24 }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar vista previa del orbe"
            className="rounded-full bg-surface-2 px-5 py-2.5 active:opacity-80"
          >
            <Text className="text-base font-medium text-primary">Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
