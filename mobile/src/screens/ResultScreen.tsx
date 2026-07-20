import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { initialWindowMetrics, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import AppIcon from '../components/AppIcon';
import CompletionGlassButton from '../components/CompletionGlassButton';
import CompletionOverflowMenu from '../components/CompletionOverflowMenu';
import IncompleteTransformBanner from '../components/IncompleteTransformBanner';
import SessionErrorBanner from '../components/SessionErrorBanner';
import MapChatSheet from '../components/MapChatSheet';
import ReadingProgressBar, { mapContentTopPadding } from '../components/ReadingProgressBar';
import { useMapHeaderAutoHide } from '../hooks/useMapHeaderAutoHide';
import SourceMetadataGlassCard from '../components/SourceMetadataGlassCard';
import StepContentBlocks from '../components/StepContentBlocks';
import StepFooterNav from '../components/StepFooterNav';
import StepSlideTransition from '../components/StepSlideTransition';
import SourceCoverageCard from '../components/SourceCoverageCard';
import TakeawaysGlassCard from '../components/TakeawaysGlassCard';
import KnowledgeSectionsList from '../components/KnowledgeSectionsList';
import NucleoVisualOverview from '../components/NucleoVisualOverview';
import SectionCompleteCue from '../components/SectionCompleteCue';
import { stepHaptic, useAppSession } from '../context/AppSessionContext';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useViewAllScrollSpy } from '../hooks/useViewAllScrollSpy';
import { getIntentLabel, getSourceTypeLabel } from '@shared/categories';
import { formatReadingProgressLabel, getReadingSectionForStep } from '@shared/nucleoPipeline';
import { normalizeNucleoVisual } from '@shared/nucleoVisual';
import type { SourceReference, StepContentBlock } from '../logic/contracts';
import { debugTransitionLog } from '../logic/debugTransitionLog';

const PREVIEW_TOP_INSET = initialWindowMetrics?.insets.top ?? 0;

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

function ReferencesChips({ references }: { references?: SourceReference[] }) {
  if (!references?.length) return null;

  return (
    <View className="mt-4 flex-row flex-wrap gap-2">
      {references.slice(0, 3).map((reference, idx) => (
        <View
          key={`${reference.label}-${reference.locator}-${idx}`}
          className="max-w-full flex-row items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5"
          style={{ flexShrink: 1 }}
        >
          <Text className="text-xs text-secondary shrink" numberOfLines={1}>
            {reference.label}
          </Text>
          <Text className="text-xs text-body shrink" numberOfLines={1}>
            {reference.locator}
          </Text>
        </View>
      ))}
    </View>
  );
}

const VIEW_ALL_SECTION_DIVIDER = 'pb-8 mb-8 border-b border-neutral-200 border-white/10';
const VIEW_ALL_SECTION_BEFORE_COMPLETION = 'pb-8';
const VIEW_ALL_COMPLETION_SECTION = 'pt-8 pb-8 border-t border-neutral-200 border-white/10';

type ResultScreenProps = {
  previewMode?: boolean;
  suppressStepTransitions?: boolean;
  onHandoffLayout?: () => void;
};

