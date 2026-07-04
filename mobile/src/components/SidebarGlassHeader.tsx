import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Search, X } from 'lucide-react-native';
import EngravedNucleoMark, { ENGRAVED_NUCLEO_COMPACT_FONT_SIZE } from './EngravedNucleoMark';
import AppIcon from './AppIcon';
import FloatingGlassButton from './FloatingGlassButton';
import { TEXT_PRIMARY, TEXT_SECONDARY } from '@shared/uiTokens';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';

/** Mirrors web CSS vars on .mobile-sidebar */
export const SIDEBAR_OCCLUSION = {
  headerBelowSafeArea: 52,
  bodyBelowSafeArea: 72,
  fade: 24,
  listTopExtra: 10,
  listBottomMin: 120,
} as const;

export const SIDEBAR_BRAND_ROW_HEIGHT = 56;
import { SIDEBAR_HEADER_BUTTON_SIZE } from './sidebarLayout';

/** @deprecated Use SIDEBAR_HEADER_BUTTON_SIZE */
export const SIDEBAR_SEARCH_BUTTON_SIZE = SIDEBAR_HEADER_BUTTON_SIZE;

export function sidebarHeaderSolidHeight(insetTop: number) {
  return insetTop + SIDEBAR_OCCLUSION.headerBelowSafeArea;
}

export function sidebarTopOcclusion(insetTop: number) {
  return insetTop + SIDEBAR_OCCLUSION.bodyBelowSafeArea;
}

export function sidebarListPaddingTop(insetTop: number) {
  return sidebarTopOcclusion(insetTop) + SIDEBAR_OCCLUSION.listTopExtra;
}

/** @deprecated Use sidebarTopOcclusion */
export function sidebarGlassHeaderHeight(insetTop: number) {
  return sidebarTopOcclusion(insetTop);
}

export const SIDEBAR_SEARCH_FILTER_CHIP_TOP = 12;
export const SIDEBAR_SEARCH_FILTER_CHIP_HEIGHT = 32;
export const SIDEBAR_SEARCH_FILTER_CHIP_BOTTOM = 10;
/** Space between filter chips and first list row (e.g. Núcleos fijados). */
export const SIDEBAR_SEARCH_FILTER_LIST_GAP = 24;
export const SIDEBAR_SEARCH_FILTER_HEADER_HEIGHT =
  SIDEBAR_SEARCH_FILTER_CHIP_TOP +
  SIDEBAR_SEARCH_FILTER_CHIP_HEIGHT +
  SIDEBAR_SEARCH_FILTER_CHIP_BOTTOM;

const SIDEBAR_BRAND_SHELL_TOP = 10;

export function sidebarSearchStackHeight(insetTop: number) {
  return (
    insetTop +
    SIDEBAR_BRAND_SHELL_TOP +
    SIDEBAR_HEADER_BUTTON_SIZE +
    SIDEBAR_SEARCH_FILTER_HEADER_HEIGHT
  );
}

export function SidebarOcclusionFade({ top, color }: { top: number; color: string }) {
  return (
    <View
      pointerEvents="none"
      style={[occlusionFadeStyles.root, { top, height: SIDEBAR_OCCLUSION.fade }]}
    >
      <Svg width="100%" height={SIDEBAR_OCCLUSION.fade} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sidebarOcclusionFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={SIDEBAR_OCCLUSION.fade} fill="url(#sidebarOcclusionFade)" />
      </Svg>
    </View>
  );
}

type SidebarBrandHeaderProps = {
  height: number;
  insetTop: number;
  backgroundColor: string;
  isDark: boolean;
  onPress: () => void;
  searchActive?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
  searchFilters?: React.ReactNode;
};

