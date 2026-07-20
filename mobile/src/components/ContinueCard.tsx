import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Play, X } from 'lucide-react-native';
import { ACCENT, RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import { resolveContinueProgress } from '@shared/homeFeed';
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
  const { metaLabel, progress } = resolveContinueProgress(entry);

  return (
    <View ref={ref} collapsable={false} style={styles.wrap}>
      <GlassSurface liquid borderRadius={RADII.lg} style={styles.shell}>
        <View className="px-4 pt-4 pb-3.5">
          <View className="flex-row items-start justify-between gap-3">
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Continuar ${entry.title}`}
              className="flex-1 min-w-0 active:opacity-80"
            >
              <View className="flex-row items-center gap-2 mb-1.5">
                <Play size={14} color={ACCENT} fill={ACCENT} />
                <Text className="text-[12px] font-bold uppercase tracking-widest text-secondary">
                  Continuar
                </Text>
              </View>
              <Text className="text-[17px] font-semibold text-primary" numberOfLines={2}>
                {entry.title}
              </Text>
              <Text className="mt-1.5 text-[13px] text-secondary" numberOfLines={1}>
                {metaLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={onDismiss}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Ocultar continuar"
              className="p-1.5 rounded-full active:opacity-70"
            >
              <X size={16} color="#9CA0AB" />
            </Pressable>
          </View>
          <View style={styles.track} className="mt-3.5">
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      </GlassSurface>
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
  },
  track: {
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
});
