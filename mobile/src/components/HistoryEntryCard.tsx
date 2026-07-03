import React, { useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FALLBACK_MAP_CATEGORY, getEntrySourceLabel, getIntentLabel } from '@shared/categories';
import { formatRelativeDate, type HistoryEntry } from '../logic/history';
import MapCategoryLabel from './MapCategoryLabel';

export const HISTORY_ENTRY_CARD_HEIGHT = 92;

type HistoryEntryCardProps = {
  entry: HistoryEntry;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onSelect: (id: string) => void;
  onLongPress: (
    entry: HistoryEntry,
    anchor: { x: number; y: number; width: number; height: number }
  ) => void;
};

export default function HistoryEntryCard({
  entry,
  isActive,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onCommitRename,
  onSelect,
  onLongPress,
}: HistoryEntryCardProps) {
  const cardRef = useRef<View>(null);
  const suppressPressRef = useRef(false);
  const category = entry.category || FALLBACK_MAP_CATEGORY;
  const metaParts = [
    getEntrySourceLabel(entry),
    entry.intent ? getIntentLabel(entry.intent) : null,
    formatRelativeDate(entry.updatedAt),
  ].filter(Boolean);

  const handleLongPress = () => {
    suppressPressRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cardRef.current?.measureInWindow((x, y, width, height) => {
      onLongPress(entry, { x, y, width, height });
    });
  };

  return (
    <View
      ref={cardRef}
      collapsable={false}
      className={`mb-2 rounded-2xl px-3 py-3 justify-center ${
        isActive ? 'bg-accent/10' : ''
      }`}
      style={{ height: HISTORY_ENTRY_CARD_HEIGHT }}
    >
      {isRenaming ? (
        <View className="flex-row items-center gap-2">
          <TextInput
            value={renameValue}
            onChangeText={onRenameValueChange}
            autoFocus
            className="flex-1 text-base text-primary border border-neutral-200 border-white/10 rounded-xl px-3 py-2"
            onSubmitEditing={onCommitRename}
          />
          <Pressable onPress={onCommitRename} className="px-3 py-2">
            <Text className="font-semibold text-accent">OK</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            if (suppressPressRef.current) {
              suppressPressRef.current = false;
              return;
            }
            onSelect(entry.id);
          }}
          onLongPress={handleLongPress}
          delayLongPress={420}
          className="flex-1 justify-center"
          accessibilityRole="button"
          accessibilityLabel={entry.title}
        >
          <MapCategoryLabel category={category} />
          <Text
            className="mt-1 text-base font-semibold leading-5 text-primary"
            numberOfLines={2}
          >
            {entry.title}
          </Text>
          <Text className="mt-1.5 text-xs text-secondary" numberOfLines={1}>
            {metaParts.join(' · ')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