export function SidebarBrandHeader({
  height,
  insetTop,
  backgroundColor,
  isDark,
  onPress,
  searchActive = false,
  searchQuery = '',
  onSearchQueryChange,
  onSearchOpen,
  onSearchClose,
  searchFilters,
}: SidebarBrandHeaderProps) {
  const searchRef = useRef<TextInput>(null);
  const { reduceMotion } = useGlassAccessibility();
  const iconColor = TEXT_SECONDARY;
  const placeholderColor = TEXT_SECONDARY;
  const inputColor = TEXT_PRIMARY;

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!searchActive) return;
    if (reduceMotion) {
      focusSearch();
      return;
    }
    // Focus (and the keyboard) waits for the expansion/crossfade to finish so
    // the two animations don't compete for frames.
    const timer = setTimeout(focusSearch, 340);
    return () => clearTimeout(timer);
  }, [focusSearch, reduceMotion, searchActive]);

  // ChatGPT-style morph: the pill is anchored to the right (under the lupa
  // button) and stretches leftwards until it fills the row. Progress lives in
  // a plain shared value driven once per toggle from an effect — deriving it
  // with useDerivedValue(withTiming) restarted the easing curve on every
  // re-render mid-animation, which is what produced the micro-pause (the very
  // first open after launch had no extra re-renders, so only it looked right).
  const { width: windowWidth } = useWindowDimensions();
  // brandShell horizontal padding (24 each side). When search is open the
  // drawer expands to full screen width, so this is the pill's final width.
  const expandedPillWidth = windowWidth - 48;
  const searchProgress = useSharedValue(searchActive ? 1 : 0);

  useEffect(() => {
    searchProgress.value = withTiming(searchActive ? 1 : 0, {
      // Matches the drawer's SEARCH_TIMING so expansion + stretch read as one
      // single motion.
      duration: reduceMotion ? 0 : 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, searchActive, searchProgress]);

  const brandLayerStyle = useAnimatedStyle(() => ({
    // Brand gets out of the way in the first half of the stretch.
    opacity: interpolate(searchProgress.value, [0, 0.5], [1, 0], 'clamp'),
  }));
  const searchIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.value, [0, 0.5], [1, 0], 'clamp'),
  }));
  const closeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.value, [0.5, 1], [0, 1], 'clamp'),
  }));
  const pillStyle = useAnimatedStyle(() => ({
    width:
      SIDEBAR_HEADER_BUTTON_SIZE +
      (expandedPillWidth - SIDEBAR_HEADER_BUTTON_SIZE) * searchProgress.value,
    opacity: searchProgress.value > 0.001 ? 1 : 0,
  }));
  const pillContentStyle = useAnimatedStyle(() => ({
    // Icon + placeholder appear once the pill has room for them.
    opacity: interpolate(searchProgress.value, [0.45, 1], [0, 1], 'clamp'),
  }));

  const searchSurfaceBg = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(120,120,128,0.12)';
  const searchSurfaceBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';

  const searchRow = (
    <View style={[styles.brandRow, { height: SIDEBAR_HEADER_BUTTON_SIZE }]}>
      <View style={styles.swapSlot}>
        <Animated.View
          pointerEvents={searchActive ? 'none' : 'auto'}
          style={[styles.swapLayer, brandLayerStyle]}
        >
          <Pressable
            onPress={onPress}
            style={[styles.brandPressableInner, { height: SIDEBAR_HEADER_BUTTON_SIZE }]}
            accessibilityRole="button"
            accessibilityLabel="Ir a inicio"
          >
            <View style={[styles.brandMark, { height: SIDEBAR_HEADER_BUTTON_SIZE }]}>
              <AppIcon size={28} color={TEXT_PRIMARY} />
              <EngravedNucleoMark
                fontSize={ENGRAVED_NUCLEO_COMPACT_FONT_SIZE}
                tone="sidebar"
                rowHeight={SIDEBAR_HEADER_BUTTON_SIZE}
              />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents={searchActive ? 'auto' : 'none'}
        style={[
          styles.searchPillAnchor,
          pillStyle,
          {
            backgroundColor: searchSurfaceBg,
            borderColor: searchSurfaceBorder,
          },
        ]}
      >
        <Animated.View style={[styles.searchPillContent, pillContentStyle]}>
          <Search size={16} color={iconColor} strokeWidth={2.25} />
          <TextInput
            ref={searchRef}
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            placeholder="Buscar Núcleos y contenido…"
            placeholderTextColor={placeholderColor}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            style={[styles.searchInput, { color: inputColor }]}
            accessibilityLabel="Buscar en el historial"
          />
        </Animated.View>
      </Animated.View>

      <FloatingGlassButton
        onPress={() => (searchActive ? onSearchClose?.() : onSearchOpen?.())}
        accessibilityLabel={searchActive ? 'Cerrar búsqueda' : 'Buscar en el historial'}
        shape="circle"
        size={SIDEBAR_HEADER_BUTTON_SIZE}
      >
        <View style={styles.iconSwap}>
          <Animated.View style={[styles.iconLayer, searchIconStyle]}>
            <Search size={17} color={iconColor} strokeWidth={2.25} />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, closeIconStyle]}>
            <X size={17} color={iconColor} strokeWidth={2.25} />
          </Animated.View>
        </View>
      </FloatingGlassButton>
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.brandHeader, { height }]}
      collapsable={false}
    >
      <BlurView
        intensity={40}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor, opacity: 0.86 }]}
      />
      <View style={[styles.brandShell, { paddingTop: insetTop + 10 }]}>
        {searchRow}
        {searchActive && searchFilters ? (
          <View style={styles.searchFilterRow}>{searchFilters}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  brandShell: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
    paddingBottom: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  swapSlot: {
    flex: 1,
    minWidth: 0,
    height: SIDEBAR_HEADER_BUTTON_SIZE,
  },
  swapLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  iconSwap: {
    width: 17,
    height: 17,
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandPressableInner: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchPillAnchor: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: SIDEBAR_HEADER_BUTTON_SIZE,
    borderRadius: SIDEBAR_HEADER_BUTTON_SIZE / 2,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  searchFilterRow: {
    marginTop: SIDEBAR_SEARCH_FILTER_CHIP_TOP,
    paddingBottom: SIDEBAR_SEARCH_FILTER_CHIP_BOTTOM,
    width: '100%',
  },
  searchPillContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    // Keeps text clear of the circular close button overlapping the right end.
    paddingRight: SIDEBAR_HEADER_BUTTON_SIZE + 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    height: SIDEBAR_HEADER_BUTTON_SIZE,
  },
});

const occlusionFadeStyles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
});
