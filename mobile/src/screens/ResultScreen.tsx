import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
} from '../icons';
import AppIcon from '../components/AppIcon';
import CompletionGlassButton from '../components/CompletionGlassButton';
import CompletionOverflowMenu from '../components/CompletionOverflowMenu';
import IncompleteTransformBanner from '../components/IncompleteTransformBanner';
import SessionErrorBanner from '../components/SessionErrorBanner';
import MapChatSheet from '../components/MapChatSheet';
import ReadingProgressBar, {
  mapContentTopPadding,
  READING_PROGRESS_LINE_HEIGHT,
} from '../components/ReadingProgressBar';
import { useMapHeaderAutoHide } from '../hooks/useMapHeaderAutoHide';
import StepContentBlocks from '../components/StepContentBlocks';
import StepFooterNav from '../components/StepFooterNav';
import StepSlideTransition from '../components/StepSlideTransition';
import SourceCoverageCard from '../components/SourceCoverageCard';
import TakeawaysGlassCard from '../components/TakeawaysGlassCard';
import KnowledgeSectionsList from '../components/KnowledgeSectionsList';
import TldrBentoGrid from '../components/TldrBentoGrid';
// F3: re-spec pending — NucleoVisualOverview disconnected from ResultScreen.
// import NucleoVisualOverview from '../components/NucleoVisualOverview';
import NucleoVisualizeWebView from '../components/NucleoVisualizeWebView';
import VisualizeRunHost from '../visualize/VisualizeRunHost';
import { ensureVisualizeArtifact } from '@shared/visualizeCompiler';
import { stepHaptic, useAppSession } from '../context/AppSessionContext';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useViewAllScrollSpy } from '../hooks/useViewAllScrollSpy';
import { formatReadingProgressLabel } from '@shared/nucleoPipeline';
// F3: re-spec pending — NucleoVisualSpec normalize unused while channel is off.
// import { normalizeNucleoVisual } from '@shared/nucleoVisual';
import type { SourceReference } from '../logic/contracts';
import { debugTransitionLog } from '../logic/debugTransitionLog';
import { BG_BASE } from '@shared/uiTokens';

const PREVIEW_TOP_INSET = initialWindowMetrics?.insets.top ?? 0;
/** Ignore 1px float noise when comparing content vs viewport. */
const SCROLL_OVERFLOW_EPSILON = 1;
/** Chrome toggle must be a still tap — anything draggier belongs to the page swipe. */
const CHROME_TAP_MAX_DISTANCE = 8;
const CHROME_TAP_MAX_DURATION_MS = 300;

function useScrollOnlyWhenNeeded(scrollableOverhead = 0) {
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  // Top/bottom padding that only exists to align the resting layout must not
  // count as overflow — otherwise Idea central always enables scroll.
  const needsScroll =
    viewportH > 0 && contentH - scrollableOverhead > viewportH + SCROLL_OVERFLOW_EPSILON;

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportH(event.nativeEvent.layout.height);
  }, []);

  const onContentSizeChange = useCallback((_width: number, height: number) => {
    setContentH(height);
  }, []);

  return { needsScroll, onViewportLayout, onContentSizeChange };
}

type AdaptiveStepScrollProps = {
  scrollRef?: React.Ref<Animated.ScrollView>;
  historyOpen: boolean;
  onOuterLayout?: (event: LayoutChangeEvent) => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onPressChrome: () => void;
  children: React.ReactNode;
  /** Gap that scrolls with the content, so the cut-off stays at the header edge. */
  contentTopInset?: number;
};