export default function ResultScreen({
  previewMode = false,
  suppressStepTransitions = false,
  onHandoffLayout,
}: ResultScreenProps = {}) {
  const session = useAppSession();
  const { data } = session;
  const safeInsets = useSafeAreaInsets();
  const handoffReportedRef = React.useRef(false);
  const rootLaidOutRef = React.useRef(false);

  useEffect(() => {
    if (!previewMode && !onHandoffLayout) return;
    // #region agent log
    debugTransitionLog('H1', 'ResultScreen.tsx:insets', 'result safe area insets', {
      previewMode,
      handoffPending: Boolean(onHandoffLayout),
      insetTop: safeInsets.top,
      insetBottom: safeInsets.bottom,
    });
    // #endregion
  }, [onHandoffLayout, previewMode, safeInsets.bottom, safeInsets.top]);

  useEffect(() => {
    if (previewMode || !onHandoffLayout || handoffReportedRef.current || !rootLaidOutRef.current) {
      return;
    }
    handoffReportedRef.current = true;
    // #region agent log
    debugTransitionLog('H3', 'ResultScreen.tsx:handoffEffect', 'handoff from layout effect', {}, 'post-fix-v4');
    // #endregion
    onHandoffLayout();
  }, [onHandoffLayout, previewMode]);

  const scrollProgress = useSharedValue(0);

  const hideProgressLine =
    (!session.viewAll && !session.isComplete && session.currentStep === 0) ||
    session.isComplete;

  // Do not include currentStep — chrome hide should persist across step changes.
  const mapHeaderResetKey = `${session.viewAll}:${session.isComplete}`;

  const syncReadingStep = useCallback(
    (step: number) => session.syncReadingStep(step),
    [session]
  );
  const { registerSectionLayout, handleScrollViewLayout, handleScroll, resetSpy } = useViewAllScrollSpy({
    enabled: session.viewAll,
    totalSteps: session.totalSteps,
    onStepChange: syncReadingStep,
  });

  const reportScrollSpy = useCallback(
    (scrollY: number, contentHeight: number) => {
      if (!session.viewAll) return;
      handleScroll({
        nativeEvent: {
          contentOffset: { y: scrollY, x: 0 },
          contentSize: { height: contentHeight, width: 0 },
          layoutMeasurement: { height: 0, width: 0 },
        },
      } as NativeSyntheticEvent<NativeScrollEvent>);
    },
    [handleScroll, session.viewAll]
  );

  const { scrollRef, headerVisible, handleMapMetaAnchorLayout, scrollHandler } = useMapHeaderAutoHide({
    hideProgressLine,
    mapKey: session.historyStore.activeId ?? 'none',
    resetKey: mapHeaderResetKey,
    scrollProgress,
    onScrollReport: reportScrollSpy,
  });

  useEffect(() => {
    if (!session.viewAll) resetSpy();
  }, [resetSpy, session.viewAll]);

  useEffect(() => {
    if (!session.viewAll) {
      scrollProgress.value = 0;
    }
  }, [scrollProgress, session.viewAll]);

  const totalMinutes = useMemo(() => parseTotalMinutes(data?.steps), [data?.steps]);
  const visualOverview = useMemo(
    () => normalizeNucleoVisual(data?.visualization, data?.tldr ?? []),
    [data?.tldr, data?.visualization]
  );

  const { reduceMotion } = useGlassAccessibility();
  const completionCheckScale = useSharedValue(1);
  const [ceremonyTitleReady, setCeremonyTitleReady] = useState(true);

  useEffect(() => {
    if (!session.isComplete || session.essentialsReview || session.viewAll) {
      completionCheckScale.value = 1;
      setCeremonyTitleReady(true);
      return;
    }

    const shouldCeremony = session.triggerCompletionCeremonyIfNeeded();
    if (!shouldCeremony) {
      completionCheckScale.value = 1;
      setCeremonyTitleReady(true);
      return;
    }

    if (reduceMotion) {
      completionCheckScale.value = 1;
      setCeremonyTitleReady(true);
      return;
    }

    completionCheckScale.value = 0.8;
    completionCheckScale.value = withSpring(1, { damping: 14, stiffness: 160 });
    setCeremonyTitleReady(false);
    const timer = setTimeout(() => setCeremonyTitleReady(true), 120);
    return () => clearTimeout(timer);
  }, [
    completionCheckScale,
    reduceMotion,
    session.triggerCompletionCeremonyIfNeeded,
    session.essentialsReview,
    session.historyStore.activeId,
    session.isComplete,
    session.viewAll,
  ]);

  const completionCheckStyle = useAnimatedStyle(() => ({
    transform: [{ scale: completionCheckScale.value }],
  }));

  const remainingMinutes = useMemo(() => {
    if (session.viewAll || session.isComplete || session.currentStep < 2) return null;
    return parseTotalMinutes(data?.steps?.slice(session.currentStep - 1));
  }, [data?.steps, session.currentStep, session.isComplete, session.viewAll]);
  const remainingLabel =
    remainingMinutes && remainingMinutes > 0 ? `~${remainingMinutes} min restantes` : undefined;

  const isStepMode = !session.isComplete && !session.viewAll;
  const swipeEnabled = isStepMode && !session.historyOpen && !session.isStreamGenerating;

  const navDir = useSharedValue(1);
  const canPrev = useSharedValue(false);
  const canNext = useSharedValue(false);

  useEffect(() => {
    canPrev.value = swipeEnabled && session.currentStep > 0;
    canNext.value = swipeEnabled && session.currentStep < session.totalSteps + 1;
  }, [canNext, canPrev, session.currentStep, session.totalSteps, swipeEnabled]);

  const commitStep = useCallback(
    (dir: 1 | -1) => {
      navDir.value = dir;
      session.goToStep(session.currentStep + dir);
    },
    [navDir, session]
  );

  const tryReverseContinue = useCallback(() => {
    if (previewMode) return;
    if (!session.canReverseContinueTransition()) return;
    session.startReverseContinueTransition();
  }, [previewMode, session]);

  const handleRootLayout = useCallback(
    (event: import('react-native').LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      rootLaidOutRef.current = true;
      // #region agent log
      debugTransitionLog('H1', 'ResultScreen.tsx:rootLayout', 'result root layout', {
        previewMode,
        suppressStepTransitions,
        layoutX: x,
        layoutY: y,
        layoutW: width,
        layoutH: height,
        insetTop: previewMode ? PREVIEW_TOP_INSET : safeInsets.top,
        handoffPending: Boolean(onHandoffLayout),
      });
      // #endregion
      if (!onHandoffLayout || handoffReportedRef.current) return;
      handoffReportedRef.current = true;
      // #region agent log
      debugTransitionLog('H3', 'ResultScreen.tsx:handoff', 'handoff layout fired', { previewMode });
      // #endregion
      onHandoffLayout();
    },
    [onHandoffLayout, previewMode, safeInsets.top, suppressStepTransitions]
  );

  const backHomeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!previewMode)
        .activeOffsetX(24)
        .failOffsetY([-24, 24])
        .onTouchesDown((event, stateManager) => {
          'worklet';
          const touch = event.allTouches[0];
          if (!touch || touch.absoluteX > 36) {
            stateManager.fail();
          }
        })
        .onEnd((event) => {
          'worklet';
          if (event.translationX > 56 || event.velocityX > 520) {
            runOnJS(tryReverseContinue)();
          }
        }),
    [previewMode, tryReverseContinue]
  );

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(swipeEnabled)
        .activeOffsetX([-15, 15])
        .failOffsetY([-20, 20])
        .onTouchesDown((event, stateManager) => {
          'worklet';
          const touch = event.allTouches[0];
          if (touch && touch.absoluteX < 30) {
            stateManager.fail();
          }
        })
        .onEnd((event) => {
          'worklet';
          const { translationX, velocityX } = event;
          if ((translationX < -40 || velocityX < -500) && canNext.value) {
            runOnJS(commitStep)(1);
          } else if ((translationX > 40 || velocityX > 500) && canPrev.value) {
            runOnJS(commitStep)(-1);
          }
        }),
    [canNext, canPrev, commitStep, swipeEnabled]
  );

  const contentModeKey = useMemo(() => {
    return [
      session.viewAll ? 'view-all' : 'step-mode',
      session.isComplete ? 'complete' : 'active',
      session.essentialsReview ? 'essentials' : 'content',
      session.isStreamGenerating ? 'stream' : 'idle',
    ].join(':');
  }, [
    session.essentialsReview,
    session.isComplete,
    session.isStreamGenerating,
    session.viewAll,
  ]);

  const showStepSlide =
    isStepMode && !suppressStepTransitions && !session.isStreamGenerating;

  useEffect(() => {
    if (isStepMode) {
      headerVisible.value = true;
    }
  }, [headerVisible, isStepMode]);

  const toggleStepHeader = useCallback(() => {
    if (!isStepMode) return;
    headerVisible.value = !headerVisible.value;
    stepHaptic();
  }, [headerVisible, isStepMode]);

  const stepHeaderVisibleTopPadding = mapContentTopPadding(hideProgressLine);
  const stepHeaderHiddenTopPadding = 20;
  const stepPageChromeStyle = useAnimatedStyle(() => ({
    paddingTop: withTiming(
      headerVisible.value ? stepHeaderVisibleTopPadding : stepHeaderHiddenTopPadding,
      { duration: reduceMotion ? 0 : 220 }
    ),
  }), [reduceMotion, stepHeaderHiddenTopPadding, stepHeaderVisibleTopPadding]);

  if (!data) return null;

  const isIntroStep = !session.isComplete && !session.viewAll && session.currentStep === 0;
  const isStudyDocBeta = data.generationMode === 'study-doc-beta';

  const renderMapMeta = () => (
    <View onLayout={handleMapMetaAnchorLayout} collapsable={false} className="mb-10">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-bold uppercase tracking-[0.16em] text-secondary text-body shrink">
          {data.title}
        </Text>
        {isStudyDocBeta ? (
          <View className="rounded-full bg-accent/12 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
              StudyDoc beta
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="mt-2 text-xs text-secondary">
        {[
          getSourceTypeLabel(
            session.historyStore.entries.find(
              (entry) => entry.id === session.historyStore.activeId
            )?.sourceType ?? 'text',
            data.sourceMetadata?.kind
          ),
          data.intent ? getIntentLabel(data.intent) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </View>
  );

  const renderResumen = (
    interactive = false,
    options: { includeTldr?: boolean } = {}
  ) => {
    const includeTldr = options.includeTldr ?? true;

    return (
    <Pressable
      disabled={!interactive}
      onPress={interactive ? () => session.goToStep(0, true) : undefined}
      className={interactive ? VIEW_ALL_SECTION_DIVIDER : 'mb-8'}
    >
      {renderMapMeta()}
      <View className="flex-row items-center flex-wrap gap-x-3 gap-y-2 mb-4">
        <View className="flex-row items-center gap-2">
          <AppIcon size={20} />
          <Text className="text-sm font-bold tracking-widest uppercase text-primary">
            Idea central
          </Text>
        </View>
        {!session.isComplete && totalMinutes !== null ? (
          <View className="flex-row items-center gap-1.5">
            <Clock size={16} color="#4338ca" />
            <Text className="text-sm font-semibold text-accent">
              ~{totalMinutes} min
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="text-2xl font-bold text-primary leading-9">{data.coreIdea}</Text>
      {data.coreSupport ? (
        <Text className="mt-4 text-lg leading-7 text-body text-secondary">{data.coreSupport}</Text>
      ) : null}

      {data.sourceMetadata ? (
        <SourceMetadataGlassCard sourceMetadata={data.sourceMetadata} />
      ) : null}

      {includeTldr && data.tldr?.length ? (
        <View className="mt-8 pt-8 border-t border-neutral-200 border-white/10">
          <Text className="text-xs font-bold uppercase tracking-widest text-secondary mb-6">
            En 60 segundos
          </Text>
          {data.tldr.map((item, i) => (
            <View key={i} className="flex-row gap-4 items-start mb-6">
              <View className="w-8 h-8 rounded-full border-2 border-neutral-200 border-white/10 items-center justify-center">
                <Text className="text-sm font-bold text-secondary">{i + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-primary mb-2">
                  {item.title}
                </Text>
                <Text className="text-base leading-6 text-body">{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
    );
  };

  const renderHighlightCard = (
    label: string,
    text: string,
    kind: StepContentBlock['kind'] = 'info'
  ) => {
    const accent =
      kind === 'alert'
        ? '#E07A6B'
        : kind === 'action'
          ? '#6FBF8F'
          : '#8B8FF5';

    return (
      <View className="mt-2" style={styles.fixedHighlightCard}>
        <Text
          className="text-[12px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: accent }}
        >
          {label}
        </Text>
        <View
          className="mt-2.5 mb-3"
          style={{
            width: 28,
            height: 1.5,
            borderRadius: 1,
            backgroundColor: accent,
            opacity: 0.7,
          }}
        />
        <Text className="text-[17px] leading-[25px] text-body">{text}</Text>
      </View>
    );
  };

  const renderTldrPage = () => (
    <View style={styles.fixedPage}>
      <View>
        <Text className="text-sm font-bold uppercase tracking-widest text-accent">
          Mapa visual · En 60 segundos
        </Text>
        <Text className="mt-3 text-2xl font-bold text-primary leading-9">
          {visualOverview?.title || 'El Núcleo antes de entrar en los pasos'}
        </Text>
      </View>

      {visualOverview ? <NucleoVisualOverview visual={visualOverview} /> : null}

      {renderHighlightCard(
        'Hilo conductor',
        data.coreSupport || data.coreIdea,
        'info'
      )}
    </View>
  );

  const renderStep = (stepIndex: number, interactive = false, isLastStep = false) => {
    const step = data.steps[stepIndex - 1];
    if (!step) return null;

    const stepDividerClass = interactive
      ? isLastStep
        ? VIEW_ALL_SECTION_BEFORE_COMPLETION
        : VIEW_ALL_SECTION_DIVIDER
      : '';
    const stepLabel = formatReadingProgressLabel(
      stepIndex,
      session.totalSteps,
      data.readingSections ?? null
    );
    const completedSection =
      session.sectionCompleteCue != null
        ? getReadingSectionForStep(session.sectionCompleteCue, data.readingSections ?? null)
        : null;
    const hasCallout = step.content?.some(
      (block) => String(block.type || '').toLowerCase() === 'callout'
    );

    return (
      <Pressable
        key={step.id || stepIndex}
        disabled={!interactive}
        onPress={interactive ? () => session.goToStep(stepIndex + 1, true) : undefined}
        className={stepDividerClass}
        style={!interactive ? styles.fixedPage : undefined}
      >
        {!interactive && session.sectionCompleteCue != null ? (
          <SectionCompleteCue
            visible
            sectionTitle={completedSection?.title}
          />
        ) : null}
        <View className="flex-row flex-wrap items-center gap-2 mb-4">
          <Text className="text-sm font-bold uppercase tracking-widest text-accent dark:text-accent">
            {stepLabel}
          </Text>
          {step.time ? <Text className="text-sm text-secondary">{step.time}</Text> : null}
        </View>
        <Text
          className="text-2xl font-bold text-primary leading-9 mb-4"
          numberOfLines={!interactive ? 2 : undefined}
        >
          {step.title}
        </Text>
        {step.purpose ? (
          <Text
            className="text-[17px] leading-[26px] text-body mb-4"
            numberOfLines={!interactive ? 3 : undefined}
          >
            {step.purpose}
          </Text>
        ) : null}
        {!interactive && !hasCallout && (step.purpose || step.content?.[0]?.text) ? (
          renderHighlightCard(
            'Idea clave',
            step.purpose || step.content?.[0]?.text || '',
            'info'
          )
        ) : null}
        <View style={!interactive ? styles.fixedStepBody : undefined}>
          <StepContentBlocks blocks={step.content} />
        </View>
        <ReferencesChips references={step.references} />
      </Pressable>
    );
  };

  const renderEssentialsReview = () => {
    const takeaways =
      data.completionCard?.takeaways?.length
        ? data.completionCard.takeaways
        : data.tldr?.map((item) => `${item.title}: ${item.desc}`) ?? [];

    return (
      <View className="py-6">
        <Text className="text-xs font-bold uppercase tracking-widest text-secondary">Repaso esencial</Text>
        <Text className="mt-6 text-2xl font-extrabold text-primary">{data.coreIdea}</Text>
        {takeaways.length ? <TakeawaysGlassCard items={takeaways} /> : null}
        <View className="mt-10 flex-row flex-wrap gap-3" style={styles.completionActions}>
          <View style={styles.completionActionFullWidthSlot}>
            <CompletionGlassButton
              label="Volver al Núcleo completado"
              onPress={() => session.setEssentialsReview(false)}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderCompletionActions = () => {
    const openAsk = () => {
      if (!session.isPro) {
        session.openPaywall();
        stepHaptic();
        return;
      }
      session.setChatOpen(true);
      stepHaptic();
    };

    return (
      <View className="mt-10 gap-3" style={styles.completionActions}>
        <View className="flex-row gap-3 w-full items-center">
          <View style={styles.completionActionSlot}>
            <CompletionGlassButton
              label="Repasar lo esencial"
              onPress={() => session.setEssentialsReview(true)}
            />
          </View>
          <View style={styles.completionActionSlot}>
            <CompletionGlassButton label="Preguntar" onPress={openAsk} />
          </View>
        </View>
        <View style={styles.completionActionFullWidthSlot}>
          <CompletionGlassButton
            label="Guardar ficha PDF"
            onPress={() => void session.handleDownloadPdf()}
            disabled={!session.historyStore.activeId || session.isPdfGenerating}
          />
        </View>
        <View style={styles.completionActionFullWidthSlot}>
          <CompletionGlassButton
            label="Nuevo Núcleo"
            variant="accent"
            onPress={session.handleNewMap}
          />
        </View>
        <View className="w-full items-end">
          <CompletionOverflowMenu
            onViewAll={session.enterCompletedViewAll}
          />
        </View>
      </View>
    );
  };

  const renderCompletionBody = (plainTakeaways = true) => (
    <>
      <Text className="mt-4 text-lg leading-7 text-body">
        {data.completionCard?.summary || 'Aquí tienes lo esencial para retomarlo con rapidez.'}
      </Text>
      <TakeawaysGlassCard items={data.completionCard?.takeaways ?? []} plain={plainTakeaways} />
      <SourceCoverageCard
        coverage={data.coverage}
        limitations={data.sourceMetadata?.limitations}
        knowledgeSectionsCount={data.knowledgeSections?.length}
        plain
      />
      <KnowledgeSectionsList sections={data.knowledgeSections} />
    </>
  );

  const renderCompletion = () => (
    <View className="py-6">
      <View className="flex-row items-center gap-2 mb-4">
        <Animated.View style={completionCheckStyle}>
          <CheckCircle2 size={16} color="#8B8FF5" />
        </Animated.View>
        <Text className="text-xs font-bold uppercase tracking-widest text-secondary">Núcleo completado</Text>
      </View>
      {ceremonyTitleReady ? (
        <Animated.Text
          entering={FadeIn.duration(reduceMotion ? 150 : 250)}
          className="text-3xl font-extrabold text-primary"
        >
          {data.completionCard?.title || 'Has terminado esta lectura'}
        </Animated.Text>
      ) : (
        <Text className="text-3xl font-extrabold text-primary opacity-0">
          {data.completionCard?.title || 'Has terminado esta lectura'}
        </Text>
      )}
      {renderCompletionBody(true)}
      {renderCompletionActions()}
    </View>
  );

  const renderCompletedViewAll = () => (
    <>
      <View onLayout={(event) => registerSectionLayout(0, event)}>{renderResumen(true)}</View>
      {data.steps.map((_, idx) => {
        const stepIndex = idx + 1;
        const isLastStep = stepIndex === session.totalSteps;
        return (
          <View
            key={data.steps[idx]?.id ?? stepIndex}
            onLayout={(event) => registerSectionLayout(stepIndex, event)}
          >
            {renderStep(stepIndex, true, isLastStep)}
          </View>
        );
      })}
      <View className={VIEW_ALL_COMPLETION_SECTION}>
        <View className="flex-row items-center gap-2 mb-4">
          <CheckCircle2 size={16} color="#8B8FF5" />
          <Text className="text-xs font-bold uppercase tracking-widest text-secondary">Núcleo completado</Text>
        </View>
        <Text className="text-3xl font-extrabold text-primary">
          {data.completionCard?.title || 'Has terminado esta lectura'}
        </Text>
        {renderCompletionBody(false)}
        {renderCompletionActions()}
      </View>
    </>
  );

  const renderViewAllCompletion = () => (
    <View className={VIEW_ALL_COMPLETION_SECTION}>
      <View className="flex-row items-center gap-2 mb-4">
        <CheckCircle2 size={16} color="#8B8FF5" />
        <Text className="text-xs font-bold uppercase tracking-widest text-secondary">Núcleo completado</Text>
      </View>
      <Text className="text-3xl font-extrabold text-primary">
        {data.completionCard?.title || 'Has terminado esta lectura'}
      </Text>
      <Text className="mt-4 text-lg leading-7 text-body">
        {data.completionCard?.summary || 'Aquí tienes lo esencial para retomarlo con rapidez.'}
      </Text>
      <TakeawaysGlassCard items={data.completionCard?.takeaways ?? []} />
      <View className="mt-10" style={styles.completionActions}>
        <CompletionGlassButton
          label="Completar Núcleo"
          onPress={session.handleCompleteMap}
          icon={<CheckCircle2 size={16} color="#fff" />}
          variant="accent"
        />
      </View>
    </View>
  );

  const renderStepModeReading = (step: number) => {
    if (step === 0) return renderResumen(false, { includeTldr: false });
    if (step === 1) return renderTldrPage();
    return renderStep(step - 1, false);
  };

  const renderModeBody = () => {
    if (session.isComplete) {
      if (session.essentialsReview) return renderEssentialsReview();
      if (session.viewAll) return renderCompletedViewAll();
      return renderCompletion();
    }

    if (session.viewAll) {
      return (
        <>
          <View onLayout={(event) => registerSectionLayout(0, event)}>
            {renderResumen(true)}
          </View>
          {data.steps.map((_, idx) => {
            const stepIndex = idx + 1;
            const isLastStep = stepIndex === session.totalSteps;
            return (
              <View
                key={data.steps[idx]?.id ?? stepIndex}
                onLayout={(event) => registerSectionLayout(stepIndex, event)}
              >
                {renderStep(stepIndex, true, isLastStep)}
              </View>
            );
          })}
          {renderViewAllCompletion()}
        </>
      );
    }

    return renderStepModeReading(session.currentStep);
  };

  const resultShell = (
    <GestureDetector gesture={backHomeGesture}>
      <View className="flex-1 relative overflow-hidden">
      <ReadingProgressBar
        viewAll={session.viewAll}
        isComplete={session.isComplete}
        stepProgress={session.stepProgress}
        progressLabel={session.progressLabel}
        scrollProgressShared={scrollProgress}
        headerVisibleShared={headerVisible}
        hideProgressLine={hideProgressLine}
        remainingLabel={remainingLabel}
        onToggleSidebar={() => session.toggleHistoryDrawer()}
        onToggleViewMode={session.isComplete ? undefined : session.toggleViewMode}
      />

      <SessionErrorBanner className="px-5" />

      <IncompleteTransformBanner />

      <View className="flex-1">
        {isStepMode ? (
          <GestureDetector gesture={swipeGesture}>
            <Animated.View className="flex-1 px-5" style={stepPageChromeStyle}>
              <Pressable className="flex-1" onPress={toggleStepHeader}>
                <Animated.View style={[styles.readingColumn, styles.fixedReadingColumn]}>
                  {showStepSlide ? (
                    <StepSlideTransition step={session.currentStep} reduceMotion={reduceMotion}>
                      {renderStepModeReading}
                    </StepSlideTransition>
                  ) : (
                    <Animated.View
                      key={contentModeKey}
                      entering={
                        suppressStepTransitions || session.isStreamGenerating
                          ? undefined
                          : FadeIn.duration(reduceMotion ? 150 : 220)
                      }
                      exiting={
                        suppressStepTransitions
                          ? undefined
                          : FadeOut.duration(reduceMotion ? 150 : 180)
                      }
                    >
                      {renderModeBody()}
                    </Animated.View>
                  )}
                </Animated.View>
              </Pressable>
            </Animated.View>
          </GestureDetector>
        ) : (
          <Animated.ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerClassName="px-5"
            contentContainerStyle={{
              paddingTop: mapContentTopPadding(hideProgressLine),
              paddingBottom: 128,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={!isIntroStep}
            scrollEnabled={!session.historyOpen}
            onLayout={handleScrollViewLayout}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            <View>
              <Animated.View style={styles.readingColumn}>
                <Animated.View
                  key={contentModeKey}
                  entering={
                    suppressStepTransitions || session.isStreamGenerating
                      ? undefined
                      : FadeIn.duration(reduceMotion ? 150 : 220)
                  }
                  exiting={
                    suppressStepTransitions || session.viewAll
                      ? undefined
                      : FadeOut.duration(reduceMotion ? 150 : 180)
                  }
                >
                  {renderModeBody()}
                </Animated.View>
              </Animated.View>
            </View>
          </Animated.ScrollView>
        )}

        <StepFooterNav chromeVisibleShared={headerVisible} />
      </View>

      {!previewMode && session.historyStore.activeId ? (
        <MapChatSheet
          visible={session.chatOpen}
          onClose={() => session.setChatOpen(false)}
          mapId={session.historyStore.activeId}
          mapData={data}
        />
      ) : null}
      </View>
    </GestureDetector>
  );

  return previewMode ? (
    <View
      className="flex-1 bg-base"
      style={{ paddingTop: PREVIEW_TOP_INSET }}
      onLayout={handleRootLayout}
      pointerEvents="none"
    >
      {resultShell}
    </View>
  ) : (
    <SafeAreaView
      className="flex-1 bg-base"
      edges={['top', 'left', 'right']}
      onLayout={handleRootLayout}
      pointerEvents="auto"
    >
      {resultShell}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  readingColumn: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  fixedReadingColumn: {
    flex: 1,
    overflow: 'hidden',
  },
  fixedPage: {
    flex: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingBottom: 16,
  },
  fixedStepBody: {
    flexShrink: 1,
    overflow: 'hidden',
  },
  fixedHighlightCard: {
    marginTop: 12,
  },
  completionActions: {
    width: '100%',
  },
  completionActionSlot: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  completionActionFullWidthSlot: {
    width: '100%',
  },
});
