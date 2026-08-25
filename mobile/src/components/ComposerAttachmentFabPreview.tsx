import React, { useEffect, useRef, useState } from 'react';
import { Image, NativeModules, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as tokens from '@shared/design-tokens';
import type { UploadedFile } from '../logic/attachments';
import {
  resolveAttachmentDocumentUri,
  resolveAttachmentImagePreviewUri,
} from '../logic/attachments';
import { preparePdfFabThumbnailSession } from '../logic/preparePdfFabThumbnail';

type ComposerAttachmentFabPreviewProps = {
  file: UploadedFile;
  width: number;
  height: number;
  borderRadius: number;
};

function kindLabel(file: UploadedFile): string {
  if (file.isPdf) return 'PDF';
  if (file.isEpub) return 'EPUB';
  if (file.isDocx) return 'DOCX';
  const ext = /\.([a-z0-9]{2,5})$/i.exec(file.name)?.[1];
  return ext ? ext.toUpperCase() : 'DOC';
}

function debugFabLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>
) {
  const payload = {
    sessionId: '7b73da',
    runId: 'post-fix-5',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  // #region agent log
  console.warn('DEBUG_FAB_7b73da', JSON.stringify(payload));
  fetch('http://127.0.0.1:7897/ingest/bbc9ecbc-e71f-48f5-9d31-de7ddf27db67', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '7b73da',
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  const scriptUrl = String(
    (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL ?? ''
  );
  const host = /https?:\/\/([^/:]+)/.exec(scriptUrl)?.[1];
  if (host && host !== '127.0.0.1' && host !== 'localhost') {
    fetch(`http://${host}:7897/ingest/bbc9ecbc-e71f-48f5-9d31-de7ddf27db67`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '7b73da',
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
  // #endregion
}

/**
 * Photos use RN Image. PDFs use the iOS file:// viewer inset inside the
 * rounded chip so the square WKWebView corners stay inside the radius.
 * pdf.js in this chip never posted (probe/boot/ready all missing).
 */
export default function ComposerAttachmentFabPreview({
  file,
  width,
  height,
  borderRadius,
}: ComposerAttachmentFabPreviewProps) {
  const imageUri = resolveAttachmentImagePreviewUri(file);
  const documentUri = resolveAttachmentDocumentUri(file);
  const pdfBase64Ref = useRef(file.fileData ?? null);
  pdfBase64Ref.current = file.fileData ?? null;
  const fileKey = `${file.name}:${file.size}:${documentUri ?? ''}`;
  const isPdf =
    Boolean(documentUri || pdfBase64Ref.current) &&
    Boolean(
      file.isPdf ||
        file.mimeType === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf')
    );

  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [pdfFailed, setPdfFailed] = useState(false);
  const cleanupRef = useRef<(() => Promise<void>) | null>(null);
  const sessionGenRef = useRef(0);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUri]);

  useEffect(() => {
    if (imageUri || !isPdf) {
      setPdfUri(null);
      setPdfFailed(false);
      return;
    }

    const gen = ++sessionGenRef.current;
    setPdfUri(null);
    setPdfFailed(false);
    let cancelled = false;

    void (async () => {
      try {
        const session = await preparePdfFabThumbnailSession({
          pdfLocalUri: documentUri,
          pdfBase64: pdfBase64Ref.current,
        });
        if (cancelled || gen !== sessionGenRef.current) {
          await session.cleanup();
          return;
        }
        cleanupRef.current = session.cleanup;
        // #region agent log
        debugFabLog('A', 'ComposerAttachmentFabPreview.tsx:prepare-ok', 'pdf thumb session ready', {
          hasPdfUri: Boolean(session.pdfUri),
          platform: Platform.OS,
          width,
          height,
          borderRadius,
        });
        // #endregion
        if (Platform.OS === 'ios') setPdfUri(session.pdfUri);
        else setPdfFailed(true);
      } catch (error) {
        if (!cancelled && gen === sessionGenRef.current) {
          setPdfFailed(true);
          // #region agent log
          debugFabLog('A', 'ComposerAttachmentFabPreview.tsx:prepare-fail', 'pdf thumb prepare failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          // #endregion
          console.warn('[attachment-preview] PDF thumbnail prepare failed', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      const cleanup = cleanupRef.current;
      cleanupRef.current = null;
      if (cleanup) void cleanup();
    };
  }, [borderRadius, documentUri, fileKey, height, imageUri, isPdf, width]);

  const showImage = Boolean(!imageFailed && imageUri);
  const showPdfWebView = Boolean(isPdf && pdfUri && !pdfFailed);
  const paper = tokens.themeColor.light.background.surface;
  const ink = tokens.themeColor.light.text.primary;
  const typeMetaBold = tokens.type.metaBold;

  useEffect(() => {
    // #region agent log
    debugFabLog('B', 'ComposerAttachmentFabPreview.tsx:paint-flags', 'chip paint flags', {
      showImage,
      showPdfWebView,
      showRasterizer: false,
      hasPdfUri: Boolean(pdfUri),
      pdfFailed,
      imageFailed,
      inset: 0,
    });
    // #endregion
  }, [imageFailed, pdfFailed, pdfUri, showImage, showPdfWebView]);

  return (
    <View
      collapsable={false}
      style={{
        width,
        height,
        overflow: 'hidden',
        borderRadius,
        backgroundColor: paper,
      }}
    >
      {showImage && imageUri ? (
        <Image
          source={{ uri: imageUri }}
          accessibilityLabel={file.name}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
          style={{ width, height, borderRadius, overflow: 'hidden' }}
        />
      ) : null}

      {showPdfWebView && pdfUri ? (
        <WebView
          key={pdfUri}
          pointerEvents="none"
          originWhitelist={['file://*', 'file://']}
          allowFileAccess
          allowingReadAccessToURL={pdfUri.replace(/[^/]+$/, '')}
          source={{ uri: pdfUri }}
          style={{ width, height, flex: 0, backgroundColor: paper }}
          containerStyle={{
            width,
            height,
            flex: 0,
            backgroundColor: paper,
          }}
          contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
          javaScriptEnabled={false}
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustContentInsets={false}
          nestedScrollEnabled={false}
          overScrollMode="never"
          androidLayerType="hardware"
          dataDetectorTypes={Platform.OS === 'ios' ? 'none' : undefined}
          contentInsetAdjustmentBehavior={
            Platform.OS === 'ios' ? 'never' : undefined
          }
          allowsLinkPreview={false}
        />
      ) : null}

      {!showImage && !showPdfWebView ? (
        <View style={styles.documentFallback} accessibilityLabel={file.name}>
          <Text
            style={{
              fontSize: typeMetaBold.fontSize,
              lineHeight: typeMetaBold.lineHeight,
              fontWeight: typeMetaBold.fontWeight,
              color: ink,
            }}
          >
            {kindLabel(file)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  documentFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
