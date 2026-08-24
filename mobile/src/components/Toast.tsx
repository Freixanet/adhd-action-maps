import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { radius, space, type, motion } from '@shared/design-tokens';
import { contentEntering } from '../motion/contentEnter';
import { useThemeColors } from '../context/ThemeContext';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';

type ToastMessage = {
  id: number;
  text: string;
};

type ToastContextValue = {
  showToast: (text: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_MS = 2200;

let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const { reduceMotion } = useGlassAccessibility();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = ++toastSeq;
    setToast({ id, text: trimmed });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, TOAST_MS);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={styles.host}>
          <Animated.View
            key={toast.id}
            entering={reduceMotion ? undefined : contentEntering()}
            exiting={reduceMotion ? undefined : FadeOut.duration(motion.exit.duration)}
            style={[
              styles.pill,
              {
                backgroundColor: colors.background.surfaceRaised,
                borderColor: colors.background.whiteFade10,
              },
            ]}
          >
            <Text
              style={{
                color: colors.text.primary,
                fontSize: type.callout.fontSize,
                lineHeight: type.callout.lineHeight,
              }}
              numberOfLines={2}
            >
              {toast.text}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {
        // No provider (tests) — no-op.
      },
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: space.stack.lg,
  },
  pill: {
    maxWidth: 360,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.stack.lg,
    paddingVertical: space.stack.sm,
  },
});
