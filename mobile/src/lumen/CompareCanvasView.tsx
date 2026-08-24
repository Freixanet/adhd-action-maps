import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CompareCanvas } from '@shared/lumen/types';
import { useThemeColors } from '../context/ThemeContext';
import { radius, space } from '@shared/design-tokens';
import { LumenCard, LumenKicker, LumenPills } from './LumenPrimitives';
import { lumenType } from './lumenType';

export default function CompareCanvasView({ doc }: { doc: CompareCanvas }) {
  const colors = useThemeColors();
  const [focus, setFocus] = useState<string>('all');
  const rows = doc.scores.filter((row) => focus === 'all' || row.criterionId === focus);
  return (
    <View style={styles.stack}>
      <Text style={[styles.hook, { color: colors.text.primary }]} maxFontSizeMultiplier={1.35}>
        {doc.hook}
      </Text>
      {doc.items.map((it) => (
        <LumenCard key={it.id}>
          <LumenKicker>{it.id === doc.winnerId ? 'El encaje' : 'Alternativa'}</LumenKicker>
          <Text style={[styles.hook, { color: colors.text.primary }]}>{it.name}</Text>
          <Text style={[styles.body, { color: colors.text.body }]}>{it.tagline}</Text>
          {it.stats.map((s) => (
            <View key={s.label} style={styles.statRow}>
              <Text style={[styles.hint, styles.statLabel, { color: colors.text.secondary }]}>{s.label}</Text>
              <Text style={[styles.body, styles.statValue, { color: colors.text.primary }]}>{s.value}</Text>
            </View>
          ))}
        </LumenCard>
      ))}
      <LumenKicker>Criterios</LumenKicker>
      <LumenPills
        items={[
          { id: 'all', label: 'Todos' },
          ...doc.criteria.map((c) => ({ id: c.id, label: c.label })),
        ]}
        value={focus}
        onChange={setFocus}
      />
      {rows.map((row) => {
        const crit = doc.criteria.find((c) => c.id === row.criterionId);
        return (
          <LumenCard key={row.criterionId}>
            <Text style={[styles.label, { color: colors.text.primary }]}>{crit?.label}</Text>
            <Text style={[styles.hint, { color: colors.text.secondary }]}>{crit?.hint}</Text>
            {row.values.map((v) => {
              const item = doc.items.find((i) => i.id === v.itemId);
              const width = `${(Math.min(5, Math.max(0, v.score)) / 5) * 100}%` as const;
              return (
                <View key={v.itemId} style={styles.scoreBlock}>
                  <View style={styles.statRow}>
                    <Text style={[styles.body, styles.statLabel, { color: colors.text.primary }]}>{item?.name}</Text>
                    <Text style={[styles.hint, styles.statValue, { color: colors.text.muted }]}>{v.score}/5</Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: colors.border.default }]}>
                    <View
                      style={[
                        styles.fill,
                        { width, backgroundColor: colors.text.primary, borderRadius: radius.pill },
                      ]}
                    />
                  </View>
                  <Text style={[styles.body, { color: colors.text.body }]}>{v.note}</Text>
                </View>
              );
            })}
          </LumenCard>
        );
      })}
      {doc.verdict ? (
        <Text style={[styles.verdict, { color: colors.text.primary }]}>{doc.verdict}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.section.gap },
  hook: { ...lumenType('lumenHook') },
  verdict: { ...lumenType('lumenDisplayXl') },
  label: { ...lumenType('lumenLabel') },
  body: { ...lumenType('lumenCopy') },
  hint: { ...lumenType('lumenTab') },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.stack.sm,
  },
  statLabel: { flex: 1, minWidth: 0 },
  statValue: { flexShrink: 0 },
  scoreBlock: { gap: space.stack.sm, marginTop: space.stack.sm },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4 },
});
