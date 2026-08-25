import React, { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { X } from '../icons';
import { SEM_ALERTA, TEXT_SECONDARY } from '@shared/uiTokens';
import { useAppSession } from '../context/AppSessionContext';
import { useNetworkStatus } from '../context/NetworkStatusContext';
import { motion, color, type } from '@shared/design-tokens';

const CLOSE_HIT_SLOP = { top: 14, right: 14, bottom: 14, left: 14 };
const OFFLINE_MESSAGE = 'Sin conexión. Comprueba tu red y vuelve a intentarlo.';

/** Home must not import pendingApplicationOps — that module cycles and the named export can be undefined at render. */
function isApplicationSyncHomeCopy(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    message === 'Sincronización del plan de aplicación pendiente' ||
    message === 'Inicio de acción pendiente de sincronizar' ||
    message === 'Revisión pendiente de sincronizar' ||
    message === 'Replanificación pendiente de sincronizar' ||
    message === 'El plan de aplicación aún no se ha guardado.'
  );
}

type SessionErrorBannerProps = {
  className?: string;
  inline?: boolean;
};

/**
 * Product banner for transform errors OR the stable sync notice.
 * Sync copy comes from deriveSyncNotice — never last-writer-wins on setError.
 */
export default function SessionErrorBanner({ className = '', inline = false }: SessionErrorBannerProps) {
  const session = useAppSession();
  const { isOffline } = useNetworkStatus();
  const shakeX = useSharedValue(0);
  const retryBlockedRef = useRef(false);
  const lastAnnouncedKeyRef = useRef<string | null>(null);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-6, { duration: motion.feedback.duration }),
      withTiming(6, { duration: motion.feedback.duration }),
      withTiming(-4, { duration: motion.feedback.duration }),
      withTiming(0, { duration: motion.feedback.duration })
    );
  }, [shakeX]);

  const sync = session.syncNotice;
  const status = session.inlineGenerationStatus;
  const syncPending = Boolean(sync?.visible);

  if (session.transformIncomplete) {
    return null;
  }

  // Prefer stable sync notice over competing session.error strings.
  // Home (idle, not inline) is not a map surface — don't show leftover
  // application/source pending from the last opened Núcleo.
  if (syncPending && sync && (inline || status !== 'idle')) {
    if (
      !inline &&
      status !== 'idle' &&
      status !== 'error' &&
      status !== 'cancelled' &&
      status !== 'ready'
    ) {
      return null;
    }

    const canRetry = Boolean(sync.retryLabel) && !isOffline;
    const liveRegion =
      lastAnnouncedKeyRef.current === sync.liveRegionKey ? undefined : 'polite';
    if (liveRegion) lastAnnouncedKeyRef.current = sync.liveRegionKey;

    return (
      <View
        className={`mb-2 ${className}`.trim()}
        accessibilityLiveRegion={liveRegion}
        key={sync.liveRegionKey}
      >
        <Animated.View style={shakeStyle}>
          <View className="rounded-card overflow-hidden">
            <View className="bg-surface px-4 py-3">
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: SEM_ALERTA, opacity: 0.05 }]}
              />
              <View className="flex-row items-start gap-3">
                <View className="flex-1">
                  <Text
                    className="text-label font-semibold uppercase"
                    style={{ color: SEM_ALERTA }}
                  >
                    {sync.title}
                  </Text>
                  <Text className="mt-2 text-sm leading-5 text-body">
                    {isOffline ? OFFLINE_MESSAGE : sync.message}
                  </Text>
                </View>
                <Pressable
                  onPress={() => session.dismissSyncNotice?.()}
                  hitSlop={CLOSE_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar aviso"
                  className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full active:opacity-70"
                >
                  <X size={16} color={TEXT_SECONDARY} />
                </Pressable>
              </View>
              {canRetry ? (
                <Pressable
                  onPress={() => {
                    if (isOffline) {
                      if (retryBlockedRef.current) return;
                      retryBlockedRef.current = true;
                      triggerShake();
                      setTimeout(() => {
                        retryBlockedRef.current = false;
                      }, 220);
                      return;
                    }
                    void session.handleOrderedPersistRetry?.();
                  }}
                  className="mt-3 self-start rounded-xl bg-accent px-4 py-2.5 active:opacity-90"
                  accessibilityRole="button"
                  accessibilityLabel={sync.retryLabel ?? 'Reintentar sincronización'}
                >
                  <Text className="text-sm font-semibold text-inverse">
                    {sync.retryLabel ?? 'Reintentar sincronización'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  if (!session.error) {
    return null;
  }

  if (
    !inline &&
    status === 'idle' &&
    isApplicationSyncHomeCopy(session.error)
  ) {
    return null;
  }

  if (
    !inline &&
    status !== 'idle' &&
    status !== 'error' &&
    status !== 'cancelled'
  ) {
    return null;
  }

  const displayMessage = isOffline ? OFFLINE_MESSAGE : session.error;
  const canRetry = inline
    ? status === 'error' || status === 'cancelled'
    : session.phase === 'input' && (session.canSubmit || status === 'cancelled');

  return (
    <View className={`mb-2 ${className}`.trim()} accessibilityLiveRegion="polite">
      <Animated.View style={shakeStyle}>
        <View className="rounded-card overflow-hidden">
          <View className="bg-surface px-4 py-3">
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: SEM_ALERTA, opacity: 0.05 }]}
            />
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <Text
                  className="text-label font-semibold uppercase"
                  style={{ color: SEM_ALERTA }}
                >
                  {status === 'cancelled' ? 'Cancelado' : 'Error'}
                </Text>
                <Text className="mt-2 text-sm leading-5 text-body">{displayMessage}</Text>
              </View>
              <Pressable
                onPress={() => session.setError(null)}
                hitSlop={CLOSE_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="Cerrar aviso"
                className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full active:opacity-70"
              >
                <X size={16} color={TEXT_SECONDARY} />
              </Pressable>
            </View>
            {canRetry ? (
              <Pressable
                onPress={() => {
                  if (isOffline) {
                    if (retryBlockedRef.current) return;
                    retryBlockedRef.current = true;
                    triggerShake();
                    setTimeout(() => {
                      retryBlockedRef.current = false;
                    }, 220);
                    return;
                  }
                  void session.handleTransform();
                }}
                className="mt-3 self-start rounded-xl bg-accent px-4 py-2.5 active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel="Reintentar"
              >
                <Text className="text-sm font-semibold text-inverse">Reintentar</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
