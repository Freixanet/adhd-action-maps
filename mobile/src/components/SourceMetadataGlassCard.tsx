import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADII } from '@shared/uiTokens';
import type { Coverage, SourceMetadata } from '../logic/contracts';
import GlassSurface from './GlassSurface';
import { useTheme } from '../context/ThemeContext';
import { useAppSession } from '../context/AppSessionContext';

type SourceMetadataGlassCardProps = {
  sourceMetadata: SourceMetadata;
  coverage?: Coverage;
};

/** Fuente detectada — liquid glass panel (same border model as AttachMenu / HistoryEntryGlassMenu). */
export default function SourceMetadataGlassCard({
  sourceMetadata,
}: SourceMetadataGlassCardProps) {
  const { isDark } = useTheme();
  const { isStreamGenerating } = useAppSession();

  return (
    <View className="mt-8">
      <GlassSurface
        liquid
        borderRadius={RADII.md}
        className="rounded-2xl overflow-hidden"
        style={styles.shell}
        overlayClassName={isDark ? 'bg-white/[0.05]' : 'bg-white/45'}
        glassRefreshKey={isStreamGenerating ? 'streaming' : 'ready'}
      >
        <View className="px-5 py-4">
          <Text className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            Fuente
          </Text>
          <Text className="mt-2 text-base font-semibold text-primary" numberOfLines={2}>
            {sourceMetadata.label}
          </Text>
          {sourceMetadata.detected?.length ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {sourceMetadata.detected.map((item, index) => (
                <View
                  key={`${item}-${index}`}
                  className="rounded-full bg-neutral-100 dark:bg-white/[0.05] px-2.5 py-1"
                >
                  <Text className="text-xs text-body">{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: RADII.md,
    overflow: 'hidden',
  },
});
