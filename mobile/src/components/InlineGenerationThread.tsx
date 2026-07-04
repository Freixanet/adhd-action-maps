import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { File, Image as ImageIcon, Link2 } from 'lucide-react-native';
import ExactLiquidOrbWebView from './ExactLiquidOrbWebView';
import SessionErrorBanner from './SessionErrorBanner';
import {
  ANALYZING_SOURCE_LABEL,
  GenerationProgressBar,
  LoadingPhaseLabel,
  LOADING_PHASE_LABELS,
} from './loadingGenerationUi';
import { stepHaptic, useAppSession, type InlineUserTurnSnapshot } from '../context/AppSessionContext';
import { useTheme } from '../context/ThemeContext';

const BUBBLE_ENTER_MS = 200;
const BLOCK_B_DELAY_MS = 250;
const PHASES_DELAY_MS = 600;
const PHASE_FADE_OUT_MS = 200;
const REDUCED_FADE_MS = 150;
const AUTO_OPEN_MS = 4000;
const ORB_SIZE = 72;

function parseTotalMinutes(steps: Array<{ time?: string }> | undefined): number | null {
  if (!steps?.length) return null;
  let total = 0;
  let found = false;
  for (const step of steps) {
    const match = String(step.time || '').match(/(\d+)\s*min/i);
    if (match) {
      total += parseInt(match[1] ?? '0', 10);
      found = true;
    }
  }
  return found ? total : null;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function truncateName(name: string, max = 24): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function formatLinkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

function enterTiming(duration: number, reduceMotion: boolean) {
  if (reduceMotion) {
    return withTiming(1, { duration: REDUCED_FADE_MS });
  }
  return withTiming(1, { duration, easing: Easing.out(Easing.ease) });
}

type UserBubbleProps = {
  snapshot: InlineUserTurnSnapshot;
  reduceMotion: boolean;
  maxWidth: number;
  mutedIcon: string;
};

function UserBubble({ snapshot, reduceMotion, maxWidth, mutedIcon }: UserBubbleProps) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 8);

  useEffect(() => {
    opacity.value = enterTiming(BUBBLE_ENTER_MS, reduceMotion);
    translateY.value = reduceMotion
      ? 0
      : withTiming(0, { duration: BUBBLE_ENTER_MS, easing: Easing.out(Easing.ease) });
  }, [opacity, reduceMotion, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ maxWidth, alignSelf: 'flex-end' }, style]}>
      <View className="rounded-2xl bg-surface-2 px-4 py-3">
        <UserBubbleContent snapshot={snapshot} mutedIcon={mutedIcon} />
      </View>
    </Animated.View>
  );
}

