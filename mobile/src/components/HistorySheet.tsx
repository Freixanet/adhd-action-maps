import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingGlassButton, { FLOATING_PILL_MIN_HEIGHT } from './FloatingGlassButton';
import HistoryEntryCard from './HistoryEntryCard';
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
  SIDEBAR_SEARCH_FILTER_LIST_GAP,
  sidebarHeaderSolidHeight,
  sidebarListPaddingTop,
  sidebarSearchStackHeight,
} from './SidebarGlassHeader';
import { APP_DARK_BACKGROUND } from '@shared/uiTokens';
import { useTheme } from '../context/ThemeContext';
import {
  sortPinnedEntries,
  type HistoryEntry,
} from '../logic/history';
import { groupHistoryEntries, type Coleccion } from '@shared/collections';
import HistoryCollectionGroup from './HistoryCollectionGroup';
import { applyHistoryListFilter, filterHistoryEntries, type HistoryListFilter } from '../logic/historySearch';
import HistoryCategoryFilter from './HistoryCategoryFilter';
import CategoryEditSheet from './CategoryEditSheet';
import { collectUsedCategories, collectUserCategories } from '@shared/categories';
import type { ActionMapData } from '../logic/contracts';

type HistorySheetProps = {
  visible: boolean;
  entries: HistoryEntry[];
  collections?: Coleccion[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onUpdateCategory: (id: string, category: string) => void;
  onTogglePin: (id: string) => void;
  onExportPdf?: (id: string) => void;
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
  openMenuEntryId?: string | null;
  onHistoryMenuOpen?: (entryId: string) => void;
  onHistoryMenuClose?: () => void;
  registerSearchFilters?: (node: ReactNode | null) => void;
  searchStackHeight?: number;
};

export default function HistorySheet({
  visible,
  entries,
  collections = [],
  activeId,
  onClose,
  onSelect,
  onDelete,
  onRename,
  onUpdateCategory,
  onTogglePin,
  onExportPdf,
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
  openMenuEntryId = null,
  onHistoryMenuOpen,
  onHistoryMenuClose,
  registerSearchFilters,
  searchStackHeight: searchStackHeightProp,
}: HistorySheetProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<Record<string, boolean>>({});
  const [categoryEditEntry, setCategoryEditEntry] = useState<HistoryEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [indexExpanded, setIndexExpanded] = useState(true);
  const [listFilter, setListFilter] = useState<HistoryListFilter>('all');
  // The list's switch into search mode (filter chips header, re-filtering,
  // row re-renders) is deferred until the drawer/pill animation has finished —
  // doing that render work in the same frame as the animation start is what
  // caused the opening stutter. Exiting search reverts immediately.
  const [searchMode, setSearchMode] = useState(searchActive);
  useEffect(() => {
    if (!searchActive) {
      setSearchMode(false);
      return;
    }
    const timer = setTimeout(() => setSearchMode(true), 360);
    return () => clearTimeout(timer);
  }, [searchActive]);
  const insets = useSafeAreaInsets();
  const floatingActionsBottom = Math.max(insets.bottom, 12);
  const listBottomInset = searchActive
    ? floatingActionsBottom + 16
    : floatingActionsBottom + FLOATING_PILL_MIN_HEIGHT + 20;
  const { isDark } = useTheme();

  const usedCategories = useMemo(() => collectUsedCategories(entries), [entries]);
  const userCategories = useMemo(() => collectUserCategories(entries), [entries]);

  useEffect(() => {
    if (!searchActive) {
      setListFilter('all');
    }
  }, [searchActive]);

  useEffect(() => {
    if (
      listFilter !== 'all' &&
      listFilter !== 'incomplete' &&
      !usedCategories.some(
        (category) => category.toLowerCase() === listFilter.toLowerCase()
      )
    ) {
      setListFilter('all');
    }
  }, [listFilter, usedCategories]);

  const filteredEntries = useMemo(() => {
    if (!searchMode) return entries;
    const searched = filterHistoryEntries(entries, searchQuery);
    return applyHistoryListFilter(searched, listFilter);
  }, [entries, listFilter, searchMode, searchQuery]);

  const pinnedStandalone = useMemo(
    () => sortPinnedEntries(filteredEntries.filter((entry) => entry.pinned && !entry.collectionId)),
    [filteredEntries]
  );
  const { standalone, groups } = useMemo(
    () =>
      groupHistoryEntries(
        filteredEntries.filter((entry) => !entry.pinned || Boolean(entry.collectionId)),
        collections
      ),
    [collections, filteredEntries]
  );
  const regularStandalone = useMemo(
    () => standalone.filter((entry) => !entry.pinned),
    [standalone]
  );
  const listData = useMemo(
    () => [
      ...(pinnedStandalone.length
        ? [{ type: 'header' as const, id: 'pinned-header', title: 'Núcleos fijados' }]
        : []),
      ...pinnedStandalone.map((entry) => ({ type: 'entry' as const, entry })),
      ...groups.map((group) => ({ type: 'collection' as const, group })),
      ...(regularStandalone.length
        ? [{ type: 'header' as const, id: 'recent-header', title: 'Núcleos recientes' }]
        : []),
      ...regularStandalone.map((entry) => ({ type: 'entry' as const, entry })),
    ],
    [groups, pinnedStandalone, regularStandalone]
  );

  const toggleCollectionExpanded = useCallback((collectionId: string) => {
    setExpandedCollectionIds((current) => ({
      ...current,
      [collectionId]: !current[collectionId],
    }));
  }, []);

  const openCategoryEditor = useCallback((entry: HistoryEntry) => {
    setCategoryEditEntry(entry);
  }, []);

  const handleExportPdf = useCallback(
    (entry: HistoryEntry) => {
      onExportPdf?.(entry.id);
    },
    [onExportPdf]
  );

  const handleExportPdfEntry = useCallback(
    (entry: HistoryEntry) => {
      handleExportPdf(entry);
    },
    [handleExportPdf]
  );

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
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    onRename(renamingId, renameValue);
    setRenamingId(null);
    setRenameValue('');
  }, [onRename, renameValue, renamingId]);

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
    ({ item, index }: { item: (typeof listData)[number]; index: number }) => {
      if (item.type === 'header') {
        const isRecentHeader = item.id === 'recent-header';
        const isPinnedHeader = item.id === 'pinned-header';
        const pinTopPadding =
          isPinnedHeader && searchMode
            ? 'pt-3'
            : isPinnedHeader && showIndex && data && !searchMode
              ? 'pt-8'
              : isPinnedHeader
                ? 'pt-1'
                : 'pt-1';
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

      if (item.type === 'collection') {
        const { collection, members } = item.group;
        return (
          <HistoryCollectionGroup
            collection={collection}
            members={members}
            allEntries={entries}
            activeId={activeId}
            expanded={Boolean(expandedCollectionIds[collection.id])}
            onToggle={() => toggleCollectionExpanded(collection.id)}
            renamingId={renamingId}
            renameValue={renameValue}
            onRenameValueChange={setRenameValue}
            onCommitRename={commitRename}
            onSelect={onSelect}
            onRename={startRename}
            onChangeCategory={openCategoryEditor}
            onTogglePin={(entry) => onTogglePin(entry.id)}
            onDelete={handleDeleteEntry}
            onExportPdf={handleExportPdfEntry}
            openMenuEntryId={openMenuEntryId}
            onMenuOpen={onHistoryMenuOpen}
            onMenuClose={onHistoryMenuClose}
          />
        );
      }

      const entry = item.entry;
      const isActive = entry.id === activeId;

      return (
        <HistoryEntryCard
          entry={entry}
          isActive={isActive}
          isMenuOpen={openMenuEntryId === entry.id}
          isRenaming={renamingId === entry.id}
          renameValue={renameValue}
          onRenameValueChange={setRenameValue}
          onCommitRename={commitRename}
          onSelect={onSelect}
          onRename={startRename}
          onChangeCategory={openCategoryEditor}
          onTogglePin={(item) => onTogglePin(item.id)}
          onDelete={handleDeleteEntry}
          onExportPdf={handleExportPdfEntry}
          menuSessionOpen={openMenuEntryId != null}
          menuInteractionBlocked={openMenuEntryId != null && openMenuEntryId !== entry.id}
          onMenuOpen={() => onHistoryMenuOpen?.(entry.id)}
          onMenuClose={onHistoryMenuClose}
        />
      );
    },
    [
      activeId,
      commitRename,
      entries,
      expandedCollectionIds,
      toggleCollectionExpanded,
      handleDeleteEntry,
      handleExportPdfEntry,
      onHistoryMenuClose,
      onHistoryMenuOpen,
      onSelect,
      onTogglePin,
      openCategoryEditor,
      openMenuEntryId,
      renameValue,
      renamingId,
      searchMode,
      showIndex,
      startRename,
    ]
  );

  const listHeaderComponent = useMemo(() => {
    if (searchMode) {
      return null;
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
    currentStep,
    data,
    indexExpanded,
    isComplete,
    onClose,
    onGoToStep,
    showIndex,
    searchMode,
  ]);

  const listEmptyComponent = useMemo(() => {
    if (searchMode && (searchQuery.trim() || listFilter !== 'all')) {
      return (
        <View className="py-8 px-2">
          <Text className="text-center text-body leading-6">
            Nada por aquí. Prueba con otra categoría.
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
  }, [listFilter, searchMode, searchQuery]);

  const headerSolidHeight = sidebarHeaderSolidHeight(insets.top);
  const listTopInset = sidebarListPaddingTop(insets.top);
  const searchStackHeight = searchStackHeightProp ?? sidebarSearchStackHeight(insets.top);
  const listScrollPaddingTop = searchActive
    ? searchStackHeight + SIDEBAR_SEARCH_FILTER_LIST_GAP
    : listTopInset;
  const listBottomPadding = Math.max(SIDEBAR_OCCLUSION.listBottomMin, listBottomInset);
  const sheetBackground = canvasColor ?? (isDark ? APP_DARK_BACKGROUND : '#f0f0f0');
  const modalBrandHeaderHeight =
    searchActive && !hideBrandHeader ? searchStackHeight : headerSolidHeight;

  const searchFilterNode = useMemo(
    () =>
      searchActive ? (
        <HistoryCategoryFilter
          embeddedInHeader
          activeFilter={listFilter}
          onSelectFilter={setListFilter}
        />
      ) : null,
    [listFilter, searchActive]
  );

  useEffect(() => {
    if (!registerSearchFilters) return;
    registerSearchFilters(searchFilterNode);
    return () => registerSearchFilters(null);
  }, [registerSearchFilters, searchFilterNode]);

  const content = (
    <View
      className={isDark ? 'dark flex-1' : 'flex-1'}
      style={[styles.sheetRoot, { backgroundColor: sheetBackground }]}
    >
      <View style={styles.sheetBody}>
        {/* Plain ScrollView on purpose: the native long-press context menu on
            each card (MenuView) breaks randomly inside virtualized lists
            (FlashList/FlatList) — the interaction attaches to recycled cells.
            History lists are small, so mounting every card is cheap. */}
        <ScrollView
          contentContainerStyle={{
            paddingTop: listScrollPaddingTop,
            paddingBottom: listBottomPadding,
            paddingHorizontal: searchActive ? 12 : 16,
          }}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          scrollEnabled={!openMenuEntryId}
          pointerEvents={openMenuEntryId ? 'none' : 'auto'}
        >
          {listHeaderComponent}
          {listData.length === 0
            ? listEmptyComponent
            : listData.map((item, index) => (
                <React.Fragment
                  key={
                    item.type === 'header'
                      ? item.id
                      : item.type === 'collection'
                        ? item.group.collection.id
                        : item.entry.id
                  }
                >
                  {renderItem({ item, index })}
                </React.Fragment>
              ))}
        </ScrollView>
        {!hideBrandHeader ? (
          <SidebarBrandHeader
            height={modalBrandHeaderHeight}
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
            searchFilters={searchActive ? searchFilterNode : undefined}
          />
        ) : null}
      </View>

      {!searchActive ? (
        <View
          pointerEvents={openMenuEntryId ? 'none' : 'box-none'}
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
      ) : null}

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
