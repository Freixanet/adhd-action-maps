import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingGlassButton, { FLOATING_PILL_MIN_HEIGHT } from './FloatingGlassButton';
import HistoryEntryCard from './HistoryEntryCard';
import HistoryEntryGlassMenu, { type HistoryEntryActionAnchor } from './HistoryEntryGlassMenu';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  SquarePen,
} from 'lucide-react-native';
import ProfileMenu from './ProfileMenu';
import {
  SidebarBrandHeader,
  SIDEBAR_OCCLUSION,
  sidebarHeaderSolidHeight,
  sidebarListPaddingTop,
} from './SidebarGlassHeader';
import { APP_DARK_BACKGROUND } from '@shared/uiTokens';
import { useTheme } from '../context/ThemeContext';
import {
  sortPinnedEntries,
  type HistoryEntry,
} from '../logic/history';
import { filterHistoryByCategory, filterHistoryEntries } from '../logic/historySearch';
import HistoryCategoryFilter from './HistoryCategoryFilter';
import CategoryEditSheet from './CategoryEditSheet';
import { collectUsedCategories, collectUserCategories } from '@shared/categories';
import type { ActionMapData } from '../logic/contracts';

type HistorySheetProps = {
  visible: boolean;
  entries: HistoryEntry[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onUpdateCategory: (id: string, category: string) => void;
  onTogglePin: (id: string) => void;
  embedded?: boolean;
  canvasColor?: string;
  glassHeaderHeight?: number;
  showIndex?: boolean;
  data?: ActionMapData | null;
  currentStep?: number;
  isComplete?: boolean;
  onGoToStep?: (idx: number) => void;
  onNewMap?: () => void;
  searchActive?: boolean;
  searchQuery?: string;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
  onSearchQueryChange?: (value: string) => void;
  /** Header is rendered by HistoryDrawer at clip level when embedded in drawer. */
  hideBrandHeader?: boolean;
};

type ActionMenuState = HistoryEntryActionAnchor | null;

export default function HistorySheet({
  visible,
  entries,
  activeId,
  onClose,
  onSelect,
  onDelete,
  onRename,
  onUpdateCategory,
  onTogglePin,
  embedded = false,
  canvasColor,
  showIndex = false,
  data,
  currentStep = 0,
  isComplete = false,
  onGoToStep,
  onNewMap,
  searchActive = false,
  searchQuery = '',
  onSearchOpen,
  onSearchClose,
  onSearchQueryChange,
  hideBrandHeader = false,
}: HistorySheetProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [categoryEditEntry, setCategoryEditEntry] = useState<HistoryEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [actionMenu, setActionMenu] = useState<ActionMenuState>(null);
  const [indexExpanded, setIndexExpanded] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const floatingActionsBottom = Math.max(insets.bottom, 12);
  const listBottomInset = floatingActionsBottom + FLOATING_PILL_MIN_HEIGHT + 20;
  const { isDark } = useTheme();

  const usedCategories = useMemo(() => collectUsedCategories(entries), [entries]);
  const userCategories = useMemo(() => collectUserCategories(entries), [entries]);

  useEffect(() => {
    if (!searchActive) {
      setCategoryFilter(null);
    }
  }, [searchActive]);

  useEffect(() => {
    if (
      categoryFilter &&
      !usedCategories.some(
        (category) => category.toLowerCase() === categoryFilter.toLowerCase()
      )
    ) {
      setCategoryFilter(null);
    }
  }, [categoryFilter, usedCategories]);

  const filteredEntries = useMemo(() => {
    if (!searchActive) return entries;
    const searched = filterHistoryEntries(entries, searchQuery);
    return filterHistoryByCategory(searched, categoryFilter);
  }, [categoryFilter, entries, searchActive, searchQuery]);

  const pinnedEntries = useMemo(
    () => sortPinnedEntries(filteredEntries.filter((entry) => entry.pinned)),
    [filteredEntries]
  );
  const regularEntries = useMemo(
    () => filteredEntries.filter((entry) => !entry.pinned),
    [filteredEntries]
  );
  const listData = useMemo(
    () => [
      ...(pinnedEntries.length ? [{ type: 'header' as const, id: 'pinned-header', title: 'Núcleos fijados' }] : []),
      ...pinnedEntries.map((entry) => ({ type: 'entry' as const, entry })),
      ...(regularEntries.length ? [{ type: 'header' as const, id: 'recent-header', title: 'Núcleos recientes' }] : []),
      ...regularEntries.map((entry) => ({ type: 'entry' as const, entry })),
    ],
    [pinnedEntries, regularEntries]
  );

  const openCategoryEditor = useCallback((entry: HistoryEntry) => {
    setCategoryEditEntry(entry);
    setActionMenu(null);
  }, []);

  const handleSaveCategory = useCallback(
    (category: string) => {
      if (!categoryEditEntry) return;
      onUpdateCategory(categoryEditEntry.id, category);
      setCategoryEditEntry(null);
    },
    [categoryEditEntry, onUpdateCategory]
  );

  const startRename = useCallback((entry: HistoryEntry) => {
    setRenamingId(entry.id);
    setRenameValue(entry.title);
    setActionMenu(null);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    onRename(renamingId, renameValue);
    setRenamingId(null);
    setRenameValue('');
  }, [onRename, renameValue, renamingId]);

  const openEntryMenu = useCallback(
    (entry: HistoryEntry, anchor: { x: number; y: number; width: number; height: number }) => {
      setActionMenu({
        entry,
        top: anchor.y + anchor.height + 8,
        left: anchor.x,
        width: anchor.width,
      });
    },
    []
  );

  const handleDeleteEntry = useCallback(
    (entry: HistoryEntry) => {
      Alert.alert('Eliminar Núcleo', '¿Seguro que quieres eliminar este Núcleo?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(entry.id),
        },
      ]);
    },
    [onDelete]
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof listData)[number] }) => {
      if (item.type === 'header') {
        const isRecentHeader = item.id === 'recent-header';
        const isPinnedHeader = item.id === 'pinned-header';
        const pinTopPadding =
          isPinnedHeader && showIndex && data && !searchActive ? 'pt-8' : isPinnedHeader ? 'pt-1' : 'pt-1';
        return (
          <Text
            className={`px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-secondary ${
              isRecentHeader ? 'pt-8' : pinTopPadding
            }`}
          >
            {item.title}
          </Text>
        );
      }

      const entry = item.entry;
      const isActive = entry.id === activeId;

      return (
        <HistoryEntryCard
          entry={entry}
          isActive={isActive}
          isRenaming={renamingId === entry.id}
          renameValue={renameValue}
          onRenameValueChange={setRenameValue}
          onCommitRename={commitRename}
          onSelect={onSelect}
          onLongPress={openEntryMenu}
        />
      );
    },
    [activeId, commitRename, data, onSelect, openEntryMenu, renameValue, renamingId, searchActive, showIndex]
  );

  const listHeaderComponent = useMemo(() => {
    if (searchActive) {
      if (usedCategories.length === 0) return null;
      return (
        <View className="pb-2 pt-1">
          <HistoryCategoryFilter
            selectedCategory={categoryFilter}
            categories={usedCategories}
            onSelect={setCategoryFilter}
          />
        </View>
      );
    }

    if (!showIndex || !data) {
      return null;
    }

    return (
      <View className="mb-6">
        <Pressable
          onPress={() => setIndexExpanded((value) => !value)}
          className="flex-row items-center gap-2 mb-3 px-1 py-1"
          accessibilityState={{ expanded: indexExpanded }}
        >
          <View style={styles.indexChevronSlot}>
            {indexExpanded ? (
              <ChevronDown size={16} color="#a3a3a3" />
            ) : (
              <ChevronRight size={16} color="#a3a3a3" />
            )}
          </View>
          <Text className="text-xs font-bold tracking-widest uppercase text-secondary">Índice</Text>
        </Pressable>

        {indexExpanded ? (
          <View className="mb-4">
            <Pressable
              onPress={() => {
                onGoToStep?.(0);
                onClose();
              }}
              className={`px-4 py-3 rounded-lg mb-1 ${
                currentStep === 0 && !isComplete ? 'bg-accent/10 dark:bg-accent/100/10' : ''
              }`}
            >
              <Text
                className={`font-semibold ${
                  currentStep === 0 && !isComplete
                    ? 'text-accent'
                    : 'text-body'
                }`}
              >
                Índice del Núcleo
              </Text>
            </Pressable>

            {data.steps?.map((step, idx) => {
              const stepNum = idx + 1;
              const isActive = currentStep === stepNum && !isComplete;
              const isPast = currentStep > stepNum || isComplete;
              return (
                <Pressable
                  key={step.id || stepNum}
                  onPress={() => {
                    onGoToStep?.(stepNum);
                    onClose();
                  }}
                  className={`px-4 py-3 rounded-lg mb-1 flex-row items-center justify-between ${
                    isActive ? 'bg-accent/10 dark:bg-accent/100/10' : ''
                  }`}
                >
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    <View className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-white/10 items-center justify-center">
                      <Text className="text-xs font-bold text-secondary">
                        {stepNum}
                      </Text>
                    </View>
                    <Text
                      className={`flex-1 font-semibold ${
                        isActive
                          ? 'text-accent'
                          : 'text-body'
                      }`}
                      numberOfLines={1}
                    >
                      {step.shortNav || step.title}
                    </Text>
                  </View>
                  <CheckCircle2 size={16} color={isPast ? '#8B8FF5' : '#a3a3a3'} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }, [
    categoryFilter,
    currentStep,
    data,
    indexExpanded,
    isComplete,
    onClose,
    onGoToStep,
    showIndex,
    searchActive,
    usedCategories,
  ]);

  const listEmptyComponent = useMemo(() => {
    if (searchActive && (searchQuery.trim() || categoryFilter)) {
      return (
        <View className="py-8 px-2">
          <Text className="text-center text-body leading-6">
            {searchQuery.trim()
              ? `No hay resultados para «${searchQuery.trim()}».`
              : 'No hay Núcleos en esta categoría.'}
          </Text>
        </View>
      );
    }

    return (
      <View className="py-8 px-2">
        <Text className="text-center text-body leading-6">
          Aún no hay Núcleos guardados. Genera una lectura y aparecerá aquí.
        </Text>
      </View>
    );
  }, [categoryFilter, searchActive, searchQuery]);

  const headerSolidHeight = sidebarHeaderSolidHeight(insets.top);
  const listTopInset = sidebarListPaddingTop(insets.top);
  const listBottomPadding = Math.max(SIDEBAR_OCCLUSION.listBottomMin, listBottomInset);
  const sheetBackground = canvasColor ?? (isDark ? APP_DARK_BACKGROUND : '#f0f0f0');

  const content = (
    <View
      className={isDark ? 'dark flex-1' : 'flex-1'}
      style={[styles.sheetRoot, { backgroundColor: sheetBackground }]}
    >
      <View style={styles.sheetBody}>
        <FlashList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item) => ('entry' in item ? item.entry.id : item.id)}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={listEmptyComponent}
          contentContainerStyle={{
            paddingTop: listTopInset,
            paddingBottom: listBottomPadding,
            paddingHorizontal: 16,
          }}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
        {!hideBrandHeader ? (
          <SidebarBrandHeader
            height={headerSolidHeight}
            insetTop={insets.top}
            backgroundColor={sheetBackground}
            isDark={isDark}
            onPress={() => {
              onNewMap?.();
              onClose();
            }}
            searchActive={searchActive}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            onSearchOpen={onSearchOpen}
            onSearchClose={onSearchClose}
          />
        ) : null}
      </View>

      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 flex-row items-center justify-between px-5"
        style={{ bottom: floatingActionsBottom }}
      >
        <ProfileMenu placement="bottomLeft" floating />
        <FloatingGlassButton
          onPress={() => {
            onNewMap?.();
            onClose();
          }}
          accessibilityLabel="Nuevo Núcleo"
          shape="pill"
          tone="accent"
          compact
        >
          <SquarePen size={17} color="#ffffff" />
          <Text className="text-[15px] font-bold text-white">Nuevo Núcleo</Text>
        </FloatingGlassButton>
      </View>

      <HistoryEntryGlassMenu
        menu={actionMenu}
        onClose={() => setActionMenu(null)}
        onRename={startRename}
        onChangeCategory={openCategoryEditor}
        onTogglePin={(entry) => onTogglePin(entry.id)}
        onDelete={handleDeleteEntry}
      />

      <CategoryEditSheet
        visible={Boolean(categoryEditEntry)}
        value={categoryEditEntry?.category ?? 'Otros'}
        usedCategories={usedCategories}
        userCategories={userCategories}
        mapTitle={categoryEditEntry?.title}
        onClose={() => setCategoryEditEntry(null)}
        onSave={handleSaveCategory}
      />
    </View>
  );

  if (embedded) {
    return visible ? content : null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    overflow: 'hidden',
  },
  sheetBody: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  list: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  indexChevronSlot: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
