import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import { WebView } from 'react-native-webview';
import { BG_BASE } from '@shared/uiTokens';
import { color } from '@shared/design-tokens';

/** Approximate height for 6 rows × ~90px in the gallery HTML. */
const GALLERY_HEIGHT = 560;

type ThinkingOrbsGalleryWebViewProps = {
  height?: number;
};

/**
 * DEV gallery: all thinking-orbs states (64 + 20) via bundled HTML asset.
 */
export default function ThinkingOrbsGalleryWebView({
  height = GALLERY_HEIGHT,
}: ThinkingOrbsGalleryWebViewProps) {
  const [htmlUri, setHtmlUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/thinking-orbs-gallery.html'));
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

  if (!htmlUri) {
    return <View style={[styles.shell, { height }]} />;
  }

  const common = {
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
  };

  return (
    <View style={[styles.shell, { height }]}>
      {Platform.OS === 'ios' ? (
        <WebView
          {...common}
          source={{ uri: htmlUri }}
          opaque={false}
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
  shell: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: BG_BASE,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
