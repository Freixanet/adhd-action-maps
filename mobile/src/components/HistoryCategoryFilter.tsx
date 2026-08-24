import React from 'react';
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import type { HistoryListFilter } from '@shared/historySearch';
import { getHistoryFilterIcon } from '../logic/categoryIcons';
import { useTheme } from '../context/ThemeContext';
import { ACCENT, TEXT_SECONDARY } from '@shared/uiTokens';
import { color, type } from '@shared/design-tokens';

type HistoryCategoryFilterProps = {
  activeFilter: HistoryListFilter;
  onSelectFilter: (filter: HistoryListFilter) => void;
  /** Only categories present in the current history. */
  categories: readonly string[];
  showIncomplete?: boolean;
  embeddedInHeader?: boolean;
};

function FilterItem({
  label,
  filter,
  selected,
  onPress,
}: {
  label: string;
  filter: HistoryListFilter;
  selected: boolean;
  onPress: () => void;
}) {
  const { isDark } = useTheme();
  const Icon = getHistoryFilterIcon(filter);
  const iconColor = selected ? ACCENT : isDark ? TEXT_SECONDARY : color.text.muted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      className={`mr-2 h-8 px-3 rounded-full flex-row items-center gap-1.5 active:opacity-80 ${
        selected ? 'bg-accent/20' : 'bg-white/6'
      }`}
    >
      <Icon size={14} color={iconColor} strokeWidth={2} />
      <Text
        className={`text-label ${
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
  categories,
  showIncomplete = true,
  embeddedInHeader = false,
}: HistoryCategoryFilterProps) {
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const selectFilter = (filter: HistoryListFilter) => {
    dismissKeyboard();
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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <View className="flex-row pr-3">
          <FilterItem
            label="Todas"
            filter="all"
            selected={activeFilter === 'all'}
            onPress={handleSelectAll}
          />
          {showIncomplete ? (
            <FilterItem
              label="Incompletos"
              filter="incomplete"
              selected={activeFilter === 'incomplete'}
              onPress={handleSelectIncomplete}
            />
          ) : null}
          {categories.map((category) => (
            <FilterItem
              key={category}
              label={category}
              filter={category}
              selected={activeFilter === category}
              onPress={() => handleSelectCategory(category)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
