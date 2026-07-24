import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  compileVisualizationRun,
  FIXTURE_CAUSAL_KNOWLEDGE,
  FIXTURE_CAUSAL_TASKS,
  FIXTURE_FLAT_KNOWLEDGE,
  FIXTURE_FLAT_TASKS,
  type PersistedVisualizationRun,
} from '@shared/visualize';
import { ACCENT, TEXT_BODY, TEXT_PRIMARY, TEXT_SECONDARY } from '@shared/uiTokens';
import VisualizeRunHost from './VisualizeRunHost';

const CASES = [
  { id: 'causal', label: 'Causal chain', knowledge: FIXTURE_CAUSAL_KNOWLEDGE, tasks: FIXTURE_CAUSAL_TASKS },
  { id: 'flat', label: 'Guided reading', knowledge: FIXTURE_FLAT_KNOWLEDGE, tasks: FIXTURE_FLAT_TASKS },
] as const;

/**
 * DEV-only gallery: review slice renderers from frozen fixtures without regenerating.
 */
export default function VisualizeFixtureGallery() {
  const [active, setActive] = useState<(typeof CASES)[number]['id']>('causal');

  const run: PersistedVisualizationRun | null = useMemo(() => {
    const fixture = CASES.find((c) => c.id === active)!;
    return compileVisualizationRun({
      knowledge: fixture.knowledge,
      tasks: fixture.tasks,
      runId: `gallery-${fixture.id}`,
    }).persisted;
  }, [active]);

  if (!__DEV__) return null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      <Text style={styles.heading}>Visualize fixtures</Text>
      <Text style={styles.sub}>Sin LLM — solo RenderSpec congelado vía pipeline puro</Text>
      <View style={styles.tabs}>
        {CASES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setActive(c.id)}
            style={[styles.tab, active === c.id && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, active === c.id && styles.tabLabelActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {run ? (
        <>
          <Text style={styles.meta}>
            {run.selection.strategy} · {run.selection.reason} · {run.status}
          </Text>
          <VisualizeRunHost run={run} />
        </>
      ) : (
        <Text style={styles.sub}>Sin run (fallback v1)</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
    paddingBottom: 48,
  },
  heading: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '700',
  },
  sub: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: {
    backgroundColor: 'rgba(139,143,245,0.22)',
  },
  tabLabel: {
    color: TEXT_BODY,
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: ACCENT,
  },
  meta: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: 4,
  },
});
