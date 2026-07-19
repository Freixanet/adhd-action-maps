import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Play, X } from 'lucide-react-native';
import GlassSurface from './GlassSurface';
import { buildContinueChipLabel } from '../logic/continueTransition';
import type { HistoryEntry } from '../logic/history';

export function getContinueChipLabel(entry: HistoryEntry): string {
  return buildContinueChipLabel(entry.title);
}

type ContinueChipProps = {
  entry: HistoryEntry;
  onPress: () => void;
  onDismiss: () => void;
};

const ContinueChip = forwardRef<View, ContinueChipProps>(function ContinueChip(
  { entry, onPress, onDismiss },
  ref
) {
  const label = getContinueChipLabel(entry);

  return (
    <View ref={ref} collapsable={false}>
      <GlassSurface liquid borderRadius={999} style={styles.shell}>
        <View className="flex-row items-center gap-2 px-3 py-2">
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Continuar ${entry.title}`}
            className="flex-row items-center gap-2 flex-shrink min-w-0"
          >
            <Play size={13} color="#8B8FF5" fill="#8B8FF5" />
            <Text className="text-sm font-semibold text-primary" numberOfLines={1}>
              {label}
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
    </View>
  );
});

export default ContinueChip;

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'center',
    maxWidth: '90%',
  },
});
