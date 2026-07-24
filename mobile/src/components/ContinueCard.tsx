import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Surface } from 'heroui-native';
import { Play, X } from '../icons';
import { ACCENT, RADII } from '@shared/uiTokens';
import type { HistoryEntry } from '../logic/history';

type ContinueCardProps = {
  entry: HistoryEntry;
  onPress: () => void;
  onDismiss: () => void;
};

const ContinueCard = forwardRef<View, ContinueCardProps>(function ContinueCard(
  { entry, onPress, onDismiss },
  ref
) {
  return (
    <View ref={ref} collapsable={false} style={styles.wrap}>
      <Surface
        variant="secondary"
        animation="disable-all"
        className="w-full overflow-hidden"
        style={styles.shell}
      >
        <View className="flex-row items-start justify-between gap-3">
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Continuar ${entry.title}`}
            className="min-w-0 flex-1 active:opacity-80"
          >
            <View className="mb-1.5 flex-row items-center gap-2">
              <Play size={14} color={ACCENT} />
              <Text className="text-[12px] font-bold uppercase tracking-widest text-secondary">
                Continuar
              </Text>
            </View>
            <Text className="text-[17px] font-semibold text-primary" numberOfLines={2}>
              {entry.title}
            </Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Ocultar continuar"
            className="rounded-full p-1.5 active:opacity-70"
          >
            <X size={16} color="#9CA0AB" />
          </Pressable>
        </View>
      </Surface>
    </View>
  );
});

export default ContinueCard;

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  shell: {
    width: '100%',
    borderRadius: RADII.lg,
  },
});
