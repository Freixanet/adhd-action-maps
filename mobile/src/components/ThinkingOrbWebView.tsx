import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Asset } from 'expo-asset';
import { WebView, type WebView as WebViewType } from 'react-native-webview';
import type { ThinkingOrbState } from '@shared/resolveThinkingOrbState';
import { color } from '@shared/design-tokens';

type ThinkingOrbWebViewProps = {
  state: ThinkingOrbState;
  /** thinking-orbs only ships 20 and 64. */
  size?: 20 | 64;
  speed?: number;
  paused?: boolean;
  theme?: 'dark' | 'light' | 'auto';
  style?: StyleProp<ViewStyle>;
};

function buildConfigScript(config: {
  state: ThinkingOrbState;
  size: 20 | 64;
  speed: number;
  paused: boolean;
  theme: 'dark' | 'light' | 'auto';
}): string {
  return `
    window.__THINKING_ORB__ = ${JSON.stringify(config)};
    window.dispatchEvent(new Event('nucleo-thinking-orb'));
    (function () {
      var nodes = [document.documentElement, document.body, document.getElementById('root')];
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i]) nodes[i].style.backgroundColor = 'transparent';
      }
    })();
    true;
  `;
}

/**
 * Production host for a single thinking-orbs canvas state.
 * Drive transitions by changing `state` — injected into the WebView.
 */
export default function ThinkingOrbWebView({
  state,
  size = 64,
  speed = 1,
  paused = false,
  theme = 'dark',
  style,
}: ThinkingOrbWebViewProps) {
  const webRef = useRef<WebViewType>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const config = useMemo(
    () => ({ state, size, speed, paused, theme }),
    [paused, size, speed, state, theme]
  );
  const configScript = useMemo(() => buildConfigScript(config), [config]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/thinking-orb-live.html'));
        await asset.downloadAsync();
        if (!cancelled) setHtmlUri(asset.localUri ?? asset.uri);
      } catch {
        if (!cancelled) setHtmlUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(configScript);
  }, [configScript, ready]);

  const shellSize = size === 20 ? 28 : 72;

  const common = {
    ref: webRef,
    style: styles.webview,
    containerStyle: styles.webviewContainer,
    scrollEnabled: false as const,
    bounces: false,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    automaticallyAdjustContentInsets: false,
    originWhitelist: ['*'] as string[],
    javaScriptEnabled: true,
    domStorageEnabled: false,
    incognito: true,
    overScrollMode: 'never' as const,
    nestedScrollEnabled: false,
    backgroundColor: color.background.transparent,
    injectedJavaScriptBeforeContentLoaded: configScript,
    injectedJavaScript: configScript,
    onLoadEnd: () => setReady(true),
  };

  if (!htmlUri) {
    return <View style={[{ width: shellSize, height: shellSize }, style]} />;
  }

  return (
    <View
      style={[{ width: shellSize, height: shellSize, overflow: 'hidden' }, style]}
      pointerEvents="none"
      collapsable={false}
      accessibilityRole="image"
      accessibilityLabel={`Generando · ${state}`}
    >
      {Platform.OS === 'ios' ? (
        <WebView
          {...common}
          source={{ uri: htmlUri }}
          dataDetectorTypes="none"
          allowsLinkPreview={false}
          contentInsetAdjustmentBehavior="never"
        />
      ) : (
        <WebView {...common} source={{ uri: htmlUri }} setSupportMultipleWindows={false} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