/** Step-mode page scroll: disabled (no bounce) when the page fits the viewport. */
function AdaptiveStepScroll({
  scrollRef,
  historyOpen,
  onOuterLayout,
  onScroll,
  onPressChrome,
  children,
  contentTopInset = 0,
}: AdaptiveStepScrollProps) {
  // Resting alignment padding (top inset + content bottom pad) is not overflow.
  const scrollableOverhead = contentTopInset + 16;
  const { needsScroll, onViewportLayout, onContentSizeChange } =
    useScrollOnlyWhenNeeded(scrollableOverhead);

  // A deliberate tap, not the tail of a page swipe: Pressable fires even after
  // drags that never reach the swipe threshold.
  const chromeTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(CHROME_TAP_MAX_DISTANCE)
        .maxDuration(CHROME_TAP_MAX_DURATION_MS)
        .onEnd((_event, success) => {
          'worklet';
          if (success) runOnJS(onPressChrome)();
        }),
    [onPressChrome]
  );

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.adaptiveScroll}
      contentContainerStyle={[
        styles.adaptiveScrollContent,
        contentTopInset ? { paddingTop: contentTopInset } : null,
      ]}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      scrollEnabled={!historyOpen && needsScroll}
      bounces={needsScroll}
      alwaysBounceVertical={needsScroll}
      overScrollMode={needsScroll ? 'auto' : 'never'}
      onLayout={(event) => {
        onViewportLayout(event);
        onOuterLayout?.(event);
      }}
      onContentSizeChange={onContentSizeChange}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <GestureDetector gesture={chromeTapGesture}>
        <View style={[styles.readingColumn, styles.tapChromeTarget]}>{children}</View>
      </GestureDetector>
    </Animated.ScrollView>
  );
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
  const {
    needsScroll: viewAllNeedsScroll,
    onViewportLayout: onViewAllViewportLayout,
    onContentSizeChange: onViewAllContentSizeChange,
  } = useScrollOnlyWhenNeeded();

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

  // F3: re-spec pending — classic NucleoVisualSpec overview off.
  const openVisualStep = useCallback(
    (stepId: string) => {
      const stepIndex = data?.steps.findIndex((step) => step.id === stepId) ?? -1;
      if (stepIndex >= 0) session.goToStep(stepIndex + 1, true);
    },
    [data?.steps, session]
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

  const isStepMode = !session.isComplete && !session.viewAll;
  const swipeEnabled = isStepMode && !session.historyOpen && !session.isStreamGenerating;

  const navDir = useSharedValue(1);
  const canPrev = useSharedValue(false);
  const canNext = useSharedValue(false);

  useEffect(() => {
    canPrev.value = swipeEnabled && session.currentStep > 0;
    canNext.value = swipeEnabled && session.currentStep < session.totalSteps;
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
        .activeOffsetX([-28, 28])
        .failOffsetY([-14, 14])
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

  const verticalScrollGesture = useMemo(() => Gesture.Native(), []);
  const stepGesture = useMemo(
    () => Gesture.Simultaneous(swipeGesture, verticalScrollGesture),
    [swipeGesture, verticalScrollGesture]
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

  // Intro has no progress line, so its content must start right at the header edge:
  // otherwise the extra gap pushes the cut-off well below where the bar sits elsewhere.
  const stepHeaderVisibleTopPadding = mapContentTopPadding(
    hideProgressLine,
    hideProgressLine ? 0 : 24
  );
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
  const isVisualizeHtmlTest = data.generationMode === 'visualize-html-test';
  const visualizeArtifact = isVisualizeHtmlTest
    ? ensureVisualizeArtifact(data.visualizeArtifact, {
        coreIdea: data.coreIdea,
        tldr: data.tldr,
        visualization: data.visualization,
      })
    : null;
  /** Shadow opt-in: prefer v2 RN render when persisted run exists. */
  const visualizeRun = isVisualizeHtmlTest ? data.visualizeRun ?? null : null;

  const renderVisualOverview = (options?: { compact?: boolean; showTitle?: boolean }) => {
    // F3: re-spec pending — only Visualize compiler test path; never NucleoVisualOverview.
    if (isVisualizeHtmlTest && visualizeRun) {
      return <VisualizeRunHost run={visualizeRun} />;
    }
    if (isVisualizeHtmlTest && visualizeArtifact) {
      return (
        <NucleoVisualizeWebView
          artifact={visualizeArtifact}
          compact={options?.compact}
          onOpenStep={openVisualStep}
        />
      );
    }
    return null;
  };

  const renderTldrList = () => {
    const items = data.tldr ?? [];
    if (!items.length) return null;
    return (
      <View className="mt-6">
        <TldrBentoGrid items={items} />
      </View>
    );
  };

  const renderMapMeta = () => (
    <View
      onLayout={handleMapMetaAnchorLayout}
      collapsable={false}
      className="mb-20"
    >
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
        {isVisualizeHtmlTest ? (
          <View className="rounded-full bg-accent/12 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
              Visualize compiler
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const renderResumen = (
    interactive = false,
    options: { includeTldr?: boolean } = {}
  ) => {
    const includeTldr = options.includeTldr ?? true;

    return (
    <View className={interactive ? VIEW_ALL_SECTION_DIVIDER : undefined}>
      {interactive ? renderMapMeta() : null}
      <View className="flex-row items-center gap-2 mb-4">
        <AppIcon size={20} />
        <Text className="text-[15px] font-bold tracking-widest uppercase text-primary">
          Idea central
        </Text>
      </View>
      <Text className="text-2xl font-bold text-primary leading-9">{data.coreIdea}</Text>
      {data.coreSupport ? (
        <Text className="mt-4 text-lg leading-7 text-body text-secondary">{data.coreSupport}</Text>
      ) : null}

      {includeTldr && (visualizeRun || visualizeArtifact || (data.tldr?.length ?? 0) > 0) ? (
        <View className="mt-10">
          {!isVisualizeHtmlTest ? (
            <Text className="text-[15px] font-bold uppercase tracking-widest text-primary">
              En 60 segundos
            </Text>
          ) : null}
          {isVisualizeHtmlTest ? renderVisualOverview({ compact: true }) : renderTldrList()}
        </View>
      ) : null}
    </View>
    );
  };

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

    return (
      <View
        key={step.id || stepIndex}
        className={stepDividerClass}
        style={!interactive ? styles.stepPage : undefined}
      >
        <View className="flex-row flex-wrap items-center gap-2 mb-4">
          <Text className="text-sm font-bold uppercase tracking-widest text-accent dark:text-accent">
            {stepLabel}
          </Text>
          {step.time ? <Text className="text-sm text-secondary">{step.time}</Text> : null}
        </View>
        <Text
          className="text-2xl font-bold text-primary leading-9 mb-4"
        >
          {step.title}
        </Text>
        {step.purpose ? (
          <Text
            className="text-[17px] leading-[26px] text-body mb-4"
          >
            {step.purpose}
          </Text>
        ) : null}
        {/* F3: re-spec pending — step.visualization / NucleoVisualOverview disconnected.
            Idea clave: no fallback from purpose (was duplicating the paragraph above).
            Real callouts render via StepContentBlocks only. */}
        <View>
          <StepContentBlocks blocks={step.content} />
        </View>
        <ReferencesChips references={step.references} />
      </View>
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
    if (step === 0) return renderResumen(false, { includeTldr: true });
    return renderStep(step, false);
  };

  const renderAdaptiveStepPage = (step: number) => (
    <AdaptiveStepScroll
      scrollRef={step === session.currentStep ? scrollRef : undefined}
      historyOpen={session.historyOpen}
      onOuterLayout={step === session.currentStep ? handleScrollViewLayout : undefined}
      onScroll={step === session.currentStep ? scrollHandler : undefined}
      onPressChrome={toggleStepHeader}
      contentTopInset={hideProgressLine ? READING_PROGRESS_LINE_HEIGHT + 24 : 0}
    >
      {renderStepModeReading(step)}
    </AdaptiveStepScroll>
  );

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
      <View className="flex-1 relative overflow-hidden bg-base">
      <ReadingProgressBar
        viewAll={session.viewAll}
        stepProgress={session.stepProgress}
        progressLabel={session.progressLabel}
        scrollProgressShared={scrollProgress}
        headerVisibleShared={headerVisible}
        hideProgressLine={hideProgressLine}
        onToggleSidebar={() => session.toggleHistoryDrawer()}
      />

      <SessionErrorBanner className="px-5" />

      <IncompleteTransformBanner />

      <View className="flex-1 bg-base">
        {isStepMode ? (
          <GestureDetector gesture={stepGesture}>
            <Animated.View className="flex-1 px-5 bg-base" style={stepPageChromeStyle}>
              {showStepSlide ? (
                <StepSlideTransition step={session.currentStep} reduceMotion={reduceMotion}>
                  {renderAdaptiveStepPage}
                </StepSlideTransition>
              ) : (
                <Animated.View
                  key={contentModeKey}
                  style={styles.adaptiveHost}
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
                  {renderAdaptiveStepPage(session.currentStep)}
                </Animated.View>
              )}
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
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!session.historyOpen && viewAllNeedsScroll}
            bounces={viewAllNeedsScroll}
            alwaysBounceVertical={viewAllNeedsScroll}
            overScrollMode={viewAllNeedsScroll ? 'auto' : 'never'}
            onLayout={(event) => {
              onViewAllViewportLayout(event);
              handleScrollViewLayout(event);
            }}
            onContentSizeChange={onViewAllContentSizeChange}
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
      style={{ flex: 1, backgroundColor: BG_BASE }}
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
  adaptiveHost: {
    flex: 1,
  },
  adaptiveScroll: {
    flex: 1,
  },
  adaptiveScrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  tapChromeTarget: {
    flexGrow: 1,
  },
  stepPage: {
    paddingBottom: 16,
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