function UserBubbleContent({
  snapshot,
  mutedIcon,
}: {
  snapshot: InlineUserTurnSnapshot;
  mutedIcon: string;
}) {
  if (snapshot.uploadedFile) {
    const file = snapshot.uploadedFile;
    const kind = file.isPdf ? 'PDF' : file.isImage ? 'Imagen' : 'Archivo';
    const sizeLabel = formatFileSize(file.size);
    const label = sizeLabel
      ? `${kind} · ${truncateName(file.name)} · ${sizeLabel}`
      : `${kind} · ${truncateName(file.name)}`;
    const Icon = file.isImage ? ImageIcon : File;
    return (
      <View className="flex-row items-center gap-2">
        <Icon size={16} color={mutedIcon} />
        <Text className="flex-1 text-[15px] text-body" numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  if (snapshot.urlKind === 'youtube') {
    const prefix = snapshot.linkTitle?.trim()
      ? `YouTube · ${snapshot.linkTitle.trim()}`
      : 'YouTube';
    return (
      <View className="flex-row items-center gap-2">
        <Link2 size={16} color={mutedIcon} />
        <Text className="flex-1 text-[15px] text-body" numberOfLines={1}>
          {prefix}
        </Text>
      </View>
    );
  }

  if (snapshot.urlKind === 'link') {
    const domain = formatLinkDomain(snapshot.sourceLabel);
    const label = snapshot.linkTitle?.trim() ? `${domain} · ${snapshot.linkTitle.trim()}` : domain;
    return (
      <View className="flex-row items-center gap-2">
        <Link2 size={16} color={mutedIcon} />
        <Text className="flex-1 text-[15px] text-body" numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  const text = snapshot.pastedText?.trim() || snapshot.text?.trim() || '';
  return (
    <Text className="text-[15px] leading-[22px] text-body" numberOfLines={2}>
      {text}
    </Text>
  );
}

export default function InlineGenerationThread() {
  const session = useAppSession();
  const { isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const bubbleMaxWidth = windowWidth * 0.75;
  const mutedIcon = isDark ? '#a3a3a3' : '#737373';

  const [reduceMotion, setReduceMotion] = useState(false);
  const [blockBVisible, setBlockBVisible] = useState(false);
  const [phasesVisible, setPhasesVisible] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);
  const [orbVisible, setOrbVisible] = useState(false);

  const orbBlockRef = useRef<View>(null);
  const autoOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoOpenCancelledRef = useRef(false);
  const phasesUnlockedRef = useRef(false);
  const hapticFiredRef = useRef(false);

  const phaseBlockOpacity = useSharedValue(1);
  const orbOpacity = useSharedValue(0);
  const orbScale = useSharedValue(0.6);

  const blockBOpacity = useSharedValue(0);
  const blockBTranslateY = useSharedValue(6);
  const ackOpacity = useSharedValue(0);
  const ackTranslateY = useSharedValue(6);

  const snapshot = session.inlineUserTurn;
  const status = session.inlineGenerationStatus;

  const phaseLabel = session.isAnalyzingSource
    ? ANALYZING_SOURCE_LABEL
    : LOADING_PHASE_LABELS[session.streamLoadPhase] ?? LOADING_PHASE_LABELS[0];

  const title = session.data?.title?.trim() || session.data?.coreIdea?.trim() || 'Tu Núcleo';
  const stepCount = session.data?.steps?.length ?? 0;
  const totalMinutes = parseTotalMinutes(session.data?.steps);
  const metaLabel =
    totalMinutes !== null && stepCount > 0
      ? `~${totalMinutes} min · ${stepCount} pasos`
      : stepCount > 0
        ? `${stepCount} pasos`
        : undefined;

  const clearAutoOpenTimer = () => {
    if (autoOpenTimerRef.current) {
      clearTimeout(autoOpenTimerRef.current);
      autoOpenTimerRef.current = null;
    }
  };

  const cancelAutoOpen = () => {
    autoOpenCancelledRef.current = true;
    clearAutoOpenTimer();
  };

  const openResult = () => {
    cancelAutoOpen();
    orbBlockRef.current?.measureInWindow((x, y, width, height) => {
      session.openInlineResult({ x, y, width, height, borderRadius: 16 });
    });
  };

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    session.registerInlineAutoOpenCancel(cancelAutoOpen);
    return () => session.registerInlineAutoOpenCancel(null);
  }, [session]);

  useEffect(() => {
    if (!snapshot) return;
    autoOpenCancelledRef.current = false;
    hapticFiredRef.current = false;
    setBlockBVisible(false);
    setPhasesVisible(false);
    setProgressVisible(false);
    setOrbVisible(false);
    phasesUnlockedRef.current = false;
    phaseBlockOpacity.value = 1;
    orbOpacity.value = 0;
    orbScale.value = reduceMotion ? 1 : 0.6;

    const blockTimer = setTimeout(() => setBlockBVisible(true), BLOCK_B_DELAY_MS);
    return () => clearTimeout(blockTimer);
  }, [snapshot?.sourceLabel, snapshot?.conversationalMessage]);

  useEffect(() => {
    if (!blockBVisible) return;

    const fadeMs = reduceMotion ? REDUCED_FADE_MS : BUBBLE_ENTER_MS;
    blockBOpacity.value = withTiming(1, { duration: fadeMs, easing: Easing.out(Easing.ease) });
    blockBTranslateY.value = reduceMotion
      ? 0
      : withTiming(0, { duration: fadeMs, easing: Easing.out(Easing.ease) });
    ackOpacity.value = withTiming(1, { duration: fadeMs, easing: Easing.out(Easing.ease) });
    ackTranslateY.value = reduceMotion
      ? 0
      : withTiming(0, { duration: fadeMs, easing: Easing.out(Easing.ease) });

    const phasesTimer = setTimeout(() => {
      phasesUnlockedRef.current = true;
      setPhasesVisible(true);
      setProgressVisible(true);
    }, PHASES_DELAY_MS);

    return () => clearTimeout(phasesTimer);
  }, [ackOpacity, ackTranslateY, blockBOpacity, blockBTranslateY, blockBVisible, reduceMotion]);

  useEffect(() => {
    if (phasesUnlockedRef.current) return;
    if (!session.isAnalyzingSource && !session.isStreamGenerating) return;
    phasesUnlockedRef.current = true;
    setPhasesVisible(true);
    setProgressVisible(true);
  }, [session.isAnalyzingSource, session.isStreamGenerating]);

  useEffect(() => {
    if (status === 'error') {
      setPhasesVisible(false);
      setProgressVisible(false);
      setOrbVisible(false);
      clearAutoOpenTimer();
      return;
    }

    if (status !== 'ready') {
      setOrbVisible(false);
      clearAutoOpenTimer();
      return;
    }

    const fadeMs = reduceMotion ? REDUCED_FADE_MS : PHASE_FADE_OUT_MS;
    phaseBlockOpacity.value = withTiming(0, { duration: fadeMs }, (finished) => {
      if (finished) {
        runOnJS(setPhasesVisible)(false);
        runOnJS(setProgressVisible)(false);
        runOnJS(setOrbVisible)(true);
      }
    });
  }, [phaseBlockOpacity, reduceMotion, status]);

  useEffect(() => {
    if (!orbVisible) return;

    const fadeMs = reduceMotion ? REDUCED_FADE_MS : BUBBLE_ENTER_MS;
    orbOpacity.value = withTiming(1, { duration: fadeMs });
    orbScale.value = reduceMotion
      ? 1
      : withSpring(1, { damping: 26, stiffness: 300 });

    if (!hapticFiredRef.current) {
      hapticFiredRef.current = true;
      stepHaptic();
    }

    if (autoOpenCancelledRef.current) return;

    autoOpenTimerRef.current = setTimeout(() => {
      autoOpenTimerRef.current = null;
      if (autoOpenCancelledRef.current) return;
      if (AppState.currentState !== 'active') {
        autoOpenCancelledRef.current = true;
        return;
      }
      openResult();
    }, AUTO_OPEN_MS);

    return () => clearAutoOpenTimer();
  }, [orbVisible]);

  useEffect(() => {
    if (status === 'generating' && phasesUnlockedRef.current) {
      setPhasesVisible(true);
      setProgressVisible(true);
    }
  }, [status]);

  const phaseBlockStyle = useAnimatedStyle(() => ({
    opacity: phaseBlockOpacity.value,
  }));

  const orbEntranceStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: orbScale.value }],
  }));

  const blockBStyle = useAnimatedStyle(() => ({
    opacity: blockBOpacity.value,
    transform: [{ translateY: blockBTranslateY.value }],
  }));

  const ackStyle = useAnimatedStyle(() => ({
    opacity: ackOpacity.value,
    transform: [{ translateY: ackTranslateY.value }],
  }));

  if (!snapshot || status === 'idle') return null;

  const showProgressBlock =
    (status === 'generating' || status === 'ready') && (phasesVisible || progressVisible);

  return (
    <View className="w-full gap-4 px-1">
      <UserBubble
        snapshot={snapshot}
        reduceMotion={reduceMotion}
        maxWidth={bubbleMaxWidth}
        mutedIcon={mutedIcon}
      />

      {blockBVisible ? (
        <Animated.View style={blockBStyle} className="w-full">
          <Text className="text-[13px] font-semibold uppercase tracking-[0.08em] text-secondary">
            nucleo
          </Text>

          <Animated.Text
            style={ackStyle}
            className="mt-2 text-[17px] leading-6 text-primary"
          >
            {snapshot.conversationalMessage}
          </Animated.Text>

          {status === 'error' ? (
            <View className="mt-3 w-full">
              <SessionErrorBanner inline className="mb-0" />
            </View>
          ) : null}

          {showProgressBlock ? (
            <Animated.View style={phaseBlockStyle} className="mt-3 w-full">
              {phasesVisible ? (
                <LoadingPhaseLabel
                  text={phaseLabel}
                  reduceMotion={reduceMotion}
                  align="left"
                  variant="meta"
                />
              ) : null}
              {progressVisible ? (
                <View className="mt-2">
                  <GenerationProgressBar
                    progressShared={session.streamProgressShared}
                    reduceMotion={reduceMotion}
                    width={200}
                  />
                </View>
              ) : null}
            </Animated.View>
          ) : null}

          {orbVisible && status === 'ready' ? (
            <Pressable
              ref={orbBlockRef}
              collapsable={false}
              onPress={openResult}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${title}`}
              className="mt-3 w-full flex-row items-center gap-3"
            >
              <Animated.View style={orbEntranceStyle}>
                <ExactLiquidOrbWebView size={ORB_SIZE} reduceMotion={reduceMotion} />
              </Animated.View>
              <View className="min-w-0 flex-1">
                <Text className="text-[17px] font-semibold leading-6 text-primary" numberOfLines={2}>
                  {title}
                </Text>
                {metaLabel ? (
                  <Text className="mt-1 text-[13px] text-secondary">{metaLabel}</Text>
                ) : null}
              </View>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
