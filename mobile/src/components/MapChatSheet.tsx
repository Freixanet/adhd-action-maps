import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MessageSquareText, X, ArrowUp } from '../icons';
import { apiUrl } from '../logic/apiBase';
import { buildLlmRequestHeaders } from '../logic/apiHeaders';
import type { ActionMapData, ChatTurn, MapChatResponse } from '../logic/contracts';
import { supabase } from '../logic/supabase';
import GlassSurface from './GlassSurface';
import { fetchWithTimeout } from '../logic/network';
import { useThemeColors } from '../context/ThemeContext';
import { type } from '@shared/design-tokens';

type MapChatSheetProps = {
  visible: boolean;
  onClose: () => void;
  mapId: string;
  mapData: ActionMapData;
};

type ParsedAssistantTurn = {
  answer: string;
  citations: MapChatResponse['citations'];
  limitations: MapChatResponse['limitations'];
};

function parseStoredAssistantText(text: string): ParsedAssistantTurn {
  const sourcesIndex = text.indexOf('\n\nFuentes:');
  const limitsIndex = text.indexOf('\n\nLímites:');

  if (sourcesIndex === -1 && limitsIndex === -1) {
    return { answer: text, citations: [], limitations: [] };
  }

  const answerEnd = [sourcesIndex, limitsIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? text.length;
  const answer = text.slice(0, answerEnd).trim();
  const citations: NonNullable<MapChatResponse['citations']> = [];
  const limitations: string[] = [];

  if (sourcesIndex >= 0) {
    const sourcesBlock = text.slice(
      sourcesIndex + '\n\nFuentes:'.length,
      limitsIndex >= 0 ? limitsIndex : undefined
    );
    for (const line of sourcesBlock.split('\n')) {
      const trimmed = line.replace(/^-\s*/, '').trim();
      if (!trimmed) continue;
      const [labelPart, rest] = trimmed.split(':');
      const label = labelPart?.trim() || 'Fuente';
      const locator = rest?.trim() || '';
      const excerptIndex = locator.indexOf(' — ');
      if (excerptIndex >= 0) {
        citations.push({
          label,
          locator: locator.slice(0, excerptIndex).trim(),
          excerpt: locator.slice(excerptIndex + 3).trim(),
        });
      } else {
        citations.push({ label, locator });
      }
    }
  }

  if (limitsIndex >= 0) {
    const limitsBlock = text.slice(limitsIndex + '\n\nLímites:'.length);
    for (const line of limitsBlock.split('\n')) {
      const trimmed = line.replace(/^-\s*/, '').trim();
      if (trimmed) limitations.push(trimmed);
    }
  }

  return { answer, citations, limitations };
}

function formatAssistantText(reply: MapChatResponse): string {
  const citationText = reply.citations?.length
    ? `\n\nFuentes:\n${reply.citations
        .map(
          (citation) =>
            `- ${citation.label}: ${citation.locator}${citation.excerpt ? ` — ${citation.excerpt}` : ''}`
        )
        .join('\n')}`
    : '';
  const limitationsText = reply.limitations?.length
    ? `\n\nLímites:\n${reply.limitations.map((item) => `- ${item}`).join('\n')}`
    : '';

  return `${reply.answer}${citationText}${limitationsText}`.trim();
}

function AssistantBubble({ text }: { text: string }) {
  const parsed = parseStoredAssistantText(text);

  return (
    <View className="self-start max-w-[92%] mb-4 rounded-card px-4 py-3 bg-neutral-100 dark:bg-white/5">
      <Text className="text-sm leading-relaxed text-primary">{parsed.answer}</Text>
      {parsed.citations?.length ? (
        <View className="mt-3 pt-3 border-t border-neutral-200/80 border-white/10">
          <Text className="text-meta font-bold uppercase tracking-widest text-secondary mb-2">
            Fuentes
          </Text>
          {parsed.citations.map((citation, index) => (
            <View
              key={`${citation.label}-${citation.locator}-${index}`}
              className="mb-2 rounded-card border border-neutral-200 border-white/10 px-3 py-2"
            >
              <Text className="text-xs font-semibold text-body">
                {citation.label}: {citation.locator}
              </Text>
              {citation.excerpt ? (
                <Text className="mt-1 text-xs leading-relaxed text-secondary">
                  {citation.excerpt}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {parsed.limitations?.length ? (
        <View className="mt-3 pt-3 border-t border-neutral-200/80 border-white/10">
          <Text className="text-meta font-bold uppercase tracking-widest text-secondary mb-2">
            Límites
          </Text>
          {parsed.limitations.map((item, index) => (
            <Text key={`${item}-${index}`} className="text-xs leading-relaxed text-secondary mb-1">
              • {item}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function MapChatSheet({ visible, onClose, mapId, mapData }: MapChatSheetProps) {
  const colors = useThemeColors();
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setChatHistory([]);
    setChatInput('');
    setChatError(null);
    setChatBusy(false);
  }, [mapId]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [chatHistory, chatBusy, visible]);

  const suggestedQuestions = [
    mapData.completionCard?.promptQuestion,
    '¿Qué no debería pasar por alto?',
    '¿Qué partes están más conectadas entre sí?',
  ]
    .filter(Boolean)
    .slice(0, 3) as string[];

  const handleSubmit = useCallback(
    async (presetQuestion?: string) => {
      const question = (presetQuestion || chatInput).trim();
      if (!question || chatBusy) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const optimisticHistory: ChatTurn[] = [...chatHistory, { role: 'user', text: question }];
      setChatHistory(optimisticHistory);
      setChatInput('');
      setChatBusy(true);
      setChatError(null);

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
              history: optimisticHistory,
            }),
          },
          {
            timeoutMs: 25000,
            timeoutMessage: 'La respuesta está tardando demasiado. Inténtalo de nuevo.',
          }
        );

        const parsed = (await response.json()) as MapChatResponse & { error?: string };
        if (!response.ok) {
          throw new Error(parsed?.error || 'No se pudo responder a esta pregunta.');
        }

        setChatHistory((previous) => [
          ...previous,
          {
            role: 'assistant',
            text: formatAssistantText(parsed),
          },
        ]);
      } catch (err) {
        console.error(err);
        setChatError(err instanceof Error ? err.message : 'No se pudo responder a esta pregunta.');
      } finally {
        setChatBusy(false);
      }
    },
    [chatBusy, chatHistory, chatInput, mapData, mapId]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-base" edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {/* Header Superior Ligero */}
          <View className="flex-row items-center justify-between px-6 pt-5 pb-3.5 border-b border-neutral-200 dark:border-white/5 bg-base">
            <View className="flex-1 pr-4">
              <Text className="text-base font-bold text-primary">
                Preguntar sobre la fuente
              </Text>
              <Text className="mt-1 text-meta text-secondary leading-normal">
                Responde solo con el contenido de esta lectura y sus referencias.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="w-7 h-7 rounded-full items-center justify-center bg-neutral-200/60 dark:bg-white/5"
              accessibilityLabel="Cerrar chat"
            >
              <X size={14} color={colors.icon.muted} />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={chatHistory.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
            contentContainerClassName="px-5 py-5 pb-4"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            {chatHistory.length === 0 ? (
              <View className="items-center justify-center py-6 px-4">
                <MessageSquareText size={24} color={colors.action.primary} className="mb-3 opacity-60" />
                <Text className="text-sm font-bold text-primary text-center mb-1">
                  Preguntar sobre la fuente
                </Text>
                <Text className="text-xs text-secondary text-center max-w-[260px] leading-relaxed mb-6">
                  Pide aclaraciones, ejemplos o partes concretas de esta lectura.
                </Text>

                {suggestedQuestions.length > 0 && (
                  <View className="w-full gap-2 max-w-[280px]">
                    {suggestedQuestions.map((question) => (
                      <Pressable
                        key={question}
                        onPress={() => void handleSubmit(question)}
                        disabled={chatBusy}
                        className="rounded-xl border border-neutral-200 border-white/10 px-4 py-2.5 bg-white bg-surface-2 active:bg-neutral-100 dark:active:bg-surface-2"
                      >
                        <Text className="text-xs font-semibold text-body text-center">
                          {question}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              chatHistory.map((turn, index) =>
                turn.role === 'user' ? (
                  <View
                    key={`${turn.role}-${index}`}
                    className="mb-4 self-end max-w-[85%] rounded-card px-4 py-3 bg-accent"
                  >
                    <Text className="text-sm leading-relaxed text-white">{turn.text}</Text>
                  </View>
                ) : (
                  <AssistantBubble key={`${turn.role}-${index}`} text={turn.text} />
                )
              )
            )}

            {chatBusy ? (
              <View className="self-start max-w-[92%] mb-4 rounded-card px-4 py-3 bg-neutral-100 dark:bg-white/5 flex-row items-center gap-2">
                <ActivityIndicator size="small" color={colors.action.primary} />
                <Text className="text-sm text-body">Consultando el Núcleo…</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Composer Inferior Rediseñado */}
          <View className="px-5 pt-3 pb-6 bg-base border-t border-neutral-200 dark:border-white/5">
            <View className="flex-row gap-2 items-center px-4 py-2.5 bg-white bg-base border border-neutral-200 border-white/10 rounded-full min-h-[44px] max-h-32">
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Pregunta sobre esta fuente…"
                placeholderTextColor={colors.text.secondary}
                multiline
                textAlignVertical="center"
                editable={!chatBusy}
                className="flex-1 py-1 px-1 text-sm text-primary"
              />
              <Pressable
                onPress={() => void handleSubmit()}
                disabled={chatBusy || !chatInput.trim()}
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  chatBusy || !chatInput.trim()
                    ? 'bg-neutral-200 dark:bg-base'
                    : 'bg-accent active:bg-accent-pressed'
                }`}
                accessibilityLabel="Enviar pregunta"
              >
                {chatBusy ? (
                  <ActivityIndicator size="small" color={colors.text.onAccent} />
                ) : (
                  <ArrowUp size={15} color={chatInput.trim() ? colors.text.primary : colors.text.secondary} />
                )}
              </Pressable>
            </View>
            {chatError ? (
              <Text className="px-4 pt-2 text-xs text-amber-700 dark:text-amber-400">{chatError}</Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
