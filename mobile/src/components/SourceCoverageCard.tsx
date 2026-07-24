import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CircleAlert, Layers } from '../icons';
import { RADII } from '@shared/uiTokens';
import type { Coverage } from '../logic/contracts';
import GlassSurface from './GlassSurface';
import { useTheme } from '../context/ThemeContext';
import { useAppSession } from '../context/AppSessionContext';

type SourceCoverageCardProps = {
  coverage?: Coverage;
  limitations?: string[];
  knowledgeSectionsCount?: number;
  className?: string;
  plain?: boolean;
};

function CoverageContent({
  coverage,
  limitations,
  knowledgeSectionsCount,
  hasCoverage,
  hasLimitations,
  hasSections,
}: {
  coverage?: Coverage;
  limitations: string[];
  knowledgeSectionsCount: number;
  hasCoverage: boolean;
  hasLimitations: boolean;
  hasSections: boolean;
}) {
  return (
    <>
      <Text className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary mb-4">
        Cobertura de la fuente
      </Text>

      {hasSections ? (
        <View className="flex-row items-center gap-2 mb-4 bg-neutral-100/60 dark:bg-white/[0.03] px-3 py-1.5 rounded-full self-start">
          <Layers size={13} color="#8B8FF5" />
          <Text className="text-xs font-semibold text-body">
            Señal estructurada: {knowledgeSectionsCount} secciones
          </Text>
        </View>
      ) : null}

      {coverage?.summary ? (
        <Text className="text-sm leading-relaxed text-body mb-2">{coverage.summary}</Text>
      ) : null}

      {coverage?.notes?.length ? (
        <View className="mt-2 gap-2.5">
          {coverage.notes.slice(0, 3).map((note, index) => (
            <View key={`${note.label}-${index}`} className="flex-row gap-2">
              <CircleAlert
                size={15}
                color={note.tone === 'warning' ? '#d97706' : '#737373'}
                style={{ marginTop: 2.5 }}
              />
              <Text className="flex-1 text-sm leading-relaxed text-body">
                <Text className="font-semibold text-primary text-primary">{note.label}. </Text>
                {note.detail}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {hasLimitations ? (
        <View className="mt-5 pt-4 border-t border-white/10">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
            Límites detectados
          </Text>
          {limitations.slice(0, 3).map((limitation, index) => (
            <View key={`${limitation}-${index}`} className="flex-row gap-2 mt-2">
              <View
                className="mt-2 h-1 w-1 rounded-full bg-neutral-400 dark:bg-base0"
                style={{ opacity: 0.5 }}
              />
              <Text className="flex-1 text-xs leading-5 text-secondary">{limitation}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

export default function SourceCoverageCard({
  coverage,
  limitations = [],
  knowledgeSectionsCount = 0,
  className = 'mt-6',
  plain = false,
}: SourceCoverageCardProps) {
  const { isDark } = useTheme();
  const { isStreamGenerating } = useAppSession();

  const hasCoverage = !!coverage?.summary || !!coverage?.notes?.length;
  const hasLimitations = limitations.length > 0;
  const hasSections = knowledgeSectionsCount > 0;

  if (!hasCoverage && !hasLimitations && !hasSections) {
    return null;
  }

  if (plain) {
    return (
      <View className={`border-t border-white/10 pt-8 mt-8 ${className}`.trim()}>
        <CoverageContent
          coverage={coverage}
          limitations={limitations}
          knowledgeSectionsCount={knowledgeSectionsCount}
          hasCoverage={hasCoverage}
          hasLimitations={hasLimitations}
          hasSections={hasSections}
        />
      </View>
    );
  }

  return (
    <View className={className}>
      <GlassSurface
        liquid
        borderRadius={RADII.md}
        className="rounded-2xl overflow-hidden"
        style={styles.shell}
        overlayClassName={isDark ? 'bg-white/[0.05]' : 'bg-white/45'}
        glassRefreshKey={isStreamGenerating ? 'streaming' : 'ready'}
      >
        <View className="px-5 py-6">
          <CoverageContent
            coverage={coverage}
            limitations={limitations}
            knowledgeSectionsCount={knowledgeSectionsCount}
            hasCoverage={hasCoverage}
            hasLimitations={hasLimitations}
            hasSections={hasSections}
          />
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
