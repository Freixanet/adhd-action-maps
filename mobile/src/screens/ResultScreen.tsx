import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import CompletionGlassButton from '../components/CompletionGlassButton';
import CompletionOverflowMenu from '../components/CompletionOverflowMenu';
import ResultNoticesZone from '../components/ResultNoticesZone';
import MapChatSheet from '../components/MapChatSheet';
import ReadingProgressBar, {
  READING_PROGRESS_BAR_HEIGHT,
  READING_PROGRESS_LINE_HEIGHT,
} from '../components/ReadingProgressBar';
import { useMapHeaderAutoHide } from '../hooks/useMapHeaderAutoHide';
import StepContentBlocks from '../components/StepContentBlocks';
import BlockReferences from '../components/BlockReferences';
import SourceViewerSheet from '../components/SourceViewerSheet';
import { SourceViewerProvider } from '../context/SourceViewerContext';
import StepFooterNav from '../components/StepFooterNav';
import StepSlideTransition from '../components/StepSlideTransition';
import SourceCoverageCard from '../components/SourceCoverageCard';
import EvidenceClaimChips from '../components/EvidenceClaimChips';
import ApplicationPlanView from '../components/ApplicationPlanView';
import ApplicationContextEditor from '../components/ApplicationContextEditor';
import TakeawaysGlassCard from '../components/TakeawaysGlassCard';
import KnowledgeSectionsList from '../components/KnowledgeSectionsList';
import TldrBentoGrid from '../components/TldrBentoGrid';
import NucleoCover from '../components/NucleoCover';
import NucleoOpenCover from '../components/NucleoOpenCover';
import { SIDEBAR_EDGE_INSET } from '../components/sidebarLayout';
// F3: re-spec pending — NucleoVisualOverview disconnected from ResultScreen.
// import NucleoVisualOverview from '../components/NucleoVisualOverview';
import NucleoVisualizeWebView from '../components/NucleoVisualizeWebView';
import VisualizeRunHost from '../visualize/VisualizeRunHost';
import { ensureVisualizeArtifact } from '@shared/visualizeCompiler';
import { stepHaptic, useAppSession } from '../context/AppSessionContext';
import { resolvePdfDocumentUrl } from '../logic/resolvePdfDocumentUrl';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useViewAllScrollSpy } from '../hooks/useViewAllScrollSpy';
import { formatReadingProgressLabel } from '@shared/nucleoPipeline';
// F3: re-spec pending — NucleoVisualSpec normalize unused while channel is off.
// import { normalizeNucleoVisual } from '@shared/nucleoVisual';
import type { SourceReference } from '../logic/contracts';
import { debugTransitionLog } from '../logic/debugTransitionLog';
import { ACCENT, EDITORIAL_SHEET_BG } from '@shared/uiTokens';
import { useThemeColors } from '../context/ThemeContext';
import EditorialPlanHost from '../editorial/EditorialPlanHost';
import { reading } from '@shared/design-tokens';
import type { HistoryEntry } from '@shared/history';

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
        <View
          style={[
            styles.readingColumn,
            styles.stepReadingColumn,
            styles.tapChromeTarget,
          ]}
        >
          {children}
        </View>
      </GestureDetector>
    </Animated.ScrollView>
  );
}

function ReferencesChips({ references }: { references?: SourceReference[] }) {
  return <BlockReferences references={references} />;
}

/** Extra clearance under the status bar / Dynamic Island on Idea central. */
const MAP_COVER_ISLAND_EXTRA = 4;

