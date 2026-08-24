import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeSheetGestureLockContext } from '../context/HomeSheetGestureLock';
import HistorySheet from './HistorySheet';
import {
  SidebarBrandHeader,
  SidebarOcclusionFade,
  sidebarHeaderSolidHeight,
  sidebarSearchStackHeight,
} from './SidebarGlassHeader';
import { useTheme } from '../context/ThemeContext';
import { DRAWER_WIDTH, MAIN_SHEET_CORNER_RADIUS, SCREEN_WIDTH } from './sidebarLayout';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { rubberbandOffset } from '../logic/motionWorklets';
import type { Coleccion } from '@shared/collections';
import type { ActionMapData } from '../logic/contracts';
import type { HistoryEntry } from '../logic/history';
import type { AppPhase } from '../context/AppSessionContext';
import { motion, radius, color, primitive, type, shadow } from '@shared/design-tokens';

export { DRAWER_WIDTH, MAIN_SHEET_CORNER_RADIUS } from './sidebarLayout';

const DRAWER_SPRING = {
  duration: motion.fade.duration,
  dampingRatio: 0.8,
  reduceMotion: ReduceMotion.System,
} as const;
const EDGE_SWIPE_TOP_INSET = 140;

/** Single curve for clip + pill + sheet — no derived dual-easing hitch. */
const SEARCH_TIMING = {
  duration: motion.drawer.duration,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
} as const;
type HistoryDrawerProps = {
  open: boolean;
  entries: HistoryEntry[];
  collections: Coleccion[];
  activeId: string | null;
  phase: AppPhase;
  data: ActionMapData | null;
  currentStep: number;
  isComplete: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onUpdateCategory: (id: string, category: string) => void;
  onTogglePin: (id: string) => void;
  onExportPdf?: (id: string) => void;
  onOpen: () => void;
  onGoToStep: (idx: number) => void;
  onNewMap: () => void;
  enableEdgeSwipe?: boolean;
  children: React.ReactNode;
};

