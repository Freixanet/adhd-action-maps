import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BG_BASE } from '@shared/uiTokens';
import NucleoOrb from './NucleoOrb';
import NucleoGlyphOrb from './NucleoGlyphOrb';

const COMPARE_SIZE = 72;

type OrbSkiaCompareProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Dev preview: keeps the current Three.js / atom production orb for comparison,
 * side-by-side with the loading glyph orb.
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
          style={{ top: insets.top + 16 }}
          pointerEvents="box-none"
        >
          <Text className="text-center text-[15px] font-semibold text-primary">Orb preview</Text>
          <Text className="mt-1 text-center text-[12px] text-secondary">
            Carga (glifo) · Three.js (actual)
          </Text>
        </View>

        <View className="flex-1 items-center justify-center gap-14 px-6">
          <View className="items-center">
            <NucleoGlyphOrb size={COMPARE_SIZE} reduceMotion={reduceMotion} />
            <Text className="mt-3 text-[12px] text-secondary">Glifo · carga</Text>
          </View>
          <View className="items-center">
            <NucleoOrb size={COMPARE_SIZE} state="thinking" reduceMotion={reduceMotion} />
            <Text className="mt-3 text-[12px] text-secondary">Three.js · conservado</Text>
          </View>
        </View>

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
            <Text className="text-[14px] font-medium text-primary">Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
