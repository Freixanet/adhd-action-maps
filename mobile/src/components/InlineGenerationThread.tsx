import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { File, Link2 } from 'lucide-react-native';
import ExactLiquidOrbWebView from './ExactLiquidOrbWebView';
import GlassSurface from './GlassSurface';
import SessionErrorBanner from './SessionErrorBanner';
import {
  ANALYZING_SOURCE_LABEL,
  GenerationProgressBar,
  LoadingPhaseLabel,
  LOADING_PHASE_LABELS,
} from './loadingGenerationUi';
import { stepHaptic, useAppSession, type InlineUserTurnSnapshot } from '../context/AppSessionContext';
import { useTheme } from '../context/ThemeContext';

const INLINE_PHASE_FADE_MS = 200;
const INLINE_PHASE_FADE_REDUCE_MS = 150;

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

function formatLinkDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname || url;
  } catch {
    return url;
  }
}

function resolveUserBubble(snapshot: InlineUserTurnSnapshot) {
  if (snapshot.uploadedFile) {
    const kind = snapshot.uploadedFile.isPdf
      ? 'PDF'
      : snapshot.uploadedFile.isImage
        ? 'Imagen'
        : 'Archivo';
    return { kind: 'chip' as const, label: `${kind} · ${snapshot.uploadedFile.name}` };
  }
  if (snapshot.urlKind === 'youtube' || snapshot.urlKind === 'link') {
    return { kind: 'chip' as const, label: formatLinkDomain(snapshot.sourceLabel) };
  }
  const text = snapshot.pastedText?.trim() || snapshot.text?.trim() || '';
  return { kind: 'text' as const, text };
}

type InlineGenerationThreadProps = {
  onOrbLayoutReady?: () => void;
};

export default function InlineGenerationThread({ onOrbLayoutReady }: InlineGenerationThreadProps) {
  const session = useAppSession();
  const { isDark } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [phaseBlockVisible, setPhaseBlockVisible] = useState(true);
  const orbBlockRef = useRef<View>(null);
  const phaseBlockOpacity = useSharedValue(1);
  const orbScale = useSharedValue(1);
  const mutedIcon = isDark ? '#a3a3a3' : '#737373';

  const snapshot = session.inlineUserTurn;
  const status = session.inlineGenerationStatus;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    session.registerInlineOrbOpenHandler(() => {
      orbBlockRef.current?.measureInWindow((x, y, width, height) => {
        session.openInlineResult({ x, y, width, height, borderRadius: 36 });
      });
    });
    return () => session.registerInlineOrbOpenHandler(null);
  }, [session]);

  useEffect(() => {
    if (status === 'generating') {
      setPhaseBlockVisible(true);
      phaseBlockOpacity.value = 1;
      orbScale.value = reduceMotion ? 1 : 0.6;
      return;
    }

    if (status !== 'ready') {
      setPhaseBlockVisible(true);
      phaseBlockOpacity.value = 1;
      orbScale.value = reduceMotion ? 1 : 0.6;
      return;
    }

    setPhaseBlockVisible(true);
    const fadeMs = reduceMotion ? INLINE_PHASE_FADE_REDUCE_MS : INLINE_PHASE_FADE_MS;
    phaseBlockOpacity.value = withTiming(0, { duration: fadeMs }, (finished) => {
      if (finished) runOnJS(setPhaseBlockVisible)(false);
    });
  }, [phaseBlockOpacity, reduceMotion, status]);

  useEffect(() => {
    if (status !== 'ready' || phaseBlockVisible) return;
    orbScale.value = reduceMotion
      ? 1
      : withSpring(1, { damping: 26, stiffness: 300 });
    stepHaptic();
    onOrbLayoutReady?.();
  }, [onOrbLayoutReady, orbScale, phaseBlockVisible, reduceMotion, status]);

  const phaseLabel = session.isAnalyzingSource
    ? ANALYZING_SOURCE_LABEL
    : LOADING_PHASE_LABELS[session.streamLoadPhase] ?? LOADING_PHASE_LABELS[0];

  const phaseBlockStyle = useAnimatedStyle(() => ({
    opacity: phaseBlockOpacity.value,
  }));

  const orbEntranceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const bubble = useMemo(() => (snapshot ? resolveUserBubble(snapshot) : null), [snapshot]);
  const title = session.data?.title?.trim() || session.data?.coreIdea?.trim() || 'Tu Núcleo';
  const stepCount = session.data?.steps?.length ?? 0;
  const totalMinutes = parseTotalMinutes(session.data?.steps);
  const metaLabel =
    totalMinutes !== null && stepCount > 0
      ? `~${totalMinutes} min · ${stepCount} pasos`
      : stepCount > 0
        ? `${stepCount} pasos`
        : undefined;

  if (!snapshot || status === 'idle') return null;

  const handleOpenResult = () => {
    orbBlockRef.current?.measureInWindow((x, y, width, height) => {
      session.openInlineResult({ x, y, width, height, borderRadius: 36 });
    });
  };

  return (
    <View className="w-full px-1 pb-4">
      {bubble ? (
        <View className="mb-4 w-full items-end">
          <GlassSurface liquid variant="composer" borderRadius={20} liquidBorder="perimeter">
            <View className="max-w-[88%] px-4 py-3">
              {bubble.kind === 'chip' ? (
                <View className="flex-row items-center gap-2">
                  {snapshot.urlKind ? (
                    <Link2 size={15} color={mutedIcon} />
                  ) : (
                    <File size={15} color={mutedIcon} />
                  )}
                  <Text className="text-[15px] text-primary" numberOfLines={1}>
                    {bubble.label}
                  </Text>
                </View>
              ) : (
                <Text className="text-[15px] leading-[22px] text-primary" numberOfLines={2}>
                  {bubble.text}
                </Text>
              )}
            </View>
          </GlassSurface>
        </View>
      ) : null}

      <View className="w-full max-w-full items-start">
        <Text className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">
          nucleo
        </Text>

        {status === 'error' ? (
          <SessionErrorBanner inline className="w-full" />
        ) : null}

        {phaseBlockVisible && status !== 'error' ? (
          <Animated.View style={phaseBlockStyle} className="w-full">
            <View className="min-h-[22px] justify-center">
              <LoadingPhaseLabel text={phaseLabel} reduceMotion={reduceMotion} align="left" />
            </View>
            <View className="mt-3 w-full">
              <GenerationProgressBar
                progressShared={session.streamProgressShared}
                reduceMotion={reduceMotion}
                fullWidth
              />
            </View>
          </Animated.View>
        ) : null}

        {status === 'ready' && !phaseBlockVisible ? (
          <Pressable
            ref={orbBlockRef}
            collapsable={false}
            onPress={handleOpenResult}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${title}`}
            className="w-full flex-row items-center gap-3"
          >
            <Animated.View style={orbEntranceStyle}>
              <ExactLiquidOrbWebView size={72} reduceMotion={reduceMotion} />
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
      </View>
    </View>
  );
}