export default function HistoryDrawer({
  open,
  entries,
  collections,
  activeId,
  phase,
  data,
  currentStep,
  isComplete,
  onClose,
  onSelect,
  onDelete,
  onRename,
  onUpdateCategory,
  onTogglePin,
  onExportPdf,
  onOpen,
  onGoToStep,
  onNewMap,
  enableEdgeSwipe = true,
  children,
}: HistoryDrawerProps) {
  const { isDark, colors } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const insets = useSafeAreaInsets();
  const [searchActive, setSearchActive] = useState(false);
  /** After React commits filters/index layout, flip this to start the morph. */
  const [searchMorphPending, setSearchMorphPending] = useState(false);
  const [searchFieldFocusToken, setSearchFieldFocusToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<ReactNode>(null);
  const [openHistoryMenuEntryId, setOpenHistoryMenuEntryId] = useState<string | null>(null);
  const [sheetGesturesLocked, setSheetGesturesLocked] = useState(false);
  const sheetGestureLock = useMemo(
    () => ({ locked: sheetGesturesLocked, setLocked: setSheetGesturesLocked }),
    [sheetGesturesLocked]
  );
  const offsetX = useSharedValue(open ? DRAWER_WIDTH : 0);
  const sidebarClipWidth = useSharedValue(DRAWER_WIDTH);
  const searchProgress = useSharedValue(0);
  const openShared = useSharedValue(open);
  const searchActiveShared = useSharedValue(false);
  const dragStartX = useSharedValue(0);
  const reduceMotionShared = useSharedValue(reduceMotion);

  useEffect(() => {
    reduceMotionShared.value = reduceMotion;
  }, [reduceMotion, reduceMotionShared]);

  const drawerMaxWidth = useDerivedValue(() =>
    searchActiveShared.value ? SCREEN_WIDTH : DRAWER_WIDTH
  );

  const headerSolidHeight = sidebarHeaderSolidHeight(insets.top);
  const searchStackHeight = sidebarSearchStackHeight(insets.top);
  const brandHeaderHeight = searchActive ? searchStackHeight : headerSolidHeight;
  const sidebarCanvasColor = isDark ? colors.background.canvas : colors.background.surface;
  const mainCanvasColor = colors.background.canvas;
  // Precompute for worklets — Hermes throws ReferenceError if `isDark` /
  // token objects are read as free identifiers inside useAnimatedStyle.
  const drawerShadowPeak = isDark ? 0.55 : 0.22;
  const drawerLightenPeak = isDark ? 0.1 : 0.22;
  const drawerShadow = shadow.glassDrawer;
  const drawerShadowFlatElevation = shadow.none.elevation;

  const bumpSearchFocus = useCallback(() => {
    setSearchFieldFocusToken((token) => token + 1);
  }, []);

  const finishCloseSearch = useCallback(() => {
    setSearchActive(false);
    searchActiveShared.value = false;
  }, [searchActiveShared]);

  // Keep clip width in lockstep with the same progress the pill uses.
  useAnimatedReaction(
    () => searchProgress.value,
    (p) => {
      if (!searchActiveShared.value && p <= 0.001) return;
      sidebarClipWidth.value = DRAWER_WIDTH + (SCREEN_WIDTH - DRAWER_WIDTH) * p;
    }
  );

  const openSearch = useCallback(() => {
    // 1) Commit index-hide + categories + header height on the JS/layout thread.
    // 2) Start the morph only after that paint — otherwise React's re-render
    //    lands mid-withTiming and the bar visibly stalls.
    searchActiveShared.value = true;
    setSearchActive(true);
    if (reduceMotion) {
      searchProgress.value = 1;
      offsetX.value = SCREEN_WIDTH;
      sidebarClipWidth.value = SCREEN_WIDTH;
      bumpSearchFocus();
      return;
    }
    setSearchMorphPending(true);
  }, [
    bumpSearchFocus,
    offsetX,
    reduceMotion,
    searchActiveShared,
    searchProgress,
    sidebarClipWidth,
  ]);

  useEffect(() => {
    if (!searchMorphPending) return;
    setSearchMorphPending(false);
    searchProgress.value = withTiming(1, SEARCH_TIMING, (finished) => {
      if (finished) scheduleOnRN(bumpSearchFocus);
    });
    offsetX.value = withTiming(SCREEN_WIDTH, SEARCH_TIMING);
  }, [bumpSearchFocus, offsetX, searchMorphPending, searchProgress]);

  const closeSearch = useCallback(() => {
    setSearchQuery('');
    setSearchMorphPending(false);
    if (reduceMotion) {
      searchProgress.value = 0;
      offsetX.value = DRAWER_WIDTH;
      sidebarClipWidth.value = DRAWER_WIDTH;
      finishCloseSearch();
      return;
    }
    // Morph back first; drop categories/index only when the bar is done.
    searchProgress.value = withTiming(0, SEARCH_TIMING, (finished) => {
      if (finished) scheduleOnRN(finishCloseSearch);
    });
    offsetX.value = withTiming(DRAWER_WIDTH, SEARCH_TIMING);
  }, [
    finishCloseSearch,
    offsetX,
    reduceMotion,
    searchProgress,
    sidebarClipWidth,
  ]);

  useEffect(() => {
    if (!open) {
      setOpenHistoryMenuEntryId(null);
    }
  }, [open]);

  const handleHistoryMenuOpen = useCallback((entryId: string) => {
    // Defer past the UIContextMenu presentation frame. Sync setState here
    // re-lays out the sidebar while UIKit is snapshotting/lifting and the
    // absolute BlurView header goes blank until the menu closes.
    requestAnimationFrame(() => {
      setOpenHistoryMenuEntryId(entryId);
    });
  }, []);

  const handleHistoryMenuClose = useCallback(() => {
    setOpenHistoryMenuEntryId(null);
  }, []);

  useEffect(() => {
    openShared.value = open;
    if (!open) {
      setSearchActive(false);
      setSearchMorphPending(false);
      setSearchQuery('');
      searchActiveShared.value = false;
      searchProgress.value = 0;
      offsetX.value = withSpring(0, DRAWER_SPRING);
      sidebarClipWidth.value = DRAWER_WIDTH;
      return;
    }

    if (searchActiveShared.value) {
      return;
    }

    offsetX.value = withSpring(DRAWER_WIDTH, DRAWER_SPRING);
    sidebarClipWidth.value = DRAWER_WIDTH;
  }, [offsetX, open, openShared, searchActiveShared, searchProgress, sidebarClipWidth]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(open && !openHistoryMenuEntryId)
        .activeOffsetX([-12, 12])
        .failOffsetY([-16, 16])
        .onBegin(() => {
          dragStartX.value = offsetX.value;
        })
        .onUpdate((event) => {
          const maxW = drawerMaxWidth.value;
          const next = dragStartX.value + event.translationX;
          offsetX.value = reduceMotionShared.value
            ? Math.max(0, Math.min(maxW, next))
            : rubberbandOffset(next, 0, maxW, maxW);
          if (searchActiveShared.value) {
            const clipped = Math.max(0, Math.min(maxW, offsetX.value));
            sidebarClipWidth.value = clipped;
            const span = SCREEN_WIDTH - DRAWER_WIDTH;
            searchProgress.value = span > 0 ? (clipped - DRAWER_WIDTH) / span : 1;
          }
        })
        .onEnd((event) => {
          const maxW = drawerMaxWidth.value;
          const current = Math.max(0, Math.min(maxW, offsetX.value));
          const opening = dragStartX.value < maxW * 0.5;
          const velocity = event.velocityX;
          const settle = (target: number) => {
            'worklet';
            offsetX.value = withSpring(target, {
              ...DRAWER_SPRING,
              velocity,
              clamp: [0, maxW],
            });
          };

          if (opening) {
            const shouldOpen = current > maxW * 0.35 || velocity > 650;
            const target = shouldOpen ? maxW : 0;
            settle(target);
            if (searchActiveShared.value) {
              sidebarClipWidth.value = target;
              const span = SCREEN_WIDTH - DRAWER_WIDTH;
              searchProgress.value = span > 0 ? (target - DRAWER_WIDTH) / span : 1;
            }
            if (shouldOpen && !openShared.value) scheduleOnRN(onOpen);
            if (!shouldOpen && openShared.value) scheduleOnRN(onClose);
            return;
          }

          const shouldClose = current < maxW * 0.65 || velocity < -650;
          const target = shouldClose ? 0 : maxW;
          settle(target);
          if (searchActiveShared.value) {
            sidebarClipWidth.value = target;
            const span = SCREEN_WIDTH - DRAWER_WIDTH;
            searchProgress.value = span > 0 ? (target - DRAWER_WIDTH) / span : 1;
          }
          if (shouldClose && openShared.value) scheduleOnRN(onClose);
          if (!shouldClose && !openShared.value) scheduleOnRN(onOpen);
        }),
    [onClose, onOpen, open, openHistoryMenuEntryId]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(open && !openHistoryMenuEntryId)
        .onEnd(() => {
          scheduleOnRN(onClose);
        }),
    [onClose, open, openHistoryMenuEntryId]
  );

  // Open by swiping right from anywhere on the main sheet.
  // Classic result keeps a left-edge swipe only — horizontal pan there
  // changes steps. Lumen canvases have no sidebar button, so the full sheet
  // swipe stays on.
  const allowFullOpenSwipe =
    enableEdgeSwipe && (phase !== 'result' || Boolean(data?.lumenCanvas));
  const openPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!open && allowFullOpenSwipe && !sheetGesturesLocked)
        .activeOffsetX(20)
        .failOffsetY([-16, 16])
        .onBegin(() => {
          dragStartX.value = 0;
        })
        .onUpdate((event) => {
          offsetX.value = reduceMotionShared.value
            ? Math.max(0, Math.min(DRAWER_WIDTH, event.translationX))
            : rubberbandOffset(event.translationX, 0, DRAWER_WIDTH, DRAWER_WIDTH);
        })
        .onEnd((event) => {
          const current = Math.max(0, Math.min(DRAWER_WIDTH, offsetX.value));
          const shouldOpen = current > DRAWER_WIDTH * 0.35 || event.velocityX > 650;
          offsetX.value = withSpring(shouldOpen ? DRAWER_WIDTH : 0, {
            ...DRAWER_SPRING,
            velocity: event.velocityX,
            clamp: [0, DRAWER_WIDTH],
          });
          if (shouldOpen) {
            scheduleOnRN(onOpen);
          }
        }),
    [allowFullOpenSwipe, onOpen, open, sheetGesturesLocked]
  );

  const mainGesture = useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture, openPanGesture),
    [openPanGesture, panGesture, tapGesture]
  );

  const edgeOpenGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(12)
        .onUpdate((event) => {
          offsetX.value = reduceMotionShared.value
            ? Math.max(0, Math.min(DRAWER_WIDTH, event.translationX))
            : rubberbandOffset(event.translationX, 0, DRAWER_WIDTH, DRAWER_WIDTH);
        })
        .onEnd((event) => {
          const current = Math.max(0, Math.min(DRAWER_WIDTH, offsetX.value));
          const shouldOpen = current > DRAWER_WIDTH * 0.35 || event.velocityX > 650;
          offsetX.value = withSpring(shouldOpen ? DRAWER_WIDTH : 0, {
            ...DRAWER_SPRING,
            velocity: event.velocityX,
            clamp: [0, DRAWER_WIDTH],
          });
          if (shouldOpen) {
            scheduleOnRN(onOpen);
          }
        }),
    [onOpen]
  );

  const sidebarClipStyle = useAnimatedStyle(() => ({
    width: searchActiveShared.value ? sidebarClipWidth.value : DRAWER_WIDTH,
  }));

  const mainSheetStyle = useAnimatedStyle(() => {
    const maxW = Math.max(drawerMaxWidth.value, 1);
    const progress = offsetX.value / maxW;
    const radius = offsetX.value > 0 ? MAIN_SHEET_CORNER_RADIUS : 0;
    const shadowOpacity = interpolate(
      progress,
      [0, 1],
      [0, drawerShadowPeak],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateX: offsetX.value }],
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      shadowColor: drawerShadow.shadowColor,
      shadowOffset: drawerShadow.shadowOffset,
      shadowOpacity,
      shadowRadius: drawerShadow.shadowRadius,
      elevation: progress > 0.01 ? drawerShadow.elevation : drawerShadowFlatElevation,
    };
  });

  const mainLightenOverlayStyle = useAnimatedStyle(() => {
    const maxW = Math.max(drawerMaxWidth.value, 1);
    const progress = offsetX.value / maxW;
    const opacity = interpolate(
      progress,
      [0, 1],
      [0, drawerLightenPeak],
      Extrapolation.CLAMP
    );

    return { opacity };
  });

  const underlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      offsetX.value,
      [0, Math.max(drawerMaxWidth.value, 1)],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const canvasColor = mainCanvasColor;

  return (
    <HomeSheetGestureLockContext.Provider value={sheetGestureLock}>
    <View
      className={isDark ? 'dark' : undefined}
      style={[styles.root, { backgroundColor: sidebarCanvasColor }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.underlay,
          underlayStyle,
          { backgroundColor: sidebarCanvasColor },
        ]}
      />

      <Animated.View
        style={[styles.sidebar, sidebarClipStyle, { backgroundColor: sidebarCanvasColor }]}
      >
        {/* Keep the brand header outside menu-open pointerEvents toggles.
            Changing ancestor hit-testing while UIContextMenu presents blanks
            BlurView / absolute chrome in this overflow:hidden sidebar. */}
        <SidebarBrandHeader
          height={brandHeaderHeight}
          insetTop={insets.top}
          backgroundColor={sidebarCanvasColor}
          isDark={isDark}
          onPress={() => {
            if (openHistoryMenuEntryId) return;
            onNewMap();
            onClose();
          }}
          searchActive={searchActive}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearchOpen={() => {
            if (openHistoryMenuEntryId) return;
            openSearch();
          }}
          onSearchClose={() => {
            if (openHistoryMenuEntryId) return;
            closeSearch();
          }}
          searchFilters={searchActive ? searchFilters : undefined}
          searchProgress={searchProgress}
          searchFieldFocusToken={searchFieldFocusToken}
        />
        <SidebarOcclusionFade
          top={searchActive ? searchStackHeight : headerSolidHeight}
          color={sidebarCanvasColor}
        />
        <View
          style={[
            styles.sidebarBody,
            { width: searchActive ? SCREEN_WIDTH : DRAWER_WIDTH },
          ]}
        >
          <HistorySheet
            visible
            embedded
            hideBrandHeader
            canvasColor={sidebarCanvasColor}
            entries={entries}
            collections={collections}
            activeId={activeId}
            onClose={onClose}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            onUpdateCategory={onUpdateCategory}
            onTogglePin={onTogglePin}
            onExportPdf={onExportPdf}
            showIndex={phase === 'result' && Boolean(data)}
            data={data}
            currentStep={currentStep}
            isComplete={isComplete}
            onGoToStep={onGoToStep}
            onNewMap={onNewMap}
            searchActive={searchActive}
            searchQuery={searchQuery}
            onSearchOpen={openSearch}
            onSearchClose={closeSearch}
            onSearchQueryChange={setSearchQuery}
            openMenuEntryId={openHistoryMenuEntryId}
            onHistoryMenuOpen={handleHistoryMenuOpen}
            onHistoryMenuClose={handleHistoryMenuClose}
            registerSearchFilters={setSearchFilters}
            searchStackHeight={searchStackHeight}
          />
        </View>
      </Animated.View>

      <GestureDetector gesture={mainGesture}>
        <Animated.View
          style={[styles.mainSheet, mainSheetStyle, { backgroundColor: canvasColor }]}
        >
          {children}
          <Animated.View
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              StyleSheet.absoluteFill,
              styles.mainLightenOverlay,
              mainLightenOverlayStyle,
              { backgroundColor: isDark ? colors.text.primary : colors.background.surface },
            ]}
          />
        </Animated.View>
      </GestureDetector>

      {enableEdgeSwipe && !open ? (
        <GestureDetector gesture={edgeOpenGesture}>
          <View style={styles.edgeHitSlop} />
        </GestureDetector>
      ) : null}
    </View>
    </HomeSheetGestureLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  underlay: {
    zIndex: 0,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  sidebarBody: {
    flex: 1,
    height: '100%',
  },
  mainSheet: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    overflow: 'hidden',
  },
  mainLightenOverlay: {
    zIndex: 1,
  },
  edgeHitSlop: {
    position: 'absolute',
    left: 0,
    top: EDGE_SWIPE_TOP_INSET,
    bottom: 0,
    width: 24,
    zIndex: 20,
  },
});