function ResultMapCover({ entry }: { entry: HistoryEntry }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const contentInsetTop = insets.top + MAP_COVER_ISLAND_EXTRA;
  // 16:9 art plane, extended downward by the top safe-area so the illustration
  // clears the Dynamic Island while the wash still bleeds edge-to-edge.
  const artHeight = Math.round(windowWidth * (9 / 16));
  const totalHeight = artHeight + contentInsetTop;

  return (
    <View style={[styles.mapCover, { width: windowWidth, height: totalHeight }]}>
      <NucleoCover
        entry={entry}
        width={windowWidth}
        height={totalHeight}
        contentInsetTop={contentInsetTop}
      />
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
  const colors = useThemeColors();
  const { data } = session;
  const activeHistoryEntry = useMemo(
    () =>
      session.historyStore.entries.find(
        (entry) => entry.id === session.historyStore.activeId
      ) ?? null,
    [session.historyStore.activeId, session.historyStore.entries]
  );
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

  const isIntroStep =
    !session.viewAll && !session.isComplete && session.currentStep === 0;
  const hideProgressLine = isIntroStep || session.isComplete;

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

  const {
    scrollRef,
    headerVisible,
    handleMapMetaAnchorLayout,
    scrollHandler,
    preserveBottomAfterFooterReveal,
  } = useMapHeaderAutoHide({
    hideProgressLine,
    mapKey: session.historyStore.activeId ?? 'none',
    resetKey: mapHeaderResetKey,
    scrollProgress,
    onScrollReport: reportScrollSpy,
  });

  const resumeTargetRef = React.useRef<{
    mapId: string;
    step: number;
  } | null>(null);
  const resumeTargetKeyRef = React.useRef('');
  const activeMapId = session.historyStore.activeId ?? 'none';
  const resumeTargetKey = `${activeMapId}:${session.viewAll}:${session.resumeBannerVisible}`;
  if (resumeTargetKeyRef.current !== resumeTargetKey) {
    resumeTargetKeyRef.current = resumeTargetKey;
    resumeTargetRef.current =
      session.viewAll && session.resumeBannerVisible
        ? { mapId: activeMapId, step: session.currentStep }
        : null;
  }

  const registerResumeSectionLayout = useCallback(
    (step: number, event: LayoutChangeEvent) => {
      registerSectionLayout(step, event);
      const target = resumeTargetRef.current;
      if (!target || target.mapId !== activeMapId || target.step !== step) return;
      const y = Math.max(0, event.nativeEvent.layout.y);
      resumeTargetRef.current = null;
      InteractionManager.runAfterInteractions(() => {
        scrollRef.current?.scrollTo({ y, animated: false });
      });
    },
    [activeMapId, registerSectionLayout, scrollRef]
  );

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
        .activeOffsetY([-28, 28])
        .failOffsetX([-14, 14])
        .onTouchesDown((event, stateManager) => {
          'worklet';
          const touch = event.allTouches[0];
          if (touch && touch.absoluteX < 30) {
            stateManager.fail();
          }
        })
        .onEnd((event) => {
          'worklet';
          const { translationY, velocityY } = event;
          // Swipe up → next page; swipe down → previous.
          if ((translationY < -40 || velocityY < -500) && canNext.value) {
            runOnJS(commitStep)(1);
          } else if ((translationY > 40 || velocityY > 500) && canPrev.value) {
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

  const toggleStepFooterChrome = useCallback(() => {
    if (!isStepMode) return;
    headerVisible.value = !headerVisible.value;
    stepHaptic();
  }, [headerVisible, isStepMode]);

  const handleStepFooterRevealLayout = useCallback(
    (height: number) => {
      preserveBottomAfterFooterReveal(height);
    },
    [preserveBottomAfterFooterReveal]
  );

  // No fixed header band. Chrome floats over the page; only scroll content
  // insets keep copy readable under the button (and scroll away with the page).
  const stepScrollTopInset = isIntroStep
    ? 0
    : safeInsets.top + READING_PROGRESS_BAR_HEIGHT + 10;

  const floatingChromeContentPad =
    safeInsets.top + READING_PROGRESS_BAR_HEIGHT + 12;

  if (!data) return null;

  const DEV = false;
  const isStudyDocBeta = data.generationMode === 'study-doc-beta';
  const isVisualizeHtmlTest = data.generationMode === 'visualize-html-test';
  const isEditorialV1 = data.generationMode === 'editorial-v1' && Boolean(data.editorialPlan);
  // Editorial owns the whole reading surface — never application / classic steps.
  const showApplicationPlan =
    !isEditorialV1 && Boolean(data.application && data.intent === 'apply');
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
        <Text className="text-xs font-bold uppercase text-secondary text-body shrink">
          {data.title}
        </Text>
        {DEV && isStudyDocBeta ? (
          <View className="rounded-full bg-accent/12 px-2 py-0.5">
            <Text className="text-micro font-bold uppercase text-accent">
              StudyDoc beta
            </Text>
          </View>
        ) : null}
        {isVisualizeHtmlTest ? (
          <View className="rounded-full bg-accent/12 px-2 py-0.5">
            <Text className="text-micro font-bold uppercase text-accent">
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
    const ideaCentral = (
      <>
        {activeHistoryEntry ? <ResultMapCover entry={activeHistoryEntry} /> : null}
        <View className="mb-4">
          <Text className="text-body font-extrabold uppercase tracking-widest text-primary">
            Idea central
          </Text>
        </View>
        <Text className="text-lg leading-8 text-primary">{data.coreIdea}</Text>
      </>
    );

    return (
    <View className={interactive ? VIEW_ALL_SECTION_DIVIDER : undefined}>
      {ideaCentral}
      {interactive ? renderMapMeta() : null}

      {includeTldr && (visualizeRun || visualizeArtifact || (data.tldr?.length ?? 0) > 0) ? (
        <View className="mt-10">
          {!isVisualizeHtmlTest ? (
            <Text className="text-body font-extrabold uppercase tracking-widest text-primary">
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
            className="text-input text-body mb-4"
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
          {DEV ? (
            <View style={styles.completionActionSlot}>
              <CompletionGlassButton label="Preguntar" onPress={openAsk} />
            </View>
          ) : null}
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
      <EvidenceClaimChips claims={data.evidence?.claims} links={data.evidence?.links} />
      <KnowledgeSectionsList sections={data.knowledgeSections} />
    </>
  );

  const renderCompletion = () => (
    <View className="py-6">
      <View className="flex-row items-center gap-2 mb-4">
        <Animated.View style={completionCheckStyle}>
          <CheckCircle2 size={16} color={ACCENT} />
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
          <CheckCircle2 size={16} color={ACCENT} />
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
        <CheckCircle2 size={16} color={ACCENT} />
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
          systemImage="checkmark.circle.fill"
          variant="accent"
        />
      </View>
    </View>
  );

  const renderStepModeReading = (step: number) => {
    if (step === 0) return renderResumen(false, { includeTldr: true });
    return renderStep(step, false);
  };

  const renderAdaptiveStepPage = (step: number) => {
    if (step === 0) {
      return (
        <NucleoOpenCover
          entry={activeHistoryEntry}
          title={data.title}
          subtitle={data.coreIdea}
          onExplore={() => session.goToStep(1)}
        />
      );
    }
    return (
      <AdaptiveStepScroll
        scrollRef={step === session.currentStep ? scrollRef : undefined}
        historyOpen={session.historyOpen}
        onOuterLayout={step === session.currentStep ? handleScrollViewLayout : undefined}
        onScroll={step === session.currentStep ? scrollHandler : undefined}
        onPressChrome={toggleStepFooterChrome}
        contentTopInset={stepScrollTopInset}
      >
        {renderStepModeReading(step)}
      </AdaptiveStepScroll>
    );
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
          <View onLayout={(event) => registerResumeSectionLayout(0, event)}>
            {renderResumen(true)}
          </View>
          {data.steps.map((_, idx) => {
            const stepIndex = idx + 1;
            const isLastStep = stepIndex === session.totalSteps;
            return (
              <View
                key={data.steps[idx]?.id ?? stepIndex}
                onLayout={(event) => registerResumeSectionLayout(stepIndex, event)}
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

  const resultShell = isEditorialV1 && data.editorialPlan ? (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: EDITORIAL_SHEET_BG }}
      edges={['bottom']}
    >
      <EditorialPlanHost plan={data.editorialPlan} onClose={session.closeEditorialDemo} />
    </SafeAreaView>
  ) : (
    <GestureDetector gesture={backHomeGesture}>
      <View className="flex-1 relative overflow-hidden bg-base">
      <ReadingProgressBar
        viewAll={session.viewAll}
        stepProgress={session.stepProgress}
        scrollProgressShared={scrollProgress}
        hideProgressLine={hideProgressLine}
        topInset={safeInsets.top}
        onToggleSidebar={() => session.toggleHistoryDrawer()}
      />

      <ResultNoticesZone
        hideProgressLine={hideProgressLine}
        reserveHeaderSpace={false}
      />

      <View className="flex-1 bg-base">
        {showApplicationPlan && data.application ? (
          <Animated.ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingTop: floatingChromeContentPad,
              paddingBottom: 48,
              paddingHorizontal: SIDEBAR_EDGE_INSET,
            }}
            showsVerticalScrollIndicator={false}
          >
            <ApplicationPlanView
              application={data.application}
              onStartAction={() => {
                void session.startActiveApplicationAction();
              }}
              onEditContext={() => {
                session.openApplicationContextEditor();
              }}
              onSubmitReview={({
                outcome,
                privateNote,
                failedAssumptionId,
                wantsAdjust,
                wantsRepeat,
              }) => {
                void session.submitActiveApplicationReview({
                  outcome,
                  privateNote,
                  failedAssumptionId,
                  wantsAdjust,
                  wantsRepeat,
                });
              }}
            />
            <ApplicationContextEditor
              visible={session.applicationContextEditorOpen}
              initial={
                data.application.context ?? session.applicationContext
              }
              assumptions={data.application.plan.assumptions}
              onClose={session.closeApplicationContextEditor}
              onSave={(ctx, assumptionEdits) => {
                void session.replanActiveApplication(ctx, assumptionEdits);
              }}
              title="Editar contexto"
            />
          </Animated.ScrollView>
        ) : isStepMode ? (
          <GestureDetector gesture={stepGesture}>
            <Animated.View className="flex-1 bg-base">
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
            contentContainerStyle={{
              // Intro cover in view-all bleeds under the floating button; other
              // modes keep a scrollable inset so copy stays readable.
              paddingTop: session.viewAll && !session.isComplete ? 0 : floatingChromeContentPad,
              paddingBottom: 128,
              paddingHorizontal: SIDEBAR_EDGE_INSET,
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

        <StepFooterNav
          chromeVisibleShared={headerVisible}
          onRevealLayout={handleStepFooterRevealLayout}
        />
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

  const resolveDocumentUrl = useCallback(async () => {
    const activeId = session.historyStore.activeId;
    if (!activeId) return { status: 'not_applicable' as const };
    const entry = session.historyStore.entries.find((e) => e.id === activeId);
    return resolvePdfDocumentUrl({ sourceMeta: entry?.sourceMeta });
  }, [session.historyStore.activeId, session.historyStore.entries]);

  return previewMode ? (
    <SourceViewerProvider
      citedChunks={data?.citedChunks}
      sourceTitle={data?.sourceMetadata?.title || data?.sourceMetadata?.label || data?.title}
      resolveDocumentUrl={resolveDocumentUrl}
    >
      <View
        className="flex-1 bg-base"
        style={{ paddingTop: PREVIEW_TOP_INSET }}
        onLayout={handleRootLayout}
        pointerEvents="none"
      >
        {resultShell}
      </View>
      <SourceViewerSheet />
    </SourceViewerProvider>
  ) : (
    <SourceViewerProvider
      citedChunks={data?.citedChunks}
      sourceTitle={data?.sourceMetadata?.title || data?.sourceMetadata?.label || data?.title}
      resolveDocumentUrl={resolveDocumentUrl}
    >
      <SafeAreaView
        className="flex-1 bg-base"
        style={{ flex: 1, backgroundColor: colors.background.canvas }}
        edges={['left', 'right']}
        onLayout={handleRootLayout}
        pointerEvents="auto"
      >
        {resultShell}
      </SafeAreaView>
      <SourceViewerSheet />
    </SourceViewerProvider>
  );
}

const styles = StyleSheet.create({
  readingColumn: {
    width: '100%',
    maxWidth: reading.maxWidth,
    alignSelf: 'center',
  },
  mapCover: {
    alignSelf: 'center',
    marginBottom: 40,
    overflow: 'hidden',
  },
  stepReadingColumn: {
    paddingHorizontal: SIDEBAR_EDGE_INSET,
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
