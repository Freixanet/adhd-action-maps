import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
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
  coverage,
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
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
              Señal extraída
            </Text>
            <Text className="text-sm font-semibold text-primary text-primary">
              {sourceMetadata.label}
            </Text>
          </View>
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
          {coverage?.summary ? (
            <Text className="mt-3 text-sm leading-relaxed text-body">
              {coverage.summary}
            </Text>
          ) : null}
          {coverage?.notes?.length ? (
            <View className="mt-3 gap-2">
              {coverage.notes.slice(0, 3).map((note, index) => (
                <View key={`${note.label}-${index}`} className="flex-row gap-2">
                  <CircleAlert
                    size={16}
                    color={note.tone === 'warning' ? '#d97706' : '#a3a3a3'}
                    style={{ marginTop: 2 }}
                  />
                  <Text className="flex-1 text-sm leading-relaxed text-body">
                    <Text className="font-semibold text-primary text-primary">
                      {note.label}.{' '}
                    </Text>
                    {note.detail}
                  </Text>
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
