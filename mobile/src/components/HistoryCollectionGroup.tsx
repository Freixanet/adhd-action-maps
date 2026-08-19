import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronRight } from '../icons';
import type { Coleccion } from '@shared/collections';
import { formatCollectionProgress, getCollectionProgress } from '@shared/collections';
import { useTheme } from '../context/ThemeContext';
import type { HistoryEntry } from '../logic/history';
import HistoryEntryCard from './HistoryEntryCard';
import { type } from '@shared/design-tokens';

type HistoryCollectionGroupProps = {
  collection: Coleccion;
  members: HistoryEntry[];
  allEntries: HistoryEntry[];
  activeId: string | null;
  expanded: boolean;
  onToggle: () => void;
  renamingId: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onSelect: (id: string) => void;
  onRename: (entry: HistoryEntry) => void;
  onChangeCategory: (entry: HistoryEntry) => void;
  onTogglePin: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onExportPdf: (entry: HistoryEntry) => void;
  openMenuEntryId?: string | null;
  onMenuOpen?: (entryId: string) => void;
  onMenuClose?: () => void;
};

export default function HistoryCollectionGroup({
  collection,
  members,
  allEntries,
  activeId,
  expanded,
  onToggle,
  renamingId,
  renameValue,
  onRenameValueChange,
  onCommitRename,
  onSelect,
  onRename,
  onChangeCategory,
  onTogglePin,
  onDelete,
  onExportPdf,
  openMenuEntryId = null,
  onMenuOpen,
  onMenuClose,
}: HistoryCollectionGroupProps) {
  const { isDark, colors } = useTheme();
  const cardBackground = isDark ? colors.background.canvas : colors.background.surface;
  const progress = getCollectionProgress(collection, allEntries);
  const progressLabel = formatCollectionProgress(progress.completed, progress.total);
  const isGroupActive = members.some((member) => member.id === activeId);

  return (
    <View className="mb-2">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className={`rounded-2xl px-4 py-3 ${isGroupActive ? 'border border-accent/30' : ''}`}
        style={{ backgroundColor: cardBackground }}
      >
        <View className="flex-row items-center gap-3">
          {expanded ? (
            <ChevronDown size={18} color={colors.icon.muted} />
          ) : (
            <ChevronRight size={18} color={colors.icon.muted} />
          )}
          <View className="flex-1">
            <Text className="text-body font-semibold text-body" numberOfLines={2}>
              {collection.title}
            </Text>
            <Text className="mt-1 text-caption text-secondary">{progressLabel}</Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View className="mt-1 pl-3">
          {members.map((entry) => (
            <HistoryEntryCard
              key={entry.id}
              entry={entry}
              isActive={entry.id === activeId}
              isMenuOpen={openMenuEntryId === entry.id}
              isRenaming={renamingId === entry.id}
              renameValue={renameValue}
              onRenameValueChange={onRenameValueChange}
              onCommitRename={onCommitRename}
              onSelect={onSelect}
              onRename={onRename}
              onChangeCategory={onChangeCategory}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
              onExportPdf={onExportPdf}
              menuSessionOpen={openMenuEntryId != null}
              menuInteractionBlocked={openMenuEntryId != null && openMenuEntryId !== entry.id}
              onMenuOpen={() => onMenuOpen?.(entry.id)}
              onMenuClose={onMenuClose}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
