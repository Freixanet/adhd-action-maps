import React, { useCallback, useEffect, useMemo } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  CheckCircle2,
  Clock,
  Download,
  MessageSquareText,
  SquarePen,
} from 'lucide-react-native';
import AppIcon from '../components/AppIcon';
import CompletionGlassButton from '../components/CompletionGlassButton';
import IncompleteTransformBanner from '../components/IncompleteTransformBanner';
import SessionErrorBanner from '../components/SessionErrorBanner';
import MapChatSheet from '../components/MapChatSheet';
import ReadingProgressBar, { mapContentTopPadding } from '../components/ReadingProgressBar';
import { useMapHeaderAutoHide } from '../hooks/useMapHeaderAutoHide';
import SourceMetadataGlassCard from '../components/SourceMetadataGlassCard';
import StepContentBlocks from '../components/StepContentBlocks';
import StepFooterNav from '../components/StepFooterNav';
import SourceCoverageCard from '../components/SourceCoverageCard';
import TakeawaysGlassCard from '../components/TakeawaysGlassCard';
import KnowledgeSectionsList from '../components/KnowledgeSectionsList';
import { stepHaptic, useAppSession } from '../context/AppSessionContext';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { useViewAllScrollSpy } from '../hooks/useViewAllScrollSpy';
import { getIntentLabel, getSourceTypeLabel } from '@shared/categories';
import type { SourceReference } from '../logic/contracts';

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
          className="flex-row items-center gap-1.5 rounded-full border border-neutral-300 dark:border-white/12 px-2.5 py-1"
        >
          <Text className="text-[11px] font-medium text-secondary">
            {reference.label}
          </Text>
          <Text className="text-[11px] font-medium text-body">
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

