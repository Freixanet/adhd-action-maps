import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useSharedValue,
} from 'react-native-reanimated';
import type { EditorialPlan } from '@shared/editorial';
import {
  EDITORIAL_SHEET_BG,
  EDITORIAL_TEXT,
  EDITORIAL_ACCENT_LAVENDER,
} from '@shared/editorial/colors';
import {
  EDITORIAL_MAX_READ_WIDTH,
  EDITORIAL_SPACE,
  editorialGutter,
} from '@shared/editorial/space';
import NativeGlassButton from '../components/NativeGlassButton';
import { stepHaptic } from '../context/AppSessionContext';
import { EDITORIAL_SCROLL_BOTTOM_MASK } from './editorialChrome';
import EditorialPageView from './EditorialPageView';
import { RADII } from '@shared/uiTokens';
import { color, type, space, radius, typography } from '@shared/design-tokens';

type Props = {
  plan: EditorialPlan;
  /** Stable header close — same in demo and real editorial results. */
  onClose: () => void;
};

const NAV_SIZE = 44;
const HEADER_ROW = 44;
/** Match approved mockup: Cerrar → title. */
const HEADER_TO_TITLE = 24;
/**
 * Retained for Metro HMR: a stale StyleSheet evaluation can still read this
 * name after the disabled-next treatment was removed.
 */
const NAV_DISABLED_OPACITY = 0.4;

/**
 * Page-like host: reserved header, swipe pages, fixed bottom nav.
 * Cover: Next only. Middle: Back + Next. Last: Back only.
 * Next appears only after the current page scroll reaches its end.
 */
export default function EditorialPlanHost({ plan, onClose }: Props) {
  const pages = useMemo(() => (plan.pages ?? []).slice(0, 3), [plan.pages]);
  const [index, setIndex] = useState(0);
  const page = pages[index] ?? pages[0];
  const total = pages.length;
  const { width } = useWindowDimensions();
  const gutter = editorialGutter(width);
  const dragX = useSharedValue(0);
  const topic = (plan.providerVersions?.planner ?? '').includes('attention')
    ? ('attention' as const)
    : ('procrastination' as const);
  const [contentComplete, setContentComplete] = useState(page?.archetype === 'cover');

  useEffect(() => {
    setContentComplete(page?.archetype === 'cover');
  }, [page?.archetype, page?.id]);

  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total - 1, next)));
    },
    [total]
  );

  const canGoForward =
    index < total - 1 && (page?.archetype === 'cover' || contentComplete);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    stepHaptic();
    go(index + 1);
  }, [canGoForward, go, index]);

  const goBack = useCallback(() => {
    if (index <= 0) return;
    stepHaptic();
    go(index - 1);
  }, [go, index]);

  const handleClose = useCallback(() => {
    stepHaptic();
    onClose();
  }, [onClose]);

  const handleContentCompleteChange = useCallback((complete: boolean) => {
    setContentComplete(complete);
  }, []);

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          dragX.value = e.translationX;
        })
        .onEnd((e) => {
          const threshold = Math.min(72, width * 0.18);
          if (e.translationX < -threshold) {
            runOnJS(goForward)();
          } else if (e.translationX > threshold && index > 0) {
            runOnJS(goBack)();
          }
          dragX.value = 0;
        }),
    [dragX, goBack, goForward, index, width]
  );

  if (!page) return null;

  const atStart = index <= 0;
  const atEnd = index >= total - 1;
  const scrollablePage = page.archetype !== 'cover';

  return (
    <View style={styles.sheet} accessibilityLabel="Recorrido editorial">
      <View style={[styles.column, { paddingHorizontal: gutter }]}>
        <View style={styles.headerRow}>
          <NativeGlassButton
            onPress={handleClose}
            accessibilityLabel="Cerrar"
            title="Cerrar"
            cornerRadius={HEADER_ROW / 2}
            style={styles.closeBtn}
          >
            <Text style={styles.closeText}>Cerrar</Text>
          </NativeGlassButton>
          <View style={styles.headerSpacer} />
        </View>

        <GestureDetector gesture={swipe}>
          <Animated.View
            key={page.id}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={styles.pageSlot}
          >
            <EditorialPageView
              page={page}
              nucleusClaim={plan.nucleusClaim}
              topic={topic}
              onContentCompleteChange={handleContentCompleteChange}
            />
            {scrollablePage ? (
              <View pointerEvents="none" style={styles.bottomMask} accessibilityElementsHidden />
            ) : null}
          </Animated.View>
        </GestureDetector>

        <View style={styles.chrome}>
          <View style={styles.navSlot}>
            {!atStart ? (
              <NativeGlassButton
                onPress={goBack}
                accessibilityLabel="Página anterior"
                systemImage="chevron.left"
                symbolPointSize={17}
                cornerRadius={NAV_SIZE / 2}
                style={styles.navBtn}
              >
                <Text style={styles.navGlyph}>‹</Text>
              </NativeGlassButton>
            ) : null}
          </View>

          <View
            style={styles.dots}
            accessibilityRole="adjustable"
            accessibilityLabel={`Página ${index + 1} de ${total}`}
          >
            {pages.map((p, i) => (
              <View key={p.id} style={[styles.dot, i === index ? styles.dotActive : null]} />
            ))}
          </View>

          <View style={styles.navSlot}>
            {canGoForward ? (
              <NativeGlassButton
                onPress={goForward}
                accessibilityLabel="Página siguiente"
                systemImage="chevron.right"
                symbolPointSize={17}
                cornerRadius={NAV_SIZE / 2}
                style={styles.navBtn}
              >
                <Text style={styles.navGlyph}>›</Text>
              </NativeGlassButton>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: EDITORIAL_SHEET_BG,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: EDITORIAL_MAX_READ_WIDTH,
    alignSelf: 'center',
    paddingBottom: 10,
  },
  headerRow: {
    height: HEADER_ROW,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: HEADER_TO_TITLE,
  },
  closeBtn: {
    height: HEADER_ROW,
    paddingHorizontal: 14,
    minWidth: 88,
  },
  closeText: {
    color: EDITORIAL_TEXT,
    ...typography('bodySemibold'),
  },
  headerSpacer: {
    flex: 1,
  },
  pageSlot: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 0,
    overflow: 'hidden',
  },
  bottomMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: EDITORIAL_SCROLL_BOTTOM_MASK,
    backgroundColor: EDITORIAL_SHEET_BG,
  },
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: EDITORIAL_SPACE.contentToNav,
    height: NAV_SIZE,
  },
  navSlot: {
    width: NAV_SIZE,
    height: NAV_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtn: {
    width: NAV_SIZE,
    height: NAV_SIZE,
  },
  /** Not applied — keeps NAV_DISABLED_OPACITY live for Metro HMR. */
  navSlotDisabled: {
    opacity: NAV_DISABLED_OPACITY,
  },
  navGlyph: {
    color: EDITORIAL_TEXT,
    ...typography('pageTitleMedium'),
    marginTop: -2,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.tick,
    backgroundColor: color.background.editorialDot,
  },
  dotActive: {
    width: 15,
    borderRadius: RADII.pill,
    backgroundColor: EDITORIAL_ACCENT_LAVENDER,
  },
});
