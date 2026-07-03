import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

type HistoryCategoryFilterProps = {
  selectedCategory: string | null;
  categories: string[];
  onSelect: (category: string | null) => void;
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
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      className="mr-5 pb-1 active:opacity-70"
    >
      <Text
        className={`text-sm ${
          selected
            ? 'font-semibold text-primary'
            : 'font-medium text-secondary'
        }`}
      >
        {label}
      </Text>
      {selected ? (
        <View className="mt-1.5 h-px bg-base dark:bg-neutral-100" />
      ) : (
        <View className="mt-1.5 h-px bg-transparent" />
      )}
    </Pressable>
  );
}

export default function HistoryCategoryFilter({
  selectedCategory,
  categories,
  onSelect,
}: HistoryCategoryFilterProps) {
  if (categories.length === 0) return null;

  return (
    <View className="px-1 pb-4">
      <Text className="pb-3 text-[11px] font-bold uppercase tracking-widest text-secondary">
        Categorías
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row pr-3">
          <FilterItem
            label="Todas"
            selected={selectedCategory === null}
            onPress={() => onSelect(null)}
          />
          {categories.map((category) => (
            <FilterItem
              key={category}
              label={category}
              selected={selectedCategory === category}
              onPress={() => onSelect(category)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
