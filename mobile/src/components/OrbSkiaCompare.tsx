import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import ExactLiquidOrbWebView from './ExactLiquidOrbWebView';
import LiquidOrbSkia from './LiquidOrbSkia';
import NucleoOrb from './NucleoOrb';
import OrbHtmlIterationWebView from './OrbHtmlIterationWebView';

const COMPARE_SIZE = 72;

type OrbSkiaCompareProps = {
  visible: boolean;
  onClose: () => void;
};

function ComparePanel({
  label,
  subtitle,
  backgroundClassName,
  children,
}: {
  label: string;
  subtitle?: string;
  backgroundClassName: string;
  children: React.ReactNode;
}) {
  return (
    <View className="min-w-0 flex-1 items-center">
      <Text className="mb-0.5 text-center text-[11px] font-medium text-secondary">{label}</Text>
      {subtitle ? (
        <Text className="mb-2 text-center text-[10px] text-secondary/70">{subtitle}</Text>
      ) : (
        <View className="mb-2 h-[14px]" />
      )}
      <View className={`w-full items-center justify-center rounded-2xl p-2 ${backgroundClassName}`}>
        {children}
      </View>
    </View>
  );
}

/** Dev-only side-by-side WebView vs Skia vs HTML iteration validation. */
export default function OrbSkiaCompare({ visible, onClose }: OrbSkiaCompareProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (!visible) return;
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, [visible]);

  if (!__DEV__) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-base/95">
        <ScrollView
          contentContainerClassName="items-center px-3 py-10"
          showsVerticalScrollIndicator={false}
        >
          <Text className="mb-2 text-center text-[15px] font-semibold text-primary">
            Orb compare
          </Text>
          <Text className="mb-6 text-center text-[12px] text-secondary">
            Producción · Legacy · Skia · HTML iter.
          </Text>

          <View className="mb-6 w-full max-w-[420px] flex-row items-start justify-center gap-2">
            <ComparePanel label="Producción" subtitle="Three.js" backgroundClassName="bg-base">
              <NucleoOrb size={COMPARE_SIZE} state="thinking" glow reduceMotion={reduceMotion} />
            </ComparePanel>
            <ComparePanel label="WebView legacy" backgroundClassName="bg-base">
              <ExactLiquidOrbWebView size={COMPARE_SIZE} reduceMotion={reduceMotion} />
            </ComparePanel>
            <ComparePanel label="Skia" backgroundClassName="bg-base">
              <LiquidOrbSkia size={COMPARE_SIZE} reduceMotion={reduceMotion} />
            </ComparePanel>
          </View>

          <View className="mb-6 w-full max-w-[280px] flex-row items-start justify-center gap-2">
            <ComparePanel
              label="HTML iter."
              subtitle="tap fondo"
              backgroundClassName="bg-base"
            >
              <OrbHtmlIterationWebView size={COMPARE_SIZE} reduceMotion={false} />
            </ComparePanel>
          </View>

          <View className="mb-6 w-full max-w-[320px] flex-row items-start justify-center gap-2">
            <ComparePanel label="Skia · card" backgroundClassName="border border-white/10 bg-surface-2">
              <LiquidOrbSkia size={COMPARE_SIZE} reduceMotion={reduceMotion} />
            </ComparePanel>
            <ComparePanel
              label="HTML iter. · card"
              subtitle="tap fondo"
              backgroundClassName="border border-white/10 bg-surface-2"
            >
              <OrbHtmlIterationWebView size={COMPARE_SIZE} reduceMotion={false} />
            </ComparePanel>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar comparación de orbe"
            className="rounded-full bg-surface-2 px-5 py-2.5 active:opacity-80"
          >
            <Text className="text-[14px] font-medium text-primary">Cerrar</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
