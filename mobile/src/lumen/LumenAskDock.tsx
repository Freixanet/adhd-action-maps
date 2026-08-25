import React, { useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { hapticCommit } from '../logic/haptics';
import type { ActionMapData, ChatTurn } from '@shared/contracts';
import { control, radius, space, type } from '@shared/design-tokens';
import { apiUrl } from '../logic/apiBase';
import { buildLlmRequestHeaders } from '../logic/apiHeaders';
import { fetchWithTimeout } from '../logic/network';
import { supabase } from '../logic/supabase';
import { useThemeColors } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import ComposerDismissScroll from '../components/ComposerDismissScroll';
import ComposerSendButton from '../components/ComposerSendButton';
import ComposerSurface from '../components/ComposerSurface';
import ComposerSwipeDismiss from '../components/ComposerSwipeDismiss';
import {
  COMPOSER_CONTENT_PADDING_H,
  useComposerKeyboardInset,
  useComposerKeyboardInputHeight,
  useComposerKeyboardTextFrameStyle,
} from '../components/ComposerDock';
import { PRESS_HIT_SLOP } from '../hooks/usePressScale';
import {
  COMPOSER_CONTROL_SIZE,
  COMPOSER_FOCUSED_INPUT_HEIGHT,
  COMPOSER_LINE_HEIGHT,
  COMPOSER_REST_INPUT_HEIGHT,
  COMPOSER_REST_TEXT_PAD_BOTTOM,
  COMPOSER_REST_TEXT_PAD_TOP,
} from '../logic/composerText';
import { lumenType } from './lumenType';

const COMPOSER_TEXT_BESIDE_CONTROL = COMPOSER_CONTROL_SIZE + space.stack.xs;

type Props = {
  prompts: string[];
  mapId: string;
  mapData: ActionMapData;
  isPro: boolean;
  onPaywall: () => void;
  onFocusChange?: (focused: boolean) => void;
  /** Suggestion chips stay above the composer; only once the page is scrolled to the end. */
  showSuggestions?: boolean;
};

function assistantText(parsed: { answer?: string; citations?: Array<{ label: string; locator: string; excerpt?: string }>; limitations?: string[] }): string {
  const answer = parsed.answer?.trim() || '';
  const citationText = parsed.citations?.length
    ? `\n\nFuentes:\n${parsed.citations
        .map((c) => `- ${c.label}: ${c.locator}${c.excerpt ? ` — ${c.excerpt}` : ''}`)
        .join('\n')}`
    : '';
  const limitationsText = parsed.limitations?.length
    ? `\n\nLímites:\n${parsed.limitations.map((item) => `- ${item}`).join('\n')}`
    : '';
  return `${answer}${citationText}${limitationsText}`.trim();
}

export default function LumenAskDock({
  prompts,
  mapId,
  mapData,
  isPro,
  onPaywall,
  onFocusChange,
  showSuggestions = false,
}: Props) {
  const colors = useThemeColors();
  const { font } = useTypography();
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const chips = prompts.filter(Boolean).slice(0, 3);
  const showChips = showSuggestions && chips.length > 0;
  const showThread = focused || history.length > 0;
  const composerKeyboardInsetStyle = useComposerKeyboardInset(space.stack.lg, focused);
  const composerInputGrowStyle = useComposerKeyboardInputHeight(
    COMPOSER_REST_INPUT_HEIGHT,
    COMPOSER_FOCUSED_INPUT_HEIGHT,
    focused
  );
  const composerTextFrameStyle = useComposerKeyboardTextFrameStyle(
    {
      paddingLeft: COMPOSER_CONTENT_PADDING_H,
      paddingRight: COMPOSER_TEXT_BESIDE_CONTROL,
      paddingTop: COMPOSER_REST_TEXT_PAD_TOP,
      paddingBottom: COMPOSER_REST_TEXT_PAD_BOTTOM,
    },
    {
      paddingLeft: COMPOSER_CONTENT_PADDING_H,
      paddingRight: space.stack.sm,
      paddingTop: space.stack.sm,
      paddingBottom: COMPOSER_CONTROL_SIZE,
    },
    focused
  );

  const dismissComposer = useCallback(() => {
    Keyboard.dismiss();
    inputRef.current?.blur();
    setFocused(false);
    onFocusChange?.(false);
  }, [onFocusChange]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      if (!isPro) {
        onPaywall();
        return;
      }
      hapticCommit();
      const optimistic: ChatTurn[] = [...history, { role: 'user', text: question }];
      setHistory(optimistic);
      setValue('');
      setBusy(true);
      setError(null);
      try {
        const accessToken = supabase
          ? (await supabase.auth.getSession()).data.session?.access_token
          : undefined;
        const authHeaders = await buildLlmRequestHeaders(accessToken);
        const response = await fetchWithTimeout(
          apiUrl(`/api/maps/${mapId}/chat`),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            body: JSON.stringify({
              map: mapData,
              question,
              history: optimistic,
            }),
          },
          {
            timeoutMs: 25_000,
            timeoutMessage: 'La respuesta está tardando demasiado. Inténtalo de nuevo.',
          }
        );
        const parsed = (await response.json()) as {
          answer?: string;
          citations?: Array<{ label: string; locator: string; excerpt?: string }>;
          limitations?: string[];
          modelUsed?: string;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(parsed?.error || 'No pude responder.');
        }
        setHistory((prev) => [
          ...prev,
          { role: 'assistant', text: assistantText(parsed) },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No pude responder.');
      } finally {
        setBusy(false);
      }
    },
    [busy, history, isPro, mapData, mapId, onPaywall]
  );

  return (
    <View style={styles.wrap}>
      {showThread ? (
        <ScrollView
          style={styles.thread}
          contentContainerStyle={styles.threadInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {history.length === 0 && showChips ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {chips.map((prompt) => (
                <Pressable
                  key={prompt}
                  onPress={() => void send(prompt)}
                  disabled={busy}
                  hitSlop={PRESS_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={prompt}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.background.surfaceRaised, minHeight: control.touchMin },
                  ]}
                >
                  <Text
                    style={[lumenType('lumenChipLabel'), { color: colors.text.secondary }]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {prompt}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {history.map((turn, index) => (
            <Text
              key={`${turn.role}-${index}`}
              style={[
                styles.bubble,
                turn.role === 'user'
                  ? {
                      alignSelf: 'flex-end',
                      backgroundColor: colors.action.primary,
                      color: colors.text.onAccent,
                    }
                  : {
                      alignSelf: 'flex-start',
                      backgroundColor: colors.background.surfaceRaised,
                      color: colors.text.body,
                    },
              ]}
              maxFontSizeMultiplier={1.35}
            >
              {turn.text}
            </Text>
          ))}
          {busy ? (
            <Text style={[styles.hint, { color: colors.text.muted }]}>Pensando…</Text>
          ) : null}
          {error ? (
            <Text style={[styles.hint, { color: colors.text.secondary }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>
      ) : showChips ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {chips.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => void send(prompt)}
              disabled={busy}
              hitSlop={PRESS_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={prompt}
              style={[
                styles.chip,
                { backgroundColor: colors.background.surfaceRaised, minHeight: control.touchMin },
              ]}
            >
              <Text
                style={[lumenType('lumenChipLabel'), { color: colors.text.secondary }]}
                maxFontSizeMultiplier={1.3}
              >
                {prompt}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ComposerDismissScroll>
        <ComposerSwipeDismiss
          enabled={focused && !busy}
          onDismiss={dismissComposer}
          style={composerKeyboardInsetStyle}
        >
          <ComposerSurface focused={focused} inputRef={inputRef}>
            <View pointerEvents="box-none" style={styles.composerRow}>
              <Animated.View
                pointerEvents="box-none"
                style={[styles.composerInputHost, composerInputGrowStyle]}
              >
                <Pressable
                  accessibilityRole="none"
                  onPressIn={() => inputRef.current?.focus()}
                  pointerEvents={busy || focused ? 'none' : 'auto'}
                  style={styles.composerFocusHit}
                />
                <Animated.View
                  pointerEvents={busy ? 'none' : 'box-none'}
                  style={[styles.composerTextFrame, composerTextFrameStyle]}
                >
                  <TextInput
                    ref={inputRef}
                    value={value}
                    onChangeText={setValue}
                    onFocus={() => {
                      setFocused(true);
                      onFocusChange?.(true);
                    }}
                    onBlur={() => {
                      requestAnimationFrame(() => {
                        if (inputRef.current?.isFocused()) {
                          setFocused(true);
                          onFocusChange?.(true);
                          return;
                        }
                        setFocused(false);
                        onFocusChange?.(false);
                      });
                    }}
                    placeholder="Pregunta sobre esto"
                    placeholderTextColor={colors.text.secondary}
                    editable={!busy}
                    multiline
                    scrollEnabled={focused}
                    showSoftInputOnFocus
                    textAlignVertical="top"
                    style={[
                      styles.composerInput,
                      {
                        fontSize: type.input.fontSize,
                        lineHeight: COMPOSER_LINE_HEIGHT,
                        fontFamily: font.family,
                        color: colors.text.primary,
                        backgroundColor: 'transparent',
                      },
                    ]}
                    maxFontSizeMultiplier={1.35}
                  />
                </Animated.View>
                <View pointerEvents="auto" style={styles.composerSend}>
                  <ComposerSendButton
                    onPress={() => void send(value)}
                    disabled={busy || !value.trim()}
                    accessibilityLabel="Enviar"
                  />
                </View>
              </Animated.View>
            </View>
          </ComposerSurface>
        </ComposerSwipeDismiss>
      </ComposerDismissScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.stack.sm,
  },
  thread: {
    maxHeight: control.lumenAskThread,
  },
  threadInner: {
    gap: space.stack.sm,
    paddingBottom: space.stack.xs,
  },
  chips: {
    flexDirection: 'row',
    gap: space.stack.sm,
    paddingBottom: space.stack.xs,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: space.stack.lg,
    justifyContent: 'center',
  },
  bubble: {
    ...lumenType('lumenLead'),
    maxWidth: '80%',
    borderRadius: radius.card,
    paddingHorizontal: space.stack.md,
    paddingVertical: space.stack.sm,
    overflow: 'hidden',
  },
  hint: {
    ...lumenType('lumenCopy'),
  },
  composerRow: {
    position: 'relative',
    paddingHorizontal: space.stack.sm,
    paddingVertical: space.stack.sm,
    zIndex: 30,
  },
  composerInputHost: {
    position: 'relative',
    alignSelf: 'stretch',
    minWidth: 0,
  },
  composerFocusHit: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  composerTextFrame: {
    ...StyleSheet.absoluteFillObject,
    minWidth: 0,
    zIndex: 2,
    overflow: 'visible',
  },
  composerInput: {
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
    includeFontPadding: false,
    overflow: 'visible',
  },
  composerSend: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
});
