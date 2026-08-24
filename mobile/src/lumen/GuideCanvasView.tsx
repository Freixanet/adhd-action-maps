import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GuideCanvas } from '@shared/lumen/types';
import { useThemeColors } from '../context/ThemeContext';
import { control, radius, space } from '@shared/design-tokens';
import { LumenCard, LumenKicker, LumenTextButton } from './LumenPrimitives';
import { lumenType } from './lumenType';
import { PRESS_HIT_SLOP } from '../hooks/usePressScale';

export default function GuideCanvasView({ doc }: { doc: GuideCanvas }) {
  const colors = useThemeColors();
  const [i, setI] = useState(0);
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const step = doc.steps[i];
  return (
    <View style={styles.stack}>
      <Text style={[styles.hook, { color: colors.text.primary }]} maxFontSizeMultiplier={1.35}>
        {doc.hook}
      </Text>
      <Text style={[styles.body, { color: colors.text.body }]}>{doc.outcome}</Text>
      {step ? (
        <View style={styles.block}>
          <Text style={[styles.hint, { color: colors.text.muted }]}>
            {i + 1} / {doc.steps.length}
          </Text>
          <Text style={[styles.stepTitle, { color: colors.text.primary }]}>{step.title}</Text>
          <Text style={[styles.body, { color: colors.text.body }]}>{step.body}</Text>
          <LumenCard>
            <LumenKicker>Por qué</LumenKicker>
            <Text style={[styles.body, { color: colors.text.primary }]}>{step.why}</Text>
          </LumenCard>
          {step.watchOut ? (
            <Text style={[styles.body, { color: colors.text.secondary }]}>Cuidado: {step.watchOut}</Text>
          ) : null}
          <View style={styles.rowNav}>
            <LumenTextButton
              title="Anterior"
              disabled={i === 0}
              onPress={() => setI((x) => x - 1)}
            />
            <LumenTextButton
              title="Siguiente"
              emphasis
              disabled={i >= doc.steps.length - 1}
              onPress={() => setI((x) => x + 1)}
            />
          </View>
        </View>
      ) : null}
      {doc.checklist.length > 0 ? (
        <View style={styles.block}>
          <LumenKicker>Lista corta</LumenKicker>
          {doc.checklist.map((c, idx) => {
            const on = !!checks[idx];
            return (
              <Pressable
                key={c}
                onPress={() => setChecks((s) => ({ ...s, [idx]: !s[idx] }))}
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
                    <Text
                      style={[
                        styles.body,
                        { color: on ? colors.text.muted : colors.text.primary, flex: 1, minWidth: 0 },
                        on ? styles.strike : null,
                      ]}
                    >
                      {c}
                    </Text>
                  </View>
                </LumenCard>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.section.gap },
  block: { gap: space.section.gapTight },
  hook: { ...lumenType('lumenHook') },
  stepTitle: { ...lumenType('lumenDisplay3xl') },
  body: { ...lumenType('lumenCopy') },
  hint: { ...lumenType('lumenTab') },
  rowNav: { flexDirection: 'row', alignItems: 'center', gap: space.stack.sm },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: space.stack.md },
  box: { width: control.iconSm, height: control.iconSm, borderWidth: 1, flexShrink: 0 },
  strike: { textDecorationLine: 'line-through' },
});
