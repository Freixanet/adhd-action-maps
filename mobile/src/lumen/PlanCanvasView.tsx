import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlanCanvas } from '@shared/lumen/types';
import { useThemeColors } from '../context/ThemeContext';
import { control, radius, space } from '@shared/design-tokens';
import { LumenCard, LumenKicker } from './LumenPrimitives';
import { lumenType } from './lumenType';
import { PRESS_HIT_SLOP } from '../hooks/usePressScale';

export default function PlanCanvasView({ doc }: { doc: PlanCanvas }) {
  const colors = useThemeColors();
  const [done, setDone] = useState<Record<string, boolean>>({});
  return (
    <View style={styles.stack}>
      <Text style={[styles.hook, { color: colors.text.primary }]} maxFontSizeMultiplier={1.35}>
        {doc.hook}
      </Text>
      <Text style={[styles.body, { color: colors.text.body }]}>
        {doc.occasion} · {doc.timeframe}
      </Text>
      {doc.phases.map((ph, i) => (
        <View key={ph.title} style={styles.stack}>
          <LumenKicker>{`0${i + 1} · ${ph.when}`}</LumenKicker>
          <Text style={[styles.hook, { color: colors.text.primary }]}>{ph.title}</Text>
          {ph.tasks.map((t) => {
            const on = !!done[t.id];
            return (
              <Pressable
                key={t.id}
                onPress={() => setDone((d) => ({ ...d, [t.id]: !d[t.id] }))}
                hitSlop={PRESS_HIT_SLOP}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={{ minHeight: control.touchMin }}
              >
                <LumenCard>
                  <View style={styles.taskRow}>
                    <View
                      style={[
                        styles.box,
                        {
                          borderColor: on ? colors.action.primary : colors.border.strong,
                          backgroundColor: on ? colors.action.primary : 'transparent',
                          borderRadius: radius.hairline,
                        },
                      ]}
                    />
                    <View style={styles.taskCopy}>
                      <Text
                        style={[
                          styles.body,
                          { color: on ? colors.text.muted : colors.text.primary },
                          on ? styles.strike : null,
                        ]}
                      >
                        {t.title}
                      </Text>
                      <Text style={[styles.hint, { color: colors.text.secondary }]}>{t.detail}</Text>
                    </View>
                  </View>
                </LumenCard>
              </Pressable>
            );
          })}
        </View>
      ))}
      {doc.options.length > 0 ? (
        <View style={styles.stack}>
          <LumenKicker>Elige un pico</LumenKicker>
          {doc.options.map((o) => (
            <LumenCard key={o.title}>
              <Text style={[styles.title, { color: colors.text.primary }]}>{o.title}</Text>
              <Text style={[styles.body, { color: colors.text.body }]}>{o.body}</Text>
              <Text style={[styles.hint, { color: colors.text.muted }]}>{o.fit}</Text>
            </LumenCard>
          ))}
        </View>
      ) : null}
      {doc.budget.length > 0 ? (
        <View style={styles.stack}>
          <LumenKicker>Presupuesto</LumenKicker>
          {doc.budget.map((b) => (
            <View key={b.label} style={styles.statRow}>
              <Text style={[styles.body, styles.statLabel, { color: colors.text.body }]}>{b.label}</Text>
              <Text style={[styles.body, styles.statValue, { color: colors.text.primary }]}>{b.amount}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {doc.risks.length > 0 ? (
        <View style={styles.stack}>
          <LumenKicker>Si se tuerce</LumenKicker>
          {doc.risks.map((r) => (
            <LumenCard key={r.risk}>
              <Text style={[styles.body, { color: colors.text.primary }]}>{r.risk}</Text>
              <Text style={[styles.body, { color: colors.text.body }]}>{r.ifHappens}</Text>
            </LumenCard>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.section.gap },
  hook: { ...lumenType('lumenHook') },
  title: { ...lumenType('lumenDisplayLg') },
  body: { ...lumenType('lumenCopy') },
  hint: { ...lumenType('lumenTab') },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.stack.md },
  taskCopy: { flex: 1, minWidth: 0 },
  box: { width: control.iconSm, height: control.iconSm, borderWidth: 1, marginTop: space.stack.xs, flexShrink: 0 },
  strike: { textDecorationLine: 'line-through' },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.stack.md,
  },
  statLabel: { flex: 1, minWidth: 0 },
  statValue: { flexShrink: 0 },
});
