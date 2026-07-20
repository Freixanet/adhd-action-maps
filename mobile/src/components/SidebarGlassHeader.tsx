import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Search, X } from 'lucide-react-native';
import EngravedNucleoMark, { ENGRAVED_NUCLEO_COMPACT_FONT_SIZE } from './EngravedNucleoMark';
import AppIcon from './AppIcon';
import FloatingGlassButton from './FloatingGlassButton';
import { TEXT_PRIMARY, TEXT_SECONDARY } from '@shared/uiTokens';
import { SCREEN_WIDTH, SIDEBAR_HEADER_BUTTON_SIZE } from './sidebarLayout';

/** Content row width at full-screen search (24px padding × 2). */
const FULL_PILL_WIDTH = SCREEN_WIDTH - 48;

/** Mirrors web CSS vars on .mobile-sidebar */
export const SIDEBAR_OCCLUSION = {
  headerBelowSafeArea: 52,
  bodyBelowSafeArea: 72,
  fade: 24,
  listTopExtra: 10,
  listBottomMin: 120,
} as const;

export const SIDEBAR_BRAND_ROW_HEIGHT = 56;

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
  /** 0 = idle drawer, 1 = full-screen search. Drives pill stretch in lockstep with the drawer. */
  searchProgress: SharedValue<number>;
  /** Focus the field once the morph is done (keyboard must not fight the animation). */
  searchFieldFocusToken?: number;
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
  searchProgress,
  searchFieldFocusToken = 0,
}: SidebarBrandHeaderProps) {
  const searchRef = useRef<TextInput>(null);
  const iconColor = TEXT_SECONDARY;
  const placeholderColor = TEXT_SECONDARY;
  const inputColor = TEXT_PRIMARY;

  useEffect(() => {
    if (!searchFieldFocusToken) return;
    searchRef.current?.focus();
  }, [searchFieldFocusToken]);

  const brandLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));
  const searchIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));
  const closeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.value, [0.4, 0.75], [0, 1], Extrapolation.CLAMP),
  }));
  // Linear lerp to full-screen pill. Proven ≤ clip−48 for all t when clip
  // uses the same progress (see HistoryDrawer), so no clamp / hitch.
  const pillStyle = useAnimatedStyle(() => {
    const p = searchProgress.value;
    return {
      width:
        SIDEBAR_HEADER_BUTTON_SIZE +
        (FULL_PILL_WIDTH - SIDEBAR_HEADER_BUTTON_SIZE) * p,
      opacity: p > 0.001 ? 1 : 0,
    };
  });
  const pillContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.value, [0.2, 0.55], [0, 1], Extrapolation.CLAMP),
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
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
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