export default function ResultScreen() {
  const session = useAppSession();
  const { data } = session;

  const scrollProgress = useSharedValue(0);

  const hideProgressLine =
    !session.viewAll && !session.isComplete && session.currentStep === 0;

  const mapHeaderResetKey = session.viewAll
    ? `${session.viewAll}:${session.isComplete}`
    : `${session.viewAll}:${session.currentStep}:${session.isComplete}`;

  const syncReadingStep = useCallback(
    (step: number) => session.syncReadingStep(step),
    [session]
  );
  const { registerSectionLayout, handleScrollViewLayout, handleScroll, resetSpy } = useViewAllScrollSpy({
    enabled: session.viewAll && !session.isComplete,
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

  const { reduceMotion } = useGlassAccessibility();

  const remainingMinutes = useMemo(() => {
    if (session.viewAll || session.isComplete || session.currentStep < 1) return null;
    return parseTotalMinutes(data?.steps?.slice(session.currentStep));
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
    canNext.value = swipeEnabled && session.currentStep < session.totalSteps;
  }, [canNext, canPrev, session.currentStep, session.totalSteps, swipeEnabled]);

  const commitStep = useCallback(
    (dir: 1 | -1) => {
      navDir.value = dir;
      session.goToStep(session.currentStep + dir);
    },
    [navDir, session]
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

  type EnterType = React.ComponentProps<typeof Animated.View>['entering'];
  type ExitType = React.ComponentProps<typeof Animated.View>['exiting'];

  const stepEntering = useMemo<EnterType>(() => {
    if (reduceMotion) return FadeIn.duration(150);
    return () => {
      'worklet';
      return {
        initialValues: { opacity: 0, transform: [{ translateX: navDir.value * 24 }] },
        animations: {
          opacity: withTiming(1, { duration: 250 }),
          transform: [{ translateX: withTiming(0, { duration: 250 }) }],
        },
      };
    };
  }, [navDir, reduceMotion]);

  const stepExiting = useMemo<ExitType>(() => {
    if (reduceMotion) return FadeOut.duration(150);
    return () => {
      'worklet';
      return {
        initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
        animations: {
          opacity: withTiming(0, { duration: 180 }),
          transform: [{ translateX: withTiming(navDir.value * -24, { duration: 250 }) }],
        },
      };
    };
  }, [navDir, reduceMotion]);

  const stepKey = useMemo(() => {
    const parts = [
      session.viewAll ? 'view-all' : 'step-mode',
      session.isComplete ? 'complete' : 'active',
      session.essentialsReview ? 'essentials' : 'content',
      session.isStreamGenerating ? 'stream' : 'idle',
    ];
    // Step-by-step only: remount for fade between steps. View-all keeps one tree so
    // scroll-spy index updates do not remount liquid-glass surfaces.
    if (!session.viewAll && !session.isComplete) {
      parts.push(String(session.currentStep));
    }
    return parts.join(':');
  }, [
    session.currentStep,
    session.essentialsReview,
    session.isComplete,
    session.isStreamGenerating,
    session.viewAll,
  ]);

  if (!data) return null;

  const isIntroStep = !session.isComplete && !session.viewAll && session.currentStep === 0;

  const renderResumen = (interactive = false) => (
    <Pressable
      disabled={!interactive}
      onPress={interactive ? () => session.goToStep(0, true) : undefined}
      className={interactive ? VIEW_ALL_SECTION_DIVIDER : 'mb-8'}
    >
      <View className="flex-row items-center flex-wrap gap-x-3 gap-y-2 mb-4">
        <View className="flex-row items-center gap-2">
          <AppIcon size={20} />
          <Text className="text-sm font-bold tracking-widest uppercase text-primary">
            Núcleo
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
        <SourceMetadataGlassCard sourceMetadata={data.sourceMetadata} coverage={data.coverage} />
      ) : null}

      {data.references?.length ? (
        <View className="mt-6">
          <Text className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            Referencias visibles
          </Text>
          <ReferencesChips references={data.references} />
        </View>
      ) : null}

      {data.tldr?.length ? (
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

  const renderStep = (stepIndex: number, interactive = false, isLastStep = false) => {
    const step = data.steps[stepIndex - 1];
    if (!step) return null;

    const stepDividerClass = interactive
      ? isLastStep
        ? VIEW_ALL_SECTION_BEFORE_COMPLETION
        : VIEW_ALL_SECTION_DIVIDER
      : '';

    return (
      <Pressable
        key={step.id || stepIndex}
        disabled={!interactive}
        onPress={interactive ? () => session.goToStep(stepIndex, true) : undefined}
        className={stepDividerClass}
      >
        <View className="flex-row flex-wrap items-center gap-2 mb-4">
          <Text className="text-sm font-bold uppercase tracking-widest text-accent dark:text-accent">
            Paso {stepIndex} de {session.totalSteps}
          </Text>
          {step.time ? <Text className="text-sm text-secondary">{step.time}</Text> : null}
        </View>
        <Text className="text-2xl font-bold text-primary leading-9 mb-4">{step.title}</Text>
        {step.purpose ? (
          <Text className="text-[17px] leading-[26px] text-body mb-4">{step.purpose}</Text>
        ) : null}
        <StepContentBlocks blocks={step.content} />
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
          <View style={styles.completionActionFullWidthSlot}>
            <CompletionGlassButton
              label="Volver al inicio"
              onPress={() => {
                session.setEssentialsReview(false);
                session.goToStep(0);
              }}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderCompletion = () => (
    <View className="py-6">
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
      <SourceCoverageCard
        coverage={data.coverage}
        limitations={data.sourceMetadata?.limitations}
        knowledgeSectionsCount={data.knowledgeSections?.length}
      />
      <KnowledgeSectionsList sections={data.knowledgeSections} />

      <View className="mt-10 flex-row flex-wrap gap-3" style={styles.completionActions}>
        {[
          {
            label: 'Repasar lo esencial',
            onPress: () => session.setEssentialsReview(true),
            fullWidth: true,
          },
          {
            label: 'Preguntar sobre la fuente',
            icon: MessageSquareText,
            onPress: () => {
              session.setChatOpen(true);
              stepHaptic();
            },
          },
          {
            label: 'Guardar ficha PDF',
            icon: Download,
            onPress: () => void session.handleDownloadPdf(),
            disabled: session.isPdfGenerating,
            loading: session.isPdfGenerating,
            loadingLabel: 'Preparando PDF…',
          },
          {
            label: 'Volver al inicio',
            onPress: () => {
              session.setEssentialsReview(false);
              session.goToStep(0);
            },
            fullWidth: true,
          },
          {
            label: 'Nuevo Núcleo',
            icon: SquarePen,
            variant: 'accent' as const,
            onPress: session.handleNewMap,
            fullWidth: true,
          },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <View
              key={action.label}
              style={action.fullWidth ? styles.completionActionFullWidthSlot : styles.completionActionSlot}
            >
              <CompletionGlassButton
                label={action.label}
                onPress={action.onPress}
                icon={Icon ? <Icon size={16} color={action.variant === 'accent' ? '#fff' : '#525252'} /> : undefined}
                variant={action.variant ?? 'neutral'}
                disabled={action.disabled}
                loading={action.loading}
                loadingLabel={action.loadingLabel}
              />
            </View>
          );
        })}
      </View>
    </View>
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

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top', 'left', 'right']}>
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
        <GestureDetector gesture={swipeGesture}>
          <Animated.ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerClassName="px-5 pb-32"
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: mapContentTopPadding(hideProgressLine),
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={!isIntroStep}
            scrollEnabled={!session.historyOpen}
            onLayout={handleScrollViewLayout}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            <View className="mb-12">
              <View onLayout={handleMapMetaAnchorLayout} collapsable={false}>
                <Text className="text-xs font-bold uppercase tracking-[0.16em] text-secondary text-body">
                  {data.title}
                </Text>
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
              <Animated.View style={styles.readingColumn}>
              <Animated.View
                key={stepKey}
                entering={
                  session.isStreamGenerating || session.viewAll
                    ? undefined
                    : isStepMode
                      ? stepEntering
                      : FadeIn.duration(220)
                }
                exiting={
                  session.viewAll
                    ? undefined
                    : isStepMode
                      ? stepExiting
                      : FadeOut.duration(180)
                }
              >
                {session.isComplete ? (
                  session.essentialsReview ? renderEssentialsReview() : renderCompletion()
                ) : session.viewAll ? (
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
                ) : session.currentStep === 0 ? (
                  renderResumen(false)
                ) : (
                  renderStep(session.currentStep, false)
                )}
              </Animated.View>
            </Animated.View>
            </View>
          </Animated.ScrollView>
        </GestureDetector>

        <StepFooterNav />
      </View>

      {session.historyStore.activeId ? (
        <MapChatSheet
          visible={session.chatOpen}
          onClose={() => session.setChatOpen(false)}
          mapId={session.historyStore.activeId}
          mapData={data}
        />
      ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  readingColumn: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  completionActions: {
    width: '100%',
  },
  completionActionSlot: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: '45%',
  },
  completionActionFullWidthSlot: {
    width: '100%',
  },
});
