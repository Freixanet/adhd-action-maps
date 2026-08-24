/**
 * Hosts the official Originkit Round Carousel (CSS 3D `preserve-3d`) in a
 * WKWebView. React Native cannot keep a 3D ring; do not reimplement the physics.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { Asset } from 'expo-asset';
import { WebView, type WebView as WebViewType } from 'react-native-webview';
import { color, font, radius, space, type } from '@shared/design-tokens';
import type { HistoryEntry } from '@shared/history';
import { useHomeSheetGestureLock } from '../context/HomeSheetGestureLock';
import { useTheme } from '../context/ThemeContext';
import { buildNucleoRoundCarouselFaces } from '../logic/buildNucleoRoundCarouselFaces';
import { roundCarouselLook, roundCarouselStageHeight } from '../logic/roundCarouselGeometry';
import {
  RECENT_NUCLEO_CARD_WIDTH_MAX,
  RECENT_NUCLEO_CARD_WIDTH_MIN,
  RECENT_NUCLEO_COVER_RATIO,
} from './RecentNucleoCard';

type RoundJumpBackCarouselProps = {
  items: readonly HistoryEntry[];
  onSelect: (id: string) => void;
};

type HostMessage = {
  type?: string;
  id?: string;
};

function buildConfigScript(config: {
  images: Array<{ id: string; title: string; photo: string | null; svg: string }>;
  imageWidth: number;
  imageHeight: number;
  cornerRadius: number;
  spacing: number;
  tilt: number;
  perspective: number;
  paint: {
    canvas: string;
    accentSoft: string;
    textPrimary: string;
    coverRatio: number;
    padX: number;
    padBottom: number;
    titleSize: number;
    titleLineHeight: number;
    titleWeight: number | string;
    fontFamily: string;
  };
}): string {
  return `
    window.__NUCLEO_ROUND__ = ${JSON.stringify(config)};
    window.dispatchEvent(new CustomEvent('nucleo-round', { detail: window.__NUCLEO_ROUND__ }));
    (function () {
      var nodes = [document.documentElement, document.body, document.getElementById('root')];
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i]) nodes[i].style.backgroundColor = 'transparent';
      }
    })();
    true;
  `;
}

export default function RoundJumpBackCarousel({ items, onSelect }: RoundJumpBackCarouselProps) {
  const { colors } = useTheme();
  const sheetGestureLock = useHomeSheetGestureLock();
  const setSheetLocked = sheetGestureLock?.setLocked;
  const { width: windowWidth } = useWindowDimensions();
  const webRef = useRef<WebViewType>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const cardWidth = Math.round(
    Math.min(
      RECENT_NUCLEO_CARD_WIDTH_MAX,
      Math.max(RECENT_NUCLEO_CARD_WIDTH_MIN, windowWidth * 0.52)
    )
  );
  const look = roundCarouselLook(items.length);
  // Originkit clips overflow. Stage height follows tilt so top radius and
  // bottom shadow stay inside the WebView — extra tilt for 6 faces needs more.
  const stageHeight = roundCarouselStageHeight(
    cardWidth,
    items.length,
    look,
    space.stack.xl + space.stack.lg
  );

  const [faces, setFaces] = useState<
    Array<{ id: string; title: string; photo: string | null; svg: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void buildNucleoRoundCarouselFaces(items, cardWidth, colors).then((next) => {
      if (!cancelled) setFaces(next);
    });
    return () => {
      cancelled = true;
    };
  }, [cardWidth, colors, items]);

  const config = useMemo(
    () => ({
      images: faces,
      imageWidth: cardWidth,
      imageHeight: cardWidth,
      cornerRadius: radius.card,
      spacing: look.spacing,
      tilt: look.tilt,
      perspective: look.perspective,
      paint: {
        canvas: colors.background.canvas,
        accentSoft: colors.background.accentSoft,
        textPrimary: colors.text.primary,
        coverRatio: RECENT_NUCLEO_COVER_RATIO,
        padX: space.stack.md,
        padBottom: space.stack.sm,
        titleSize: type.continueTitle.fontSize,
        titleLineHeight: type.continueTitle.lineHeight,
        titleWeight: type.continueTitle.fontWeight,
        fontFamily: font.family,
      },
    }),
    [cardWidth, colors, faces, look.perspective, look.spacing, look.tilt]
  );
  const configScript = useMemo(() => buildConfigScript(config), [config]);
  const allowedIds = useMemo(() => new Set(items.map((entry) => entry.id)), [items]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/round-carousel.html'));
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

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    let payload: HostMessage | null = null;
    try {
      payload = JSON.parse(event.nativeEvent.data) as HostMessage;
    } catch {
      return;
    }
    if (payload.type === 'ready') {
      setReady(true);
      return;
    }
    if (payload.type === 'select' && typeof payload.id === 'string' && allowedIds.has(payload.id)) {
      onSelect(payload.id);
    }
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
    onLoadEnd: () => setReady(true),
    onMessage,
  };

  const claimGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-28, 28])
        .cancelsTouchesInView(false)
        .onStart(() => {
          if (setSheetLocked) scheduleOnRN(setSheetLocked, true);
        })
        .onFinalize(() => {
          if (setSheetLocked) scheduleOnRN(setSheetLocked, false);
        }),
    [setSheetLocked]
  );

  const accessibilityLabel = `Carrusel de Núcleos: ${items
    .map((entry) => entry.title)
    .join(', ')}. Desliza para girar, toca para abrir.`;

  return (
    <View
      style={[styles.stage, { height: stageHeight }]}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      collapsable={false}
    >
      {htmlUri ? (
        <GestureDetector gesture={claimGesture}>
          <View style={styles.webviewHost} collapsable={false}>
            {Platform.OS === 'ios' ? (
              <WebView
                {...common}
                source={{ uri: htmlUri }}
                dataDetectorTypes="none"
                allowsLinkPreview={false}
                contentInsetAdjustmentBehavior="never"
                allowsBackForwardNavigationGestures={false}
                {...({ opaque: false } as object)}
              />
            ) : (
              <WebView
                {...common}
                source={{ uri: htmlUri }}
                androidLayerType="hardware"
                setSupportMultipleWindows={false}
                allowsBackForwardNavigationGestures={false}
              />
            )}
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webviewHost: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
