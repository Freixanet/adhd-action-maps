import React from 'react';
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { DEFAULT_MAP_CATEGORIES } from '@shared/categories';
import type { HistoryListFilter } from '@shared/historySearch';
import { stepHaptic } from '../context/AppSessionContext';

type HistoryCategoryFilterProps = {
  activeFilter: HistoryListFilter;
  onSelectFilter: (filter: HistoryListFilter) => void;
  embeddedInHeader?: boolean;
};

function FilterItem({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      className={`mr-2 h-8 px-3.5 rounded-full flex-row items-center active:opacity-80 ${
        selected ? 'bg-accent/20 border border-accent/40' : 'bg-white/6'
      }`}
    >
      <Text
        className={`text-[13px] ${
          selected ? 'font-semibold text-primary' : 'font-medium text-secondary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HistoryCategoryFilter({
  activeFilter,
  onSelectFilter,
  embeddedInHeader = false,
}: HistoryCategoryFilterProps) {
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const selectFilter = (filter: HistoryListFilter) => {
    dismissKeyboard();
    stepHaptic();
    onSelectFilter(filter);
  };

  const handleSelectCategory = (category: string) => {
    selectFilter(activeFilter === category ? 'all' : category);
  };

  const handleSelectIncomplete = () => {
    selectFilter(activeFilter === 'incomplete' ? 'all' : 'incomplete');
  };

  const handleSelectAll = () => {
    if (activeFilter === 'all') return;
    selectFilter('all');
  };

  return (
    <View className={embeddedInHeader ? undefined : 'px-1 pb-4'}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <View className="flex-row pr-3">
          <FilterItem label="Todas" selected={activeFilter === 'all'} onPress={handleSelectAll} />
          <FilterItem
            label="Incompletos"
            selected={activeFilter === 'incomplete'}
            onPress={handleSelectIncomplete}
          />
          {DEFAULT_MAP_CATEGORIES.map((category) => (
            <FilterItem
              key={category}
              label={category}
              selected={activeFilter === category}
              onPress={() => handleSelectCategory(category)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
