import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Layers, Bookmark } from '../icons';
import { RADII, ACCENT } from '@shared/uiTokens';
import type { KnowledgeSection } from '../logic/contracts';
import GlassSurface from './GlassSurface';
import { useTheme } from '../context/ThemeContext';
import { useAppSession } from '../context/AppSessionContext';
import { color, type } from '@shared/design-tokens';
import { ReadingText } from '../context/TypographyContext';

type KnowledgeSectionsListProps = {
  sections?: KnowledgeSection[];
  className?: string;
};

export default function KnowledgeSectionsList({
  sections = [],
  className = 'mt-6',
}: KnowledgeSectionsListProps) {
  const { isDark } = useTheme();
  const { isStreamGenerating } = useAppSession();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  if (!sections || sections.length === 0) {
    return null;
  }

  const toggleSection = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

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
          <Text className="text-meta font-bold uppercase text-secondary mb-2">
            Secciones extraídas
          </Text>

          <Text className="text-xs text-secondary font-medium mb-4">
            Bloques de información que Núcleo pudo organizar desde la fuente.
          </Text>

          <View className="flex-row items-center gap-2 mb-4 bg-accent/100/10 bg-accent px-3 py-1.5 rounded-full self-start">
            <Layers size={13} color={ACCENT} />
            <Text className="text-xs font-semibold text-accent">
              {sections.length} {sections.length === 1 ? 'sección' : 'secciones'}
            </Text>
          </View>

          {/* Acordeón de secciones */}
          <View className="gap-3">
            {sections.map((section, index) => {
              const isExpanded = expandedIndex === index;
              return (
                <View
                  key={`${section.title}-${index}`}
                  className="rounded-xl border border-neutral-200/40 dark:border-white/5 bg-neutral-100/30 dark:bg-white/[0.01] overflow-hidden"
                >
                  <Pressable
                    onPress={() => toggleSection(index)}
                    className="flex-row items-center justify-between p-4 active:bg-neutral-100/50 dark:active:bg-white/[0.03]"
                  >
                    <Text className="flex-1 text-sm font-semibold text-primary text-primary leading-5 pr-2">
                      {section.title}
                    </Text>
                    {isExpanded ? (
                      <ChevronUp size={16} color={color.text.muted} />
                    ) : (
                      <ChevronDown size={16} color={color.text.muted} />
                    )}
                  </Pressable>

                  {isExpanded ? (
                    <View className="px-4 pb-4 border-t border-neutral-200/25 dark:border-white/5 pt-3">
                      <ReadingText typeRole="readingBody">
                        {section.summary}
                      </ReadingText>

                      {/* Referencias */}
                      {section.references && section.references.length > 0 ? (
                        <View className="mt-4 pt-3 border-t border-neutral-200/20 dark:border-white/5">
                          <Text className="text-micro font-bold uppercase tracking-wider text-secondary mb-2">
                            Referencias
                          </Text>
                          {section.references.map((ref, rIndex) => (
                            <View
                              key={`${ref.label}-${rIndex}`}
                              className="flex-row gap-2 mt-2 bg-neutral-200/20 dark:bg-white/[0.02] p-2.5 rounded-lg border border-neutral-200/35 dark:border-white/[0.02]"
                            >
                              <Bookmark size={12} color={ACCENT} style={{ marginTop: 2 }} />
                              <View className="flex-1">
                                <Text className="text-xs font-semibold text-body leading-4">
                                  {ref.label}{' '}
                                  {ref.locator ? (
                                    <Text className="font-normal text-secondary">
                                      ({ref.locator})
                                    </Text>
                                  ) : null}
                                </Text>
                                {ref.excerpt ? (
                                  <Text
                                    className="text-xs text-secondary mt-1 italic"
                                    numberOfLines={3}
                                  >
                                    &ldquo;{ref.excerpt.trim()}&rdquo;
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Nota/Límite de exhaustividad */}
          <Text className="text-meta text-secondary mt-5 pt-3 border-t border-white/10 text-center font-medium italic">
            Esto no sustituye la fuente original: organiza la señal que el Núcleo pudo extraer.
          </Text>
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
