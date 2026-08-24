import { color, motion, space, type } from '@shared/design-tokens';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { HistoryEntry } from '@shared/history';
import { splitAskParagraphs } from '@shared/askChatContract';
import { visibleAskAnswer } from '../logic/visibleAskAnswer';
import { RADII } from '@shared/uiTokens';
import CompletionGlassButton from './CompletionGlassButton';
import { DevModelCaption, DevModelLongPress } from './DevModelInspect';
import ChatThinkingIndicator from './ChatThinkingIndicator';
import GenerationPhaseTrail from './GenerationPhaseTrail';
import NucleoCover from './NucleoCover';
import AskReplyActions from './AskReplyActions';
import UserMessageText from './UserMessageText';
import SessionErrorBanner from './SessionErrorBanner';
import { useAppSession } from '../context/AppSessionContext';
import { hapticSuccess } from '../logic/haptics';
import { useTheme } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import { useGenerationSoftStage } from '../hooks/useGenerationSoftStage';
import { useTypewriter } from '../hooks/useTypewriter';
import {
  pickReadyAssistantMessageFromMap,
  resolveGenerationPhaseIndex,
} from '../logic/generationPhaseTrail';
import { contentEntering } from '../motion/contentEnter';
const ACK_DELAY_MS = 180;
const PHASES_AFTER_ACK_MS = 320;
const READY_CARD_DELAY_MS = 280;
const REDUCED_FADE_MS = 150;
/** Cover preview above “Abrir Núcleo” — 16:9 placeholder. */
const READY_COVER_ASPECT = 16 / 9;

function UserChatBubble({
  text,
  maxWidth,
  backgroundColor,
  entering,
  onEdit,
}: {
  text: string;
  maxWidth: number;
  backgroundColor: string;
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={entering} className="w-full items-end" style={styles.userTurn}>
      <UserMessageText
        text={text}
        color={colors.text.primary}
        maxWidth={maxWidth}
        backgroundColor={backgroundColor}
        onEdit={onEdit}
      />
    </Animated.View>
  );
}

function AssistantReplyText({
  text,
  tone = 'primary',
}: {
  text: string;
  tone?: 'primary' | 'secondary';
}) {
  const { font } = useTypography();
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: tone === 'secondary' ? colors.text.secondary : colors.text.primary,
        fontFamily: font.family,
        fontSize: type.readingBody.fontSize,
        lineHeight: type.readingBody.lineHeight,
      }}
      maxFontSizeMultiplier={1.35}
    >
      {text}
    </Text>
  );
}

function AskAnswerBody({ text }: { text: string }) {
  const paragraphs = splitAskParagraphs(visibleAskAnswer(text));
  return (
    <View className="w-full" style={styles.askParagraphs}>
      {paragraphs.map((paragraph, index) => (
        <AssistantReplyText key={index} text={paragraph} />
      ))}
    </View>
  );
}

function AssistantTextRow({
  children,
  entering,
}: {
  children: React.ReactNode;
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
}) {
  return (
    <Animated.View entering={entering} className="w-full">
      {children}
    </Animated.View>
  );
}

