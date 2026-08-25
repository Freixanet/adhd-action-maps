import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { control, space } from '@shared/design-tokens';
import { useThemeColors } from '../context/ThemeContext';
import { Check, Copy, Share, VolumeHigh, VolumeMute } from '../icons';
import { copyTextToClipboard, sharePlainText } from '../logic/copyText';
import { buildCopyHtml } from '@shared/copyHtml';
import { buildSpeakHtml } from '@shared/speakHtml';
import { hapticToggle } from '../logic/haptics';
import { useToast } from './Toast';

const COPIED_RESET_MS = 1600;
const ICON_SIZE = control.iconMd;
const ICON_HIT_SLOP = Math.ceil((control.touchMin - ICON_SIZE) / 2);

type AskReplyActionsProps = {
  text: string;
};

export default function AskReplyActions({ text }: AskReplyActionsProps) {
  const colors = useThemeColors();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [copyHtml, setCopyHtml] = useState<string | null>(null);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCopied(false);
    setSpeaking(false);
    setCopyHtml(null);
    if (resetRef.current) {
      clearTimeout(resetRef.current);
      resetRef.current = null;
    }
  }, [text]);

  useEffect(
    () => () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    },
    []
  );

  const iconColor = colors.icon.muted;
  const payload = text.trim();

  const markCopied = () => {
    setCopied(true);
    showToast('Copiado');
    if (resetRef.current) clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  const onCopy = async () => {
    if (!payload) return;
    try {
      const ok = await copyTextToClipboard(payload);
      if (ok) {
        markCopied();
        return;
      }
    } catch {
      // Fall through to the WebView copy path.
    }
    setCopyHtml(buildCopyHtml(payload));
  };

  const onCopyMessage = (event: WebViewMessageEvent) => {
    setCopyHtml(null);
    if (event.nativeEvent.data === 'ok') markCopied();
  };

  const onShare = async () => {
    if (!payload) return;
    try {
      const ok = await sharePlainText(payload);
      if (!ok) return;
    } catch {
      return;
    }
  };

  const onSpeak = () => {
    if (!payload) return;
    const next = !speaking;
    hapticToggle(next);
    setSpeaking(next);
  };

  const onSpeakMessage = (event: WebViewMessageEvent) => {
    if (event.nativeEvent.data === 'end' || event.nativeEvent.data === 'unavailable') {
      setSpeaking(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => void onCopy()}
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copiado' : 'Copiar respuesta'}
        hitSlop={ICON_HIT_SLOP}
        style={styles.hit}
      >
        {copied ? (
          <Check size={ICON_SIZE} color={iconColor} />
        ) : (
          <Copy size={ICON_SIZE} color={iconColor} />
        )}
      </Pressable>
      <Pressable
        onPress={() => void onShare()}
        accessibilityRole="button"
        accessibilityLabel="Compartir respuesta"
        hitSlop={ICON_HIT_SLOP}
        style={styles.hit}
      >
        <Share size={ICON_SIZE} color={iconColor} />
      </Pressable>
      <Pressable
        onPress={onSpeak}
        accessibilityRole="button"
        accessibilityState={{ selected: speaking }}
        accessibilityLabel={speaking ? 'Detener lectura' : 'Leer en voz alta'}
        hitSlop={ICON_HIT_SLOP}
        style={styles.hit}
      >
        {speaking ? (
          <VolumeMute size={ICON_SIZE} color={iconColor} />
        ) : (
          <VolumeHigh size={ICON_SIZE} color={iconColor} />
        )}
      </Pressable>
      {copyHtml ? (
        <WebView
          source={{ html: copyHtml }}
          onMessage={onCopyMessage}
          originWhitelist={['*']}
          javaScriptEnabled
          setSupportMultipleWindows={false}
          style={styles.speechWebView}
          pointerEvents="none"
        />
      ) : null}
      {speaking ? (
        <WebView
          source={{ html: buildSpeakHtml(payload) }}
          onMessage={onSpeakMessage}
          originWhitelist={['*']}
          javaScriptEnabled
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          style={styles.speechWebView}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    marginTop: space.stack.sm,
    gap: space.stack.md,
  },
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: control.touchMin,
  },
  speechWebView: {
    position: 'absolute',
    width: space.stack.xs,
    height: space.stack.xs,
    opacity: 0,
  },
});
