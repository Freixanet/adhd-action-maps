import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Asset } from 'expo-asset';
import { WebView } from 'react-native-webview';
import { nucleoOrbWebViewLayout } from './liquidOrbLayout';
import LiquidOrbSkia from './LiquidOrbSkia';

export type NucleoOrbState = 'idle' | 'thinking' | 'complete';

type NucleoOrbWebViewProps = {
  size?: number;
  state?: NucleoOrbState;
  glow?: boolean;
  interactive?: boolean;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
};

function buildConfigScript(config: {
  state: NucleoOrbState;
  glow: boolean;
  interactive: boolean;
  reduceMotion: boolean;
}): string {
  return `
    window.__NUCLEO_ORB__ = ${JSON.stringify(config)};
    (function () {
      var nodes = [document.documentElement, document.body, document.getElementById('root')];
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i]) nodes[i].style.backgroundColor = 'transparent';
      }
    })();
    true;
  `;
}

export default function NucleoOrbWebView({
  size = 96,
  state = 'thinking',
  glow = false,
  interactive = false,
  reduceMotion = false,
  style,
}: NucleoOrbWebViewProps) {
  const metrics = useMemo(() => nucleoOrbWebViewLayout(size), [size]);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);

  const configScript = useMemo(
    () => buildConfigScript({ state, glow, interactive, reduceMotion }),
    [glow, interactive, reduceMotion, state]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/nucleo-orb.html'));
        await asset.downloadAsync();
        if (!cancelled) {
          setHtmlUri(asset.localUri ?? asset.uri);
        }
      } catch {
        if (!cancelled) setHtmlUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The absolute wrapper (plain RN View) owns position and size; the WebView
  // just fills it. react-native-webview's default container has
  // overflow:'hidden', so it must be overridden or the bleed gets clipped.
  const bleedWrapperStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: -metrics.bleed,
      top: -metrics.bleed,
      width: metrics.canvas,
      height: metrics.canvas,
    }),
    [metrics.bleed, metrics.canvas]
  );

  const commonWebViewProps = {
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
    allowsBackForwardNavigationGestures: false,
    backgroundColor: 'transparent',
    injectedJavaScriptBeforeContentLoaded: configScript,
    injectedJavaScript: configScript,
  };

  if (!htmlUri) {
    return (
      <LiquidOrbSkia
        size={size}
        reduceMotion={reduceMotion}
        style={[{ width: metrics.displaySize, height: metrics.displaySize }, style]}
      />
    );
  }

  return (
    <View
      style={[
        styles.shell,
        { width: metrics.displaySize, height: metrics.displaySize },
        style,
      ]}
      pointerEvents={interactive ? 'auto' : 'none'}
      collapsable={false}
    >
      <View style={bleedWrapperStyle} pointerEvents={interactive ? 'auto' : 'none'}>
        {Platform.OS === 'ios' ? (
          <WebView
            {...commonWebViewProps}
            source={{ uri: htmlUri }}
            opaque={false}
            dataDetectorTypes="none"
            allowsLinkPreview={false}
            contentInsetAdjustmentBehavior="never"
            pointerEvents={interactive ? 'auto' : 'none'}
          />
        ) : (
          <WebView
            {...commonWebViewProps}
            source={{ uri: htmlUri }}
            androidLayerType="hardware"
            pointerEvents={interactive ? 'auto' : 'none'}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'visible',
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    alignSelf: 'center',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