export default function InlineGenerationThread() {
  const session = useAppSession();
  const { isDark, colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const bubbleMaxWidth = windowWidth * 0.75;

  const [reduceMotion, setReduceMotion] = useState(false);
  const [ackActive, setAckActive] = useState(false);
  const [phasesVisible, setPhasesVisible] = useState(false);
  const [readyMessageActive, setReadyMessageActive] = useState(false);
  const [openCardVisible, setOpenCardVisible] = useState(false);
  const [askAnswerActive, setAskAnswerActive] = useState(false);
  const [coverWidth, setCoverWidth] = useState(0);

  const readyPreviewCardRef = useRef<View>(null);
  const hapticFiredRef = useRef(false);
  const phasesUnlockedRef = useRef(false);

  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const phasesOpacity = useSharedValue(1);

  const snapshot = session.inlineUserTurn;
  const status = session.inlineGenerationStatus;
  const priorAskTurns = session.inlineAskPriorTurns ?? [];
  const isAsk = snapshot?.kind === 'ask' || priorAskTurns.length > 0;
  const instantAskReveal = Boolean(isAsk && snapshot?.revealInstant);
  const skipAskMotion = reduceMotion || instantAskReveal;

  const isPreviewGen = Boolean(session.devPreviewGenerationActive);
  const softStage = useGenerationSoftStage(
    !isAsk && status === 'generating' && phasesVisible,
    isPreviewGen ? 'preview' : 'normal'
  );
  const phaseIndex = resolveGenerationPhaseIndex({
    isAnalyzingSource: session.isAnalyzingSource,
    streamLoadPhase: session.streamLoadPhase,
    softStage,
    softOnly: isPreviewGen,
  });

  const title = session.data?.title?.trim() || session.data?.coreIdea?.trim() || 'Tu Núcleo';

  const coverEntry = useMemo((): HistoryEntry | null => {
    if (!session.data) return null;
    const dataTitle = session.data.title;
    const existing =
      session.historyStore.entries.find(
        (entry) => entry.session?.data?.title === dataTitle
      ) ??
      session.historyStore.entries.find(
        (entry) => entry.id === session.historyStore.activeId
      );
    if (existing) return existing;
    return {
      id: 'inline-ready-cover',
      title: session.data.title || 'Núcleo',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceType: 'text',
      session: {
        data: session.data,
        currentStep: 0,
      },
    };
  }, [session.data, session.historyStore.activeId, session.historyStore.entries]);

  const coverHeight =
    coverWidth > 0 ? Math.round(coverWidth / READY_COVER_ASPECT) : 0;

  const typewriterTickMs = isPreviewGen ? 32 : 11;

  const ackFull = snapshot?.conversationalMessage ?? '';
  const { displayed: ackDisplayed, done: ackDone } = useTypewriter(ackFull, ackActive && !isAsk, {
    reduceMotion,
    startDelayMs: 0,
    tickMs: typewriterTickMs,
    charsPerTick: 1,
  });

  const readyFull = pickReadyAssistantMessageFromMap(session.data);
  const showReadyMessage = readyMessageActive && status === 'ready' && !isAsk;
  const { displayed: readyDisplayed, done: readyDone } = useTypewriter(
    readyFull,
    showReadyMessage,
    {
      reduceMotion,
      startDelayMs: 40,
      tickMs: typewriterTickMs,
      charsPerTick: 1,
    }
  );

  const askAnswerFull = visibleAskAnswer(session.inlineAskAnswer ?? '');
  const { displayed: askTyped } = useTypewriter(askAnswerFull, askAnswerActive && isAsk, {
    reduceMotion: skipAskMotion,
    startDelayMs: 0,
    tickMs: typewriterTickMs,
    charsPerTick: 2,
  });
  const askDisplayed = instantAskReveal && askAnswerFull ? askAnswerFull : askTyped;
  const showAskCopy =
    status === 'ready' &&
    askAnswerFull.length > 0 &&
    (instantAskReveal || askDisplayed.length >= askAnswerFull.length);

  const openResult = () => {
    readyPreviewCardRef.current?.measureInWindow((x, y, width, height) => {
      session.openInlineResult({ x, y, width, height, borderRadius: RADII.lg });
    });
  };

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    session.registerInlineAutoOpenCancel(() => {
      /* Manual open only — cancel any legacy auto-open. */
    });
    return () => session.registerInlineAutoOpenCancel(null);
  }, [session]);

  // New turn: reset choreography.
  useEffect(() => {
    if (!snapshot) return;
    hapticFiredRef.current = false;
    phasesUnlockedRef.current = false;
    setAckActive(false);
    setPhasesVisible(false);
    setReadyMessageActive(false);
    setOpenCardVisible(false);
    setAskAnswerActive(Boolean(snapshot.kind === 'ask' && snapshot.revealInstant));
    phasesOpacity.value = 1;
    cardOpacity.value = 0;
    cardScale.value = reduceMotion ? 1 : 0.92;

    if (snapshot.kind === 'ask') return;

    const timer = setTimeout(() => setAckActive(true), ACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [snapshot?.kind, snapshot?.revealInstant, snapshot?.sourceUrl, snapshot?.conversationalMessage, snapshot?.text, snapshot?.pastedText]);

  // Ask: start typing when the answer arrives.
  useEffect(() => {
    if (!isAsk) return;
    if (status === 'ready' && askAnswerFull) {
      setAskAnswerActive(true);
      return;
    }
    if (status === 'generating') {
      setAskAnswerActive(false);
    }
  }, [askAnswerFull, isAsk, status]);

  // After ack finishes typing, reveal Perplexity-style phases.
  useEffect(() => {
    if (isAsk) return;
    if (!ackDone || status === 'error') return;
    if (phasesUnlockedRef.current) return;
    const timer = setTimeout(() => {
      phasesUnlockedRef.current = true;
      setPhasesVisible(true);
    }, PHASES_AFTER_ACK_MS);
    return () => clearTimeout(timer);
  }, [ackDone, isAsk, status]);

  // If generation starts before ack finishes, unlock phases ASAP after ack.
  useEffect(() => {
    if (isAsk) return;
    if (!ackDone) return;
    if (status !== 'generating' && status !== 'ready') return;
    if (phasesUnlockedRef.current) return;
    phasesUnlockedRef.current = true;
    setPhasesVisible(true);
  }, [ackDone, isAsk, status]);

  // Ready: fade phases (if any) → stream completion message → open card.
  useEffect(() => {
    if (isAsk) return;
    if (status === 'error') {
      setPhasesVisible(false);
      setReadyMessageActive(false);
      setOpenCardVisible(false);
      return;
    }
    if (status !== 'ready') {
      setReadyMessageActive(false);
      setOpenCardVisible(false);
      return;
    }

    if (!ackDone) return;

    const fadeMs = reduceMotion ? REDUCED_FADE_MS : 220;
    if (phasesVisible) {
      phasesOpacity.value = withTiming(0, {
        duration: fadeMs,
        easing: Easing.out(Easing.ease),
      });
      const hidePhases = setTimeout(() => {
        setPhasesVisible(false);
        // Ready replaces ack in the same assistant slot.
        setAckActive(false);
        setReadyMessageActive(true);
      }, fadeMs);
      return () => clearTimeout(hidePhases);
    }

    setAckActive(false);
    setReadyMessageActive(true);
  }, [ackDone, isAsk, phasesOpacity, phasesVisible, reduceMotion, status]);

  useEffect(() => {
    if (isAsk) return;
    if (!readyDone || status !== 'ready') return;
    const timer = setTimeout(() => {
      setOpenCardVisible(true);
      if (!hapticFiredRef.current) {
        hapticFiredRef.current = true;
        hapticSuccess();
      }
    }, READY_CARD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isAsk, readyDone, status]);

  useEffect(() => {
    if (!openCardVisible) return;
    const fadeMs = reduceMotion ? REDUCED_FADE_MS : 280;
    cardOpacity.value = withTiming(1, { duration: fadeMs });
    cardScale.value = reduceMotion
      ? 1
      : withSpring(1, {
          duration: motion.sheetAlt.duration,
          dampingRatio: 1,
          reduceMotion: ReduceMotion.System,
        });
  }, [cardOpacity, cardScale, openCardVisible, reduceMotion]);

  const phasesStyle = useAnimatedStyle(() => ({
    opacity: phasesOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  if (!snapshot && priorAskTurns.length === 0) return null;
  if (status === 'idle' && !isAsk) return null;

  const userMessage = snapshot?.text?.trim() || snapshot?.pastedText?.trim() || '';
  const userBubbleBg = isDark ? color.background.whiteFade10 : color.background.blackFade06;
  const userBubble = userMessage ? (
    <UserChatBubble
      text={userMessage}
      maxWidth={bubbleMaxWidth}
      backgroundColor={userBubbleBg}
      entering={skipAskMotion ? undefined : contentEntering()}
      onEdit={() => session.beginComposerEdit?.(userMessage)}
    />
  ) : null;

  const firstUserTurnOffset =
    isAsk && priorAskTurns.length === 0 && userBubble
      ? { paddingTop: space.stack.xl }
      : undefined;

  if (status === 'cancelled') {
    return (
      <View className="w-full flex-1" style={firstUserTurnOffset}>
        {userBubble}
      </View>
    );
  }

  if (isAsk) {
    return (
      <View className="w-full flex-1" style={[styles.thread, firstUserTurnOffset]}>
        {priorAskTurns.map((turn, index) => (
          <View key={`prior-${index}`}>
            <UserChatBubble
              text={turn.question}
              maxWidth={bubbleMaxWidth}
              backgroundColor={userBubbleBg}
              onEdit={() => session.beginComposerEdit?.(turn.question)}
            />
            <AssistantTextRow>
              <View className="w-full">
                <AskAnswerBody text={turn.answer} />
              </View>
              <AskReplyActions text={visibleAskAnswer(turn.answer)} />
            </AssistantTextRow>
          </View>
        ))}
        <View>
          {userBubble}

          {status === 'error' ? (
            <AssistantTextRow
              entering={skipAskMotion ? undefined : contentEntering()}
            >
              <View className="w-full">
                <SessionErrorBanner inline className="mb-0" />
              </View>
            </AssistantTextRow>
          ) : null}

          {askDisplayed.trim() ? (
            <AssistantTextRow
              key={instantAskReveal ? `restored:${snapshot?.text ?? ''}` : 'live'}
              entering={skipAskMotion ? undefined : contentEntering()}
            >
              <DevModelLongPress
                enabled={session.devToolsEnabled}
                modelUsed={session.inlineAskModelUsed}
              >
                <View className="w-full">
                  <AskAnswerBody text={askDisplayed} />
                </View>
              </DevModelLongPress>
              {showAskCopy ? <AskReplyActions text={askAnswerFull} /> : null}
            </AssistantTextRow>
          ) : null}

          {(status === 'generating' || status === 'partial') && !askDisplayed.trim() ? (
            <View collapsable={false}>
              <ChatThinkingIndicator reduceMotion={reduceMotion} />
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View className="w-full flex-1">
      {/* Single assistant message slot — ready replaces ack; never both. */}
      {(ackActive || showReadyMessage) && status !== 'error' && status !== 'cancelled' ? (
        <AssistantTextRow
          key={showReadyMessage ? 'ready' : 'ack'}
          entering={reduceMotion ? undefined : contentEntering()}
        >
          <AssistantReplyText text={showReadyMessage ? readyDisplayed : ackDisplayed} />
        </AssistantTextRow>
      ) : null}

      {ackActive && status === 'error' ? (
        <AssistantTextRow entering={reduceMotion ? undefined : contentEntering()}>
          <AssistantReplyText text={ackDisplayed} />
          <View className="mt-3 w-full">
            <SessionErrorBanner inline className="mb-0" />
          </View>
        </AssistantTextRow>
      ) : null}

      {status === 'ready' && session.sourceSyncPending ? (
        <View className="mt-3 w-full">
          <SessionErrorBanner inline className="mb-0" />
        </View>
      ) : null}

      {status === 'generating' && session.sourceSyncPending && session.error ? (
        <View className="mt-3 w-full">
          <SessionErrorBanner inline className="mb-0" />
        </View>
      ) : null}

      {phasesVisible && status !== 'error' ? (
        <Animated.View style={phasesStyle} className="mt-6 w-full">
          <GenerationPhaseTrail
            activeIndex={phaseIndex}
            reduceMotion={reduceMotion}
            collectionProgress={session.collectionGenerationProgress}
          />
        </Animated.View>
      ) : null}

      {openCardVisible && status === 'ready' ? (
        <View className="mt-8 w-full items-center pb-6">
          <Animated.View style={[cardStyle, { width: '100%' }]}>
            <View
              ref={readyPreviewCardRef}
              collapsable={false}
              style={styles.readyPreviewWrap}
              onLayout={(event) => {
                const next = Math.round(event.nativeEvent.layout.width);
                if (next > 0 && next !== coverWidth) setCoverWidth(next);
              }}
            >
              <View
                style={[
                  styles.readyPreviewShell,
                  {
                    backgroundColor: colors.background.accentSoft,
                    height: coverHeight || undefined,
                    minHeight: coverHeight || 160,
                  },
                ]}
              >
                {coverEntry && coverWidth > 0 && coverHeight > 0 ? (
                  <NucleoCover
                    entry={coverEntry}
                    width={coverWidth}
                    height={coverHeight}
                  />
                ) : null}
              </View>
            </View>
            <View className="mt-4 w-full">
              <CompletionGlassButton
                label="Abrir Núcleo"
                variant="accent"
                onPress={openResult}
                accessibilityLabel={`Abrir ${title}`}
              />
              <View className="mt-2 items-center">
                <DevModelCaption
                  enabled={session.devToolsEnabled}
                  modelUsed={session.data?.modelUsed}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    gap: space.stack.xl,
  },
  /** Empty canvas under the user bubble before the AI reply. */
  userTurn: {
    paddingBottom: space.stack.xl + space.stack.lg,
  },
  askParagraphs: {
    gap: space.stack.lg,
  },
  readyPreviewWrap: {
    width: '100%',
  },
  readyPreviewShell: {
    width: '100%',
    borderRadius: RADII.lg,
    overflow: 'hidden',
  },
});
