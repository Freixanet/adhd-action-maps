import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { LibraryStateFilter as LibraryStateFilterValue } from '@shared/progress';
import { space } from '@shared/design-tokens';
import { stepHaptic } from '../context/AppSessionContext';
import { useThemeColors } from '../context/ThemeContext';
import { CheckCircle2 } from '../icons';

type LibraryStateFilterProps = {
  value: LibraryStateFilterValue;
  counts: Record<LibraryStateFilterValue, number>;
  onChange: (value: LibraryStateFilterValue) => void;
};

const FILTERS: Array<{ value: LibraryStateFilterValue; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'actions', label: 'Acciones' },
  { value: 'to_start', label: 'Por empezar' },
  { value: 'completed', label: 'Completados' },
  { value: 'blocked', label: 'Necesitan contexto' },
];

export default function LibraryStateFilter({
  value,
  counts,
  onChange,
}: LibraryStateFilterProps) {
  const colors = useThemeColors();

  return (
    <View className="mb-5">
      <Text
        className="px-1 mb-2 text-meta font-bold uppercase tracking-widest text-secondary"
        maxFontSizeMultiplier={1.5}
      >
        Estado
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 12 }}
      >
        {FILTERS.map((filter) => {
          const selected = value === filter.value;
          const count = counts[filter.value];
          if (filter.value !== 'all' && count === 0) return null;
          return (
            <Pressable
              key={filter.value}
              onPress={() => {
                if (selected) return;
                stepHaptic();
                onChange(filter.value);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={filter.label}
              className={`mr-2 min-h-11 px-3.5 rounded-full flex-row items-center justify-center active:opacity-80 ${
                selected ? 'bg-accent/20' : 'bg-white/6'
              }`}
              style={selected ? { gap: space.stack.sm } : undefined}
            >
              <Text
                className={`text-label ${
                  selected ? 'font-semibold text-primary' : 'font-medium text-secondary'
                }`}
                maxFontSizeMultiplier={1.5}
              >
                {filter.label}
              </Text>
              {selected ? (
                <CheckCircle2 size={16} color={colors.action.primary} strokeWidth={2} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
