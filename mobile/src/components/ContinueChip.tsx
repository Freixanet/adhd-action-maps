import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Play, X } from '../icons';
import GlassSurface from './GlassSurface';
import { buildContinueChipLabel } from '../logic/continueTransition';
import type { HistoryEntry } from '../logic/history';
import { ACCENT, TEXT_SECONDARY } from '@shared/uiTokens';
import { color, type } from '@shared/design-tokens';

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
            <Play size={13} color={ACCENT} fill={ACCENT} />
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
            <X size={14} color={TEXT_SECONDARY} />
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
