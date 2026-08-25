import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ThinkingOrbWebView from './ThinkingOrbWebView';
import { useTheme } from '../context/ThemeContext';

type ChatThinkingIndicatorProps = {
  reduceMotion?: boolean;
};

/** Last-resort reveal if the WebView never reports load. */
const READY_FALLBACK_MS = 600;

/**
 * Chat wait state: thinking-orbs `solving` with the package caption
 * “Thinking…” (breathing’s aria-label), painted in the live host.
 */
export default function ChatThinkingIndicator({
  reduceMotion = false,
}: ChatThinkingIndicatorProps) {
  const { isDark } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), READY_FALLBACK_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View
      style={[styles.wrap, { opacity: ready ? 1 : 0.01 }]}
      accessibilityRole="text"
      accessibilityLabel="Thinking…"
    >
      <ThinkingOrbWebView
        state="solving"
        size={20}
        showLabel
        labelState="breathing"
        paused={reduceMotion}
        speed={reduceMotion ? 0 : 1.15}
        theme={isDark ? 'dark' : 'light'}
        onReady={() => setReady(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    minHeight: 28,
    alignItems: 'flex-start',
  },
});
