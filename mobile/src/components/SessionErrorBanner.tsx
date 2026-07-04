import React, { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { SEM_ALERTA } from '@shared/uiTokens';
import { useAppSession } from '../context/AppSessionContext';
import { useNetworkStatus } from '../context/NetworkStatusContext';

const CLOSE_HIT_SLOP = { top: 14, right: 14, bottom: 14, left: 14 };
const OFFLINE_MESSAGE = 'Sin conexión. Comprueba tu red y vuelve a intentarlo.';

type SessionErrorBannerProps = {
  className?: string;
  inline?: boolean;
};

export default function SessionErrorBanner({ className = '', inline = false }: SessionErrorBannerProps) {
  const session = useAppSession();
  const { isOffline } = useNetworkStatus();
  const shakeX = useSharedValue(0);
  const retryBlockedRef = useRef(false);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-6, { duration: 45 }),
      withTiming(6, { duration: 45 }),
      withTiming(-4, { duration: 45 }),
      withTiming(0, { duration: 45 })
    );
  }, [shakeX]);

  if (!session.error || session.transformIncomplete) {
    return null;
  }

  if (!inline && session.inlineGenerationStatus !== 'idle' && session.inlineGenerationStatus !== 'error') {
    return null;
  }

  const displayMessage = isOffline ? OFFLINE_MESSAGE : session.error;
  const canRetry = inline
    ? session.inlineGenerationStatus === 'error'
    : session.phase === 'input' && session.canSubmit;

  const handleRetry = () => {
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
  };

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
                  className="text-[13px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: SEM_ALERTA }}
                >
                  Error
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
                <X size={16} color="#9CA0AB" />
              </Pressable>
            </View>
            {canRetry ? (
              <Pressable
                onPress={handleRetry}
                className="mt-3 self-start rounded-xl bg-accent px-4 py-2.5 active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel="Reintentar"
              >
                <Text className="text-sm font-semibold text-[#0B0B0E]">Reintentar</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
