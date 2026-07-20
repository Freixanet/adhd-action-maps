import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { ACCENT, RADII, TEXT_PRIMARY } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import { privacyPolicyUrl, termsOfUseUrl } from '../logic/legalUrls';
import {
  fetchProOfferings,
  isRevenueCatConfigured,
  purchaseProPackage,
  restoreProPurchases,
  type ProOfferingPackage,
} from '../logic/proPurchases';
import { stepHaptic } from '../context/AppSessionContext';

const BENEFITS = [
  'Núcleos ilimitados',
  'Profundidad Profunda',
  'Preguntar sobre la fuente',
  'Ficha PDF sin marca de agua',
] as const;

type PaywallSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export default function PaywallSheet({ visible, onClose }: PaywallSheetProps) {
  const [packages, setPackages] = useState<ProOfferingPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const configured = isRevenueCatConfigured();

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    void fetchProOfferings()
      .then((offerings) => {
        if (!cancelled) setPackages(offerings.packages);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const monthly = packages.find((pkg) => pkg.packageType === 'monthly');
  const annual = packages.find((pkg) => pkg.packageType === 'annual') ?? packages[0];
  const selected = annual ?? monthly ?? packages[0];

  const openLink = useCallback(async (url: string, label: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No se pudo abrir', `No se pudo abrir ${label}.`);
    }
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!selected) {
      Alert.alert(
        'Pronto disponible',
        configured
          ? 'No hay productos Pro cargados todavía. Revisa RevenueCat / App Store Connect.'
          : 'Configura EXPO_PUBLIC_REVENUECAT_API_KEY y un build con react-native-purchases para comprar.'
      );
      return;
    }
    setBusy(true);
    try {
      const ok = await purchaseProPackage(selected.id);
      if (ok) {
        stepHaptic();
        onClose();
      } else {
        Alert.alert('Compra', 'La compra no activó Pro. Prueba Restaurar compra.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar la compra.';
      if (!/cancel/i.test(message)) {
        Alert.alert('Compra', message);
      }
    } finally {
      setBusy(false);
    }
  }, [configured, onClose, selected]);

  const handleRestore = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await restoreProPurchases();
      if (ok) {
        stepHaptic();
        onClose();
      } else {
        Alert.alert('Restaurar', 'No encontramos una compra Pro en esta cuenta.');
      }
    } catch (err) {
      Alert.alert(
        'Restaurar',
        err instanceof Error ? err.message : 'No se pudo restaurar la compra.'
      );
    } finally {
      setBusy(false);
    }
  }, [onClose]);

  const priceLine = (() => {
    if (loading) return 'Cargando precios…';
    if (selected?.priceString) {
      const period = selected.packageType === 'annual' ? 'año' : 'mes';
      return `${selected.priceString}/${period} · se renueva automáticamente, cancela cuando quieras`;
    }
    return 'Precio según App Store · se renueva automáticamente, cancela cuando quieras';
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={styles.sheetHost} pointerEvents="box-none">
          <GlassSurface liquid borderRadius={RADII.lg} style={styles.sheet}>
            <View className="px-5 pt-5 pb-6">
              <Text className="text-[13px] font-bold uppercase tracking-widest text-secondary">
                nucleo pro
              </Text>
              <Text className="mt-2 text-[26px] font-extrabold text-primary">
                Todo el foco, sin límites
              </Text>

              <View className="mt-5 gap-3">
                {BENEFITS.map((benefit) => (
                  <View key={benefit} className="flex-row items-center gap-3">
                    <Check size={18} color={ACCENT} strokeWidth={2.5} />
                    <Text className="flex-1 text-[15px] text-body">{benefit}</Text>
                  </View>
                ))}
              </View>

              <View className="mt-6 gap-2">
                {annual ? (
                  <View className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
                    <Text className="text-[12px] font-semibold uppercase tracking-wide text-accent">
                      Anual · 2 meses gratis
                    </Text>
                    <Text className="mt-1 text-[16px] font-semibold text-primary">
                      {annual.priceString ?? 'Precio App Store'}
                    </Text>
                  </View>
                ) : null}
                {monthly ? (
                  <View className="rounded-2xl border border-white/10 px-4 py-3">
                    <Text className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
                      Mensual
                    </Text>
                    <Text className="mt-1 text-[16px] font-semibold text-primary">
                      {monthly.priceString ?? 'Precio App Store'}
                    </Text>
                  </View>
                ) : null}
                {!annual && !monthly && !loading ? (
                  <Text className="text-[14px] text-secondary">
                    Los importes se cargan desde la tienda cuando RevenueCat esté configurado.
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={() => {
                  void handlePurchase();
                  stepHaptic();
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Probar 7 días gratis"
                className="mt-6 items-center justify-center rounded-full bg-accent px-5 py-4 active:opacity-90"
                style={{ opacity: busy ? 0.7 : 1 }}
              >
                {busy ? (
                  <ActivityIndicator color={TEXT_PRIMARY} />
                ) : (
                  <Text className="text-[16px] font-bold text-primary">Probar 7 días gratis</Text>
                )}
              </Pressable>

              <Text className="mt-3 text-center text-[12px] leading-5 text-secondary">{priceLine}</Text>

              <View className="mt-4 flex-row flex-wrap items-center justify-center gap-x-2 gap-y-1">
                <Pressable onPress={() => void handleRestore()} accessibilityRole="button">
                  <Text className="text-[12px] text-secondary underline">Restaurar compra</Text>
                </Pressable>
                <Text className="text-[12px] text-secondary">·</Text>
                <Pressable
                  onPress={() => void openLink(termsOfUseUrl(), 'Términos')}
                  accessibilityRole="link"
                >
                  <Text className="text-[12px] text-secondary underline">Términos</Text>
                </Pressable>
                <Text className="text-[12px] text-secondary">·</Text>
                <Pressable
                  onPress={() => void openLink(privacyPolicyUrl(), 'Privacidad')}
                  accessibilityRole="link"
                >
                  <Text className="text-[12px] text-secondary underline">Privacidad</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                className="mt-4 items-center py-2"
              >
                <Text className="text-[14px] text-secondary">Ahora no</Text>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetHost: {
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  sheet: {
    width: '100%',
  },
});
