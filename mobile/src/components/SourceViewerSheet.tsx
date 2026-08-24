/**
 * Evidence source viewer — authorized PDF page + excerpt.
 * Local offline pdf.js (vendored 5.4.296) + temp file; exclusive loading|pdf|fallback.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import { useSourceViewer } from '../context/SourceViewerContext';
import {
  reduceSourceViewerDocStatus,
  type SourceViewerDocStatus,
} from '@shared/pdf/sourceViewerDocStatus';
import {
  selectSourceViewerSurface,
  SOURCE_VIEWER_FALLBACK_LABEL,
} from '@shared/pdf/sourceViewerSurface';
import { shouldAllowPdfViewerNavigation } from '@shared/pdf/pdfViewerNavigation';
import {
  invalidateViewerSession,
  runViewerCleanup,
  type ViewerSessionHandles,
} from '@shared/pdf/sourceViewerSessionCleanup';
import { type, color } from '@shared/design-tokens';
import {
  prepareLocalPdfViewer,
  sweepPdfViewerCache,
} from '../logic/prepareLocalPdfViewer';

type ViewerPayload = { kind: 'html'; html: string; baseUrl: string; sessionId: string };

export default function SourceViewerSheet() {
  const { target, close, retryDocumentUrl } = useSourceViewer();
  const visible = Boolean(target);
  const [docStatus, setDocStatus] = useState<SourceViewerDocStatus>('idle');
  const [webKey, setWebKey] = useState(0);
  const [viewerPayload, setViewerPayload] = useState<ViewerPayload | null>(null);
  const sessionRef = useRef<ViewerSessionHandles>({
    generation: 0,
    cleanup: null,
    activeSessionId: null,
  });

  const quote = target?.reference?.excerpt?.trim() || '';
  const body = target?.chunk?.text ?? '';
  const isPlaceholder = /^\(segmento pendiente\)?$/i.test(body.trim());
  const safeBody = target?.inaccessible || isPlaceholder ? '' : body;
  const quoteIndex =
    quote && safeBody ? safeBody.toLowerCase().indexOf(quote.toLowerCase()) : -1;
  const epistemicNote = target?.reference?.note?.trim() || '';
  const page =
    typeof target?.chunk?.loc.page === 'number' ? target.chunk.loc.page : null;
  const bbox = target?.chunk?.loc.bbox;
  const documentUrl = target?.documentUrl?.trim() || '';
  const signFailed = Boolean(target?.documentSignFailed);

  const surface = selectSourceViewerSurface({
    hasDocumentUrl: Boolean(documentUrl),
    signFailed,
    docStatus,
    pdfReady: viewerPayload?.kind === 'html',
    hasExcerptBody: Boolean(safeBody),
  });

  /** Invalidate generation, clear handles, drop payload, schedule prior cleanup. */
  const invalidateActiveSession = () => {
    const { handles, pendingCleanup } = invalidateViewerSession(sessionRef.current);
    sessionRef.current = handles;
    setViewerPayload(null);
    void runViewerCleanup(pendingCleanup);
  };

  // Unmount: always cleanup active session.
  useEffect(() => {
    return () => {
      invalidateActiveSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  useEffect(() => {
    void sweepPdfViewerCache(sessionRef.current.activeSessionId);
  }, []);

  useEffect(() => {
    if (!visible) {
      setDocStatus('idle');
      invalidateActiveSession();
      return;
    }
    if (!documentUrl) {
      // Citation without documentUrl: drop PDF session immediately → fallback.
      setDocStatus(signFailed ? 'error' : 'idle');
      invalidateActiveSession();
      return;
    }

    const { handles, pendingCleanup } = invalidateViewerSession(sessionRef.current);
    sessionRef.current = handles;
    const gen = handles.generation;
    setViewerPayload(null);
    void runViewerCleanup(pendingCleanup);

    const sessionId = `${Date.now()}-${webKey}-${gen}`;
    let cancelled = false;
    setDocStatus('loading');

    void (async () => {
      try {
        if (cancelled || sessionRef.current.generation !== gen) return;

        const session = await prepareLocalPdfViewer({
          signedUrl: documentUrl,
          page: page ?? 1,
          sessionId,
          protectSessionId: sessionId,
        });

        if (cancelled || sessionRef.current.generation !== gen) {
          // Stale prepare must not replace the active session — only delete itself.
          await session.cleanup();
          return;
        }

        sessionRef.current = {
          generation: gen,
          cleanup: session.cleanup,
          activeSessionId: session.sessionId,
        };
        setViewerPayload({
          kind: 'html',
          html: session.html,
          baseUrl: session.baseUrl,
          sessionId: session.sessionId,
        });
      } catch {
        if (cancelled || sessionRef.current.generation !== gen) return;
        setViewerPayload(null);
        setDocStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- invalidate uses refs
  }, [visible, documentUrl, page, webKey, signFailed]);

  const header = useMemo(() => {
    if (!target) return '';
    const title = target.sourceTitle?.trim() || 'Fuente';
    if (page != null) return `${title} · página ${page}`;
    return title;
  }, [target, page]);

  const dispatch = (event: Parameters<typeof reduceSourceViewerDocStatus>[1]) => {
    setDocStatus((prev) => reduceSourceViewerDocStatus(prev, event));
  };

  const onWebMessage = (raw: string) => {
    try {
      const msg = JSON.parse(raw) as { type?: string };
      if (msg.type === 'ready') dispatch({ type: 'load' });
      if (msg.type === 'error') dispatch({ type: 'error' });
    } catch {
      dispatch({ type: 'error' });
    }
  };

  const renderExcerpt = () =>
    quoteIndex >= 0 ? (
      <Text className="text-title leading-6 text-body">
        {safeBody.slice(0, quoteIndex)}
        <Text className="font-extrabold text-primary">
          {safeBody.slice(quoteIndex, quoteIndex + quote.length)}
        </Text>
        {safeBody.slice(quoteIndex + quote.length)}
      </Text>
    ) : (
      <Text className="text-title leading-6 text-body">{safeBody}</Text>
    );

  const allowInitialAboutBlank = docStatus === 'loading' || docStatus === 'idle';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar" />
        <View style={styles.sheetHost} pointerEvents="box-none">
          <GlassSurface liquid borderRadius={RADII.lg} style={styles.sheet}>
            <View className="px-5 pt-5 pb-2">
              <Text className="text-label font-bold uppercase tracking-widest text-secondary">
                fuente
              </Text>
              <Text
                className="mt-2 text-subtitle font-extrabold leading-7 text-primary"
                numberOfLines={3}
              >
                {header}
              </Text>
              {page != null && bbox ? (
                <Text className="mt-1 text-callout font-semibold text-body">
                  Región medida ({Math.round(bbox.w)}×{Math.round(bbox.h)})
                </Text>
              ) : null}
              {epistemicNote ? (
                <Text className="mt-2 text-label leading-5 text-secondary">{epistemicNote}</Text>
              ) : null}
            </View>

            {surface.kind === 'loading' ? (
              <View style={[styles.webHost, styles.loadingOverlay]}>
                <ActivityIndicator />
                <Text className="mt-2 text-label text-secondary">
                  Abriendo documento autorizado…
                </Text>
              </View>
            ) : null}

            {surface.kind === 'pdf' && viewerPayload ? (
              <View style={styles.webHost}>
                {docStatus === 'loading' ? (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator />
                    <Text className="mt-2 text-label text-secondary">
                      Abriendo documento autorizado…
                    </Text>
                  </View>
                ) : null}
                <WebView
                  key={`pdf-page:${webKey}:${page ?? 0}:${viewerPayload.sessionId}`}
                  originWhitelist={['file://', 'about:blank', 'blob:']}
                  allowFileAccess
                  allowingReadAccessToURL={viewerPayload.baseUrl}
                  source={{ html: viewerPayload.html, baseUrl: viewerPayload.baseUrl }}
                  style={styles.webview}
                  onShouldStartLoadWithRequest={(req) =>
                    shouldAllowPdfViewerNavigation(
                      {
                        url: req.url,
                        isTopFrame: req.isTopFrame,
                        mainDocumentURL: req.mainDocumentURL,
                      },
                      {
                        baseUrl: viewerPayload.baseUrl,
                        allowInitialAboutBlank,
                      }
                    )
                  }
                  onLoadStart={() => dispatch({ type: 'loadStart' })}
                  onLoadEnd={() => dispatch({ type: 'loadEnd' })}
                  onError={() => dispatch({ type: 'error' })}
                  onHttpError={() => dispatch({ type: 'error' })}
                  onMessage={(e) => onWebMessage(e.nativeEvent.data)}
                  startInLoadingState
                  allowsFullscreenVideo={false}
                  setSupportMultipleWindows={false}
                />
              </View>
            ) : null}

            {surface.kind === 'fallback' ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {surface.showRetry ? (
                  <Pressable
                    onPress={() => {
                      retryDocumentUrl();
                      setWebKey((k) => k + 1);
                      dispatch({ type: 'loadStart' });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Reintentar documento"
                  >
                    <Text className="mb-2 text-callout font-semibold text-body">
                      No se pudo abrir el documento. Reintentar.
                    </Text>
                  </Pressable>
                ) : null}
                {safeBody ? (
                  <>
                    <Text className="mb-2 text-label text-secondary">
                      {SOURCE_VIEWER_FALLBACK_LABEL}
                    </Text>
                    {renderExcerpt()}
                  </>
                ) : (
                  <Text className="text-title leading-6 text-secondary">
                    Este fragmento ya no está disponible o no pudo recuperarse.
                  </Text>
                )}
              </ScrollView>
            ) : null}

            {surface.kind === 'empty' ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text className="text-title leading-6 text-secondary">
                  Este fragmento ya no está disponible o no pudo recuperarse.
                </Text>
              </ScrollView>
            ) : null}

            <View className="px-5 pb-5 pt-2">
              <Pressable
                onPress={() => {
                  close();
                }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar fuente"
              >
                <Text className="text-center text-body font-bold text-secondary">Cerrar</Text>
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
    justifyContent: 'flex-end',
    backgroundColor: color.background.blackFade35,
  },
  sheetHost: {
    maxHeight: '88%',
  },
  sheet: {
    overflow: 'hidden',
  },
  webHost: {
    height: 360,
    marginHorizontal: 12,
    borderRadius: RADII.sm,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background.blackFade08,
  },
  scroll: {
    maxHeight: 320,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
});
