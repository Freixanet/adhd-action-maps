import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CollectionCanvas } from '@shared/lumen/types';
import { useThemeColors } from '../context/ThemeContext';
import { space } from '@shared/design-tokens';
import { LumenCard, LumenPills } from './LumenPrimitives';
import { lumenType } from './lumenType';

export default function CollectionCanvasView({ doc }: { doc: CollectionCanvas }) {
  const colors = useThemeColors();
  const [tag, setTag] = useState('all');
  const [open, setOpen] = useState<string | null>(doc.items[0]?.id ?? null);
  const items = useMemo(
    () => (tag === 'all' ? doc.items : doc.items.filter((it) => it.tags.includes(tag))),
    [doc.items, tag]
  );
  return (
    <View style={styles.stack}>
      <Text style={[styles.hook, { color: colors.text.primary }]} maxFontSizeMultiplier={1.35}>
        {doc.hook}
      </Text>
      <Text style={[styles.body, { color: colors.text.body }]}>{doc.query}</Text>
      <LumenPills
        items={[
          { id: 'all', label: 'Todas' },
          ...doc.filters.map((f) => ({ id: f, label: f })),
        ]}
        value={tag}
        onChange={setTag}
      />
      {items.map((it, i) => {
        const on = open === it.id;
        return (
          <LumenCard
            key={it.id}
            onPress={() => setOpen(on ? null : it.id)}
            accessibilityLabel={it.title}
          >
            <View style={styles.statRow}>
              <Text style={[styles.mono, { color: colors.text.muted }]}>{`0${i + 1}`}</Text>
              <Text style={[styles.title, styles.statLabel, { color: colors.text.primary }]}>
                {it.title}
              </Text>
              <Text style={[styles.hint, styles.statValue, { color: colors.text.muted }]}>{it.meta}</Text>
            </View>
            <Text style={[styles.body, { color: colors.text.body }]}>{it.subtitle}</Text>
            {on ? (
              <Text style={[styles.body, { color: colors.text.primary }]}>{it.why}</Text>
            ) : null}
          </LumenCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.section.gap },
  hook: { ...lumenType('lumenHook') },
  title: { ...lumenType('lumenDisplayXl') },
  body: { ...lumenType('lumenCopy') },
  hint: { ...lumenType('lumenTab') },
  mono: { ...lumenType('lumenTab'), fontVariant: ['tabular-nums'] as const, flexShrink: 0 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.stack.sm },
  statLabel: { flex: 1, minWidth: 0 },
  statValue: { flexShrink: 0 },
});
