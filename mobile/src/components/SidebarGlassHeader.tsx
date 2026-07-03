import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import EngravedNucleoMark, { ENGRAVED_NUCLEO_COMPACT_FONT_SIZE } from './EngravedNucleoMark';
import AppIcon from './AppIcon';
import FloatingGlassButton from './FloatingGlassButton';
import GlassSurface from './GlassSurface';
import { TEXT_BODY, TEXT_PRIMARY, TEXT_SECONDARY } from '@shared/uiTokens';
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
    const timer = setTimeout(focusSearch, 80);
    return () => clearTimeout(timer);
  }, [focusSearch, reduceMotion, searchActive]);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.brandHeader, { height, backgroundColor }]}
      collapsable={false}
    >
      <View style={[styles.brandShell, { paddingTop: insetTop + 10 }]}>
        <View style={[styles.brandRow, { height: SIDEBAR_HEADER_BUTTON_SIZE }]}>
          {!searchActive ? (
            <Pressable
              onPress={onPress}
              style={[styles.brandPressable, { height: SIDEBAR_HEADER_BUTTON_SIZE }]}
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
          ) : (
            <View style={styles.searchPill}>
              <GlassSurface
                liquid
                borderRadius={18}
                style={styles.searchGlass}
                className="rounded-full flex-1"
                contentClassName="flex-1 flex-row items-center px-3 gap-2"
              >
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
              </GlassSurface>
            </View>
          )}

          {searchActive ? (
            <FloatingGlassButton
              onPress={() => onSearchClose?.()}
              accessibilityLabel="Cerrar búsqueda"
              shape="circle"
              size={SIDEBAR_HEADER_BUTTON_SIZE}
            >
              <X size={17} color={iconColor} strokeWidth={2.25} />
            </FloatingGlassButton>
          ) : (
            <FloatingGlassButton
              onPress={() => onSearchOpen?.()}
              accessibilityLabel="Buscar en el historial"
              shape="circle"
              size={SIDEBAR_HEADER_BUTTON_SIZE}
            >
              <Search size={17} color={iconColor} strokeWidth={2.25} />
            </FloatingGlassButton>
          )}
        </View>
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
  brandPressable: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchPill: {
    flex: 1,
    height: SIDEBAR_HEADER_BUTTON_SIZE,
    minWidth: 0,
  },
  searchGlass: {
    flex: 1,
    height: SIDEBAR_HEADER_BUTTON_SIZE,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    height: SIDEBAR_HEADER_BUTTON_SIZE,
  },
});
