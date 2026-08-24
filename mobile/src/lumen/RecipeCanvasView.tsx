import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecipeCanvas } from '@shared/lumen/types';
import { splitBeats } from '@shared/lumen/text';
import { useThemeColors } from '../context/ThemeContext';
import { space } from '@shared/design-tokens';
import {
  LumenCard,
  LumenIconButton,
  LumenKicker,
  LumenTextButton,
} from './LumenPrimitives';
import { lumenType } from './lumenType';

function scale(n: number, from: number, to: number) {
  if (!n) return 0;
  const v = (n * to) / from;
  if (Number.isInteger(n) && to % from === 0) return v;
  return Math.round(v * 10) / 10;
}

function qty(amount: number, unit: string) {
  if (!amount) return unit ? unit : 'al gusto';
  return unit ? `${amount} ${unit}` : String(amount);
}

export default function RecipeCanvasView({ doc }: { doc: RecipeCanvas }) {
  const colors = useThemeColors();
  const [serv, setServ] = useState(doc.servings);
  const [step, setStep] = useState(0);
  const ings = useMemo(
    () => (doc.ingredients ?? []).map((ing) => ({ ...ing, amount: scale(ing.amount, doc.servings, serv) })),
    [doc.ingredients, doc.servings, serv]
  );
  const current = doc.steps[step];
  return (
    <View style={styles.stack}>
      <View style={styles.block}>
        <Text style={[styles.hook, { color: colors.text.primary }]} maxFontSizeMultiplier={1.35}>
          {doc.hook}
        </Text>
        <Text style={[styles.body, { color: colors.text.body }]}>
          {doc.prepMinutes} min de prep · {doc.cookMinutes} min de horno · {doc.difficulty}
        </Text>
        {doc.yieldNote ? (
          <Text style={[styles.hint, { color: colors.text.secondary }]}>{doc.yieldNote}</Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <View style={styles.ingHead}>
          <LumenKicker style={styles.ingTitle}>Ingredientes</LumenKicker>
          <View style={styles.stepper}>
            <LumenIconButton
              label="−"
              accessibilityLabel="Menos raciones"
              onPress={() => setServ((s) => Math.max(1, s - 1))}
            />
            <Text style={[styles.servCount, { color: colors.text.primary }]}>{serv}</Text>
            <LumenIconButton
              label="+"
              accessibilityLabel="Más raciones"
              onPress={() => setServ((s) => s + 1)}
            />
          </View>
        </View>
        {ings.map((ing) => (
          <View key={ing.item} style={styles.statRow}>
            <View style={styles.statLabel}>
              <Text style={[styles.body, { color: colors.text.primary }]}>{ing.item}</Text>
              {ing.note ? (
                <Text style={[styles.hint, { color: colors.text.secondary }]}>{ing.note}</Text>
              ) : null}
            </View>
            <Text style={[styles.statValue, { color: colors.text.muted }]}>
              {qty(ing.amount, ing.unit)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.block}>
        <LumenKicker>{`Paso ${step + 1} de ${doc.steps.length}`}</LumenKicker>
        {current ? (
          <View style={styles.block}>
            <Text style={[styles.hook, { color: colors.text.primary }]}>{current.title}</Text>
            <Text style={[styles.body, { color: colors.text.body }]}>{current.body}</Text>
            {current.tip ? (
              <LumenCard>
                <Text style={[styles.body, { color: colors.text.primary }]}>{current.tip}</Text>
              </LumenCard>
            ) : null}
          </View>
        ) : null}
        <View style={styles.rowNav}>
          <LumenTextButton
            title="Anterior"
            disabled={step === 0}
            onPress={() => setStep((s) => s - 1)}
          />
          <LumenTextButton
            title="Siguiente"
            emphasis
            disabled={step >= doc.steps.length - 1}
            onPress={() => setStep((s) => s + 1)}
          />
        </View>
      </View>

      {doc.science ? (
        <View style={styles.block}>
          <LumenKicker>Por qué funciona</LumenKicker>
          {splitBeats(doc.science, 5).map((beat, i) => (
            <LumenCard key={i}>
              <Text style={[styles.hint, { color: colors.text.muted }]}>{`0${i + 1}`}</Text>
              <Text style={[styles.body, { color: colors.text.body }]}>{beat}</Text>
            </LumenCard>
          ))}
        </View>
      ) : null}
      {doc.swaps?.length ? (
        <View style={styles.block}>
          <LumenKicker>Si no tienes</LumenKicker>
          {doc.swaps.map((sw) => (
            <LumenCard key={sw.from}>
              <Text style={[styles.body, { color: colors.text.primary }]}>
                {sw.from} → {sw.to}
              </Text>
              <Text style={[styles.body, { color: colors.text.body }]}>{sw.note}</Text>
            </LumenCard>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.section.gap },
  block: { gap: space.section.gapTight },
  hook: { ...lumenType('lumenHook') },
  body: { ...lumenType('lumenCopy') },
  hint: { ...lumenType('lumenTab') },
  ingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.stack.sm,
  },
  ingTitle: { flex: 1, minWidth: 0 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: space.stack.sm,
  },
  servCount: {
    ...lumenType('lumenCopy'),
    minWidth: space.stack.xl,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rowNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.stack.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.stack.md,
  },
  statLabel: { flex: 1, minWidth: 0 },
  statValue: {
    ...lumenType('lumenTab'),
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
});
