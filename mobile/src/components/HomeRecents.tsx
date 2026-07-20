import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FALLBACK_MAP_CATEGORY } from '@shared/categories';
import { formatRelativeDate, type HistoryEntry } from '../logic/history';
import MapCategoryLabel from './MapCategoryLabel';
import HistoryEntrySourceIcon from './HistoryEntrySourceIcon';

type HomeRecentsProps = {
  entries: HistoryEntry[];
  weekCount: number;
  onSelect: (id: string) => void;
};

export default function HomeRecents({ entries, weekCount, onSelect }: HomeRecentsProps) {
  if (entries.length === 0 && weekCount < 2) return null;

  return (
    <View className="w-full mt-8">
      {entries.length > 0 ? (
        <>
          <Text className="mb-3 text-[12px] font-bold uppercase tracking-widest text-secondary">
            Recientes
          </Text>
          <View className="gap-1">
            {entries.map((entry) => {
              const category = entry.category || FALLBACK_MAP_CATEGORY;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelect(entry.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${entry.title}`}
                  className="py-3 active:opacity-70"
                >
                  <MapCategoryLabel category={category} />
                  <Text className="mt-1 text-[16px] font-semibold text-primary" numberOfLines={2}>
                    {entry.title}
                  </Text>
                  <View className="mt-1.5 flex-row items-center gap-1.5 min-w-0">
                    <HistoryEntrySourceIcon entry={entry} color="#9CA0AB" />
                    <Text className="flex-1 text-[13px] text-secondary" numberOfLines={1}>
                      {formatRelativeDate(entry.updatedAt)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {weekCount >= 2 ? (
        <Text className="mt-4 text-[13px] text-secondary">
          {weekCount} Núcleos esta semana
        </Text>
      ) : null}
    </View>
  );
}
