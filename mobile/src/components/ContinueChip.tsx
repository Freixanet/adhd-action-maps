import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Play, X } from 'lucide-react-native';
import GlassSurface from './GlassSurface';
import { normalizeMapData } from '../logic/mapData';
import type { HistoryEntry } from '../logic/history';

function parseMinutesFromSteps(steps: Array<{ time?: string }> | undefined): number | null {
  if (!steps?.length) return null;
  let total = 0;
  let found = false;
  for (const step of steps) {
    const match = String(step.time || '').match(/(\d+)\s*min/i);
    if (match) {
      total += parseInt(match[1] ?? '0', 10);
      found = true;
    }
  }
  return found ? total : null;
}

function remainingMinutes(entry: HistoryEntry): number | null {
  const data = normalizeMapData(entry.session.data);
  if (!data?.steps?.length) return null;
  const currentStep = entry.session.currentStep ?? 0;
  const steps = currentStep > 0 ? data.steps.slice(currentStep) : data.steps;
  return parseMinutesFromSteps(steps);
}

function truncateTitle(title: string, max = 28): string {
  const trimmed = title.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

type ContinueChipProps = {
  entry: HistoryEntry;
  onPress: () => void;
  onDismiss: () => void;
};

export default function ContinueChip({ entry, onPress, onDismiss }: ContinueChipProps) {
  const minutes = remainingMinutes(entry);
  const title = truncateTitle(entry.title);
  const timeSuffix = minutes ? ` · ~${minutes} min` : '';

  return (
    <GlassSurface liquid borderRadius={999} style={styles.shell}>
      <View className="flex-row items-center gap-2 px-3 py-2">
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Continuar ${entry.title}`}
          className="flex-row items-center gap-2 flex-shrink min-w-0"
        >
          <Play size={13} color="#8B8FF5" fill="#8B8FF5" />
          <Text className="text-sm font-semibold text-primary" numberOfLines={1}>
            Continuar · {title}
            {timeSuffix}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ocultar continuar"
          className="p-1 active:opacity-70"
        >
          <X size={14} color="#9CA0AB" />
        </Pressable>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'center',
    maxWidth: '90%',
  },
});
