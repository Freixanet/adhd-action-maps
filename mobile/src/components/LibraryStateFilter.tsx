import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LibraryStateFilter as LibraryStateFilterValue } from '@shared/progress';
import { space } from '@shared/design-tokens';
import { useTheme } from '../context/ThemeContext';
import { CheckCircle2 } from '../icons';
import { SidebarOcclusionFade, SIDEBAR_OCCLUSION } from './SidebarGlassHeader';

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
  const { isDark, colors } = useTheme();
  const fadeColor = isDark ? colors.background.canvas : colors.background.surface;

  return (
    <View className="mb-5">
      <Text
        className="px-1 mb-2 text-meta font-bold uppercase tracking-widest text-secondary"
        maxFontSizeMultiplier={1.5}
      >
        Estado
      </Text>
      <View style={styles.chipTrack} collapsable={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chipContent}
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
                <CheckCircle2 size={16} color={colors.action.primary} filled />
              ) : null}
            </Pressable>
          );
        })}
        </ScrollView>
        <SidebarOcclusionFade edge="right" color={fadeColor} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipTrack: {
    marginRight: -space.screen.horizontal,
    overflow: 'visible',
  },
  chipContent: {
    paddingRight: SIDEBAR_OCCLUSION.edgeFade + space.stack.md,
  },
});
