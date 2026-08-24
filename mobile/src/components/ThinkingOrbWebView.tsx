import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Asset } from 'expo-asset';
import { WebView, type WebView as WebViewType } from 'react-native-webview';
import type { ThinkingOrbState } from '@shared/resolveThinkingOrbState';
import { color } from '@shared/design-tokens';

type ThinkingOrbWebViewProps = {
  state: ThinkingOrbState | 'breathing';
  /** thinking-orbs only ships 20 and 64. */
  size?: 20 | 64;
  speed?: number;
  paused?: boolean;
  theme?: 'dark' | 'light' | 'auto';
  /** Show a caption next to the canvas (package aria-label, or `labelState`). */
  showLabel?: boolean;
  /** If set, caption uses this state's package label instead of `state`. */
  labelState?: ThinkingOrbState | 'breathing';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Fires once when the live HTML has loaded (or failed). */
  onReady?: () => void;
};

let cachedHtmlUri: string | null = null;
let htmlUriLoad: Promise<string | null> | null = null;

function loadThinkingOrbHtmlUri(): Promise<string | null> {
  if (cachedHtmlUri) return Promise.resolve(cachedHtmlUri);
  if (!htmlUriLoad) {
    htmlUriLoad = (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/thinking-orb-live.html'));
        await asset.downloadAsync();
        cachedHtmlUri = asset.localUri ?? asset.uri;
        return cachedHtmlUri;
      } catch {
        htmlUriLoad = null;
        return null;
      }
    })();
  }
  return htmlUriLoad;
}

/** Warm the live HTML so chat/Núcleo orbs do not wait on Asset.fromModule. */
export function preloadThinkingOrbHtml(): void {
  void loadThinkingOrbHtmlUri();
}

function buildConfigScript(config: {
  state: ThinkingOrbState | 'breathing';
  size: 20 | 64;
  speed: number;
  paused: boolean;
  theme: 'dark' | 'light' | 'auto';
  showLabel: boolean;
  labelState?: ThinkingOrbState | 'breathing';
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
  accessibilityLabel,
  showLabel = false,
  labelState,
  onReady,
}: ThinkingOrbWebViewProps) {
  const webRef = useRef<WebViewType>(null);
  const onReadyRef = useRef(onReady);
  const didNotifyReady = useRef(false);
  const [htmlUri, setHtmlUri] = useState<string | null>(() => cachedHtmlUri);
  const [ready, setReady] = useState(false);

  onReadyRef.current = onReady;

  const notifyReady = () => {
    if (didNotifyReady.current) return;
    didNotifyReady.current = true;
    onReadyRef.current?.();
  };

  const config = useMemo(
    () => ({ state, size, speed, paused, theme, showLabel, ...(labelState ? { labelState } : {}) }),
    [labelState, paused, showLabel, size, speed, state, theme]
  );
  const configScript = useMemo(() => buildConfigScript(config), [config]);

  useEffect(() => {
    let cancelled = false;
    void loadThinkingOrbHtmlUri().then((uri) => {
      if (cancelled) return;
      setHtmlUri(uri);
      if (!uri) notifyReady();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(configScript);
  }, [configScript, ready]);

  const shellSize = size === 20 ? 28 : 72;
  const shellWidth = showLabel ? (size === 20 ? 168 : 240) : shellSize;

  const markLoaded = () => {
    setReady(true);
    notifyReady();
  };

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
    onLoadEnd: markLoaded,
  };

  if (!htmlUri) {
    return <View style={[{ width: shellWidth, height: shellSize }, style]} />;
  }

  return (
    <View
      style={[{ width: shellWidth, height: shellSize, overflow: 'hidden' }, style]}
      pointerEvents="none"
      collapsable={false}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `Generando · ${state}`}
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  webviewContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
