import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import type { ExplainCanvas, MapNode } from '@shared/lumen/types';
import QuizBlock from '../components/blocks/QuizBlock';
import { useThemeColors } from '../context/ThemeContext';
import { control, space } from '@shared/design-tokens';
import { LumenCard, LumenKicker, LumenPills, LumenTextButton } from './LumenPrimitives';
import { lumenType } from './lumenType';
import DepthRings from './DepthRings';
import { PRESS_HIT_SLOP } from '../hooks/usePressScale';

type Tab = 'esencia' | 'recorrido' | 'mapa' | 'conceptos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'esencia', label: 'Esencia' },
  { id: 'recorrido', label: 'Recorrido' },
  { id: 'mapa', label: 'Mapa' },
  { id: 'conceptos', label: 'Conceptos' },
];

export default function ExplainCanvasView({
  doc,
  onTabChange,
}: {
  doc: ExplainCanvas;
  onTabChange?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('esencia');
  const colors = useThemeColors();
  const goTab = (id: Tab) => {
    setTab(id);
    onTabChange?.();
  };
  return (
    <View style={styles.stack}>
      <Text
        style={[lumenType('lumenReadTime'), { color: colors.text.secondary }]}
        maxFontSizeMultiplier={1.3}
      >
        {`${doc.readMinutes} min de lectura`}
      </Text>
      <Text style={[styles.hook, { color: colors.text.primary }]} maxFontSizeMultiplier={1.35}>
        {doc.hook}
      </Text>
      <Text style={[styles.essence, { color: colors.text.body }]} maxFontSizeMultiplier={1.35}>
        {doc.essence}
      </Text>
      <View style={styles.tabs}>
        <LumenPills items={TABS} value={tab} onChange={goTab} equal />
      </View>
      {tab === 'esencia' ? <Essence doc={doc} /> : null}
      {tab === 'recorrido' ? <Walk doc={doc} /> : null}
      {tab === 'mapa' ? <MapView doc={doc} /> : null}
      {tab === 'conceptos' ? <Concepts doc={doc} /> : null}
    </View>
  );
}

function Essence({ doc }: { doc: ExplainCanvas }) {
  const colors = useThemeColors();
  const [layer, setLayer] = useState<'surface' | 'core' | 'depth'>('core');
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={styles.stack}>
      {doc.insights.map((ins, i) => {
        const expanded = open === i;
        return (
          <LumenCard
            key={ins.title}
            onPress={() => setOpen(expanded ? null : i)}
            accessibilityLabel={ins.title}
          >
            <View style={styles.insightHead}>
              <View style={styles.monoSlot}>
                <Text style={[styles.mono, { color: colors.text.muted }]}>{`0${i + 1}`}</Text>
              </View>
              <Text style={[styles.insightTitle, { color: colors.text.primary }]} maxFontSizeMultiplier={1.3}>
                {ins.title}
              </Text>
            </View>
            <Text style={[styles.body, { color: colors.text.body }]} maxFontSizeMultiplier={1.35}>
              {ins.body}
            </Text>
            {expanded ? (
              <Text style={[styles.body, { color: colors.text.secondary }]} maxFontSizeMultiplier={1.35}>
                {ins.analogy}
              </Text>
            ) : (
              <Text style={[styles.hint, { color: colors.text.muted }]}>Toca para la analogía</Text>
            )}
          </LumenCard>
        );
      })}
      <Text
        style={[styles.sectionTitle, lumenType('lumenSectionTitle'), { color: colors.text.secondary }]}
        maxFontSizeMultiplier={1.3}
      >
        Profundidad
      </Text>
      <DepthRings layer={layer} onChange={setLayer} />
      <LumenPills
        equal
        scale="depth"
        items={[
          { id: 'surface', label: 'Superficie' },
          { id: 'core', label: 'Núcleo' },
          { id: 'depth', label: 'Fondo' },
        ]}
        value={layer}
        onChange={setLayer}
      />
      <Text style={[styles.body, { color: colors.text.body }]} maxFontSizeMultiplier={1.35}>
        {doc.layers[layer]}
      </Text>
    </View>
  );
}

function Walk({ doc }: { doc: ExplainCanvas }) {
  const colors = useThemeColors();
  const [i, setI] = useState(0);
  const beat = doc.walk[i];
  if (!beat) return null;
  return (
    <View style={styles.stack}>
      <View style={styles.dots}>
        {doc.walk.map((_, idx) => (
          <Pressable
            key={idx}
            onPress={() => setI(idx)}
            hitSlop={PRESS_HIT_SLOP}
            accessibilityLabel={`Paso ${idx + 1}`}
            style={[styles.dotHit, { minHeight: control.touchMin }]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: idx <= i ? colors.text.primary : colors.border.default },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <LumenKicker>{beat.kicker}</LumenKicker>
      <Text style={[styles.hook, { color: colors.text.primary }]} maxFontSizeMultiplier={1.35}>
        {beat.title}
      </Text>
      <Text style={[styles.body, { color: colors.text.body }]} maxFontSizeMultiplier={1.35}>
        {beat.body}
      </Text>
      <LumenCard>
        <LumenKicker>Por qué importa</LumenKicker>
        <Text style={[styles.body, { color: colors.text.primary }]}>{beat.why}</Text>
      </LumenCard>
      <View style={styles.rowNav}>
        <LumenTextButton
          title="Anterior"
          disabled={i === 0}
          onPress={() => setI(i - 1)}
        />
        <Text style={[styles.hint, styles.pagerCount, { color: colors.text.muted }]}>
          {i + 1} / {doc.walk.length}
        </Text>
        <LumenTextButton
          title="Siguiente"
          emphasis
          disabled={i === doc.walk.length - 1}
          onPress={() => setI(i + 1)}
        />
      </View>
    </View>
  );
}

function layout(nodes: MapNode[]) {
  const core = nodes.find((n) => n.kind === 'core') ?? nodes[0];
  const rest = nodes.filter((n) => n.id !== core?.id);
  const cx = 160;
  const cy = 150;
  const R = 92;
  const placed = rest.map((n, i) => {
    const a = -Math.PI / 2 + (i / Math.max(rest.length, 1)) * Math.PI * 2;
    return { ...n, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  return { core: core ? { ...core, x: cx, y: cy } : null, rest: placed };
}

function MapView({ doc }: { doc: ExplainCanvas }) {
  const colors = useThemeColors();
  const [sel, setSel] = useState(doc.map.nodes[0]?.id ?? '');
  const node = doc.map.nodes.find((n) => n.id === sel);
  const { core, rest } = useMemo(() => layout(doc.map.nodes), [doc.map.nodes]);
  const all = useMemo(() => (core ? [core, ...rest] : rest), [core, rest]);
  const pos = useMemo(() => Object.fromEntries(all.map((n) => [n.id, n])), [all]);
  const neighbors = useMemo(() => {
    const out: { id: string; label: string; via: string }[] = [];
    for (const e of doc.map.edges) {
      if (e.from === sel) {
        const t = doc.map.nodes.find((n) => n.id === e.to);
        if (t) out.push({ id: t.id, label: t.label, via: e.label });
      } else if (e.to === sel) {
        const t = doc.map.nodes.find((n) => n.id === e.from);
        if (t) out.push({ id: t.id, label: t.label, via: e.label });
      }
    }
    return out;
  }, [doc.map.edges, doc.map.nodes, sel]);

  return (
    <View style={styles.stack}>
      <Svg viewBox="0 0 320 300" width="100%" height={220} accessibilityLabel="Mapa del concepto">
        {doc.map.edges.map((e) => {
          const a = pos[e.from];
          const b = pos[e.to];
          if (!a || !b) return null;
          const hot = e.from === sel || e.to === sel;
          return (
            <Line
              key={`${e.from}-${e.to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={colors.text.primary}
              strokeWidth={hot ? 1.4 : 0.8}
              opacity={hot ? 0.7 : 0.22}
            />
          );
        })}
        {all.map((n) => {
          const on = n.id === sel;
          const near = neighbors.some((x) => x.id === n.id);
          const r = n.kind === 'core' ? 9 : 6;
          return (
            <React.Fragment key={n.id}>
              <Circle
                cx={n.x}
                cy={n.y}
                r={22}
                fill="transparent"
                onPress={() => setSel(n.id)}
              />
              <Circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={on ? colors.text.primary : 'none'}
                stroke={colors.text.primary}
                strokeWidth={on || near ? 1.8 : 1}
                opacity={on ? 1 : near ? 0.85 : 0.4}
                onPress={() => setSel(n.id)}
              />
              <SvgText
                x={n.x}
                y={n.y + r + 16}
                fill={colors.text.primary}
                fontSize={10}
                textAnchor="middle"
                opacity={on ? 1 : 0.55}
                onPress={() => setSel(n.id)}
              >
                {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      {node ? (
        <LumenCard>
          <LumenKicker>
            {node.kind === 'core' ? 'núcleo' : node.kind === 'idea' ? 'idea' : 'detalle'}
          </LumenKicker>
          <Text style={[styles.nodeTitle, { color: colors.text.primary }]}>{node.label}</Text>
          <Text style={[styles.body, { color: colors.text.body }]}>{node.blurb}</Text>
        </LumenCard>
      ) : null}
    </View>
  );
}

function Concepts({ doc }: { doc: ExplainCanvas }) {
  const colors = useThemeColors();
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [q, setQ] = useState(0);
  const item = doc.quiz[q];
  return (
    <View style={styles.stack}>
      {doc.cards.map((c, i) => {
        const on = !!flipped[i];
        return (
          <LumenCard
            key={c.term}
            onPress={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
            accessibilityLabel={c.term}
          >
            {on ? (
              <>
                <Text style={[styles.body, { color: colors.text.primary }]}>{c.meaning}</Text>
                <Text style={[styles.body, { color: colors.text.secondary }]}>{c.analogy}</Text>
              </>
            ) : (
              <>
                <LumenKicker>Concepto</LumenKicker>
                <Text style={[styles.hook, { color: colors.text.primary }]}>{c.term}</Text>
              </>
            )}
          </LumenCard>
        );
      })}
      {item ? (
        <View style={styles.stack}>
          <LumenKicker>¿Lo tienes?</LumenKicker>
          <QuizBlock
            key={item.question}
            block={{
              type: 'quiz',
              question: item.question,
              options: item.options.filter((opt) => opt && opt !== '—'),
              correct: item.answer,
              feedback: item.why,
            }}
            questionStyle={styles.hook}
          />
          {q < doc.quiz.length - 1 ? (
            <LumenTextButton
              title="Siguiente pregunta"
              emphasis
              onPress={() => setQ((x) => x + 1)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: space.section.gapTight,
  },
  tabs: {
    marginTop: space.stack.xl,
  },
  sectionTitle: {
    marginTop: space.stack.xl + space.stack.md,
  },
  hook: {
    ...lumenType('lumenHook'),
  },
  essence: {
    ...lumenType('lumenLead'),
  },
  body: {
    ...lumenType('lumenCopy'),
  },
  insightHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.stack.sm,
  },
  insightTitle: {
    ...lumenType('lumenDisplayLg'),
    flex: 1,
    minWidth: 0,
    includeFontPadding: false,
  },
  nodeTitle: {
    ...lumenType('lumenDisplayXl'),
  },
  monoSlot: {
    height: lumenType('lumenDisplayLg').lineHeight,
    justifyContent: 'center',
    paddingTop: space.stack.xs,
  },
  mono: {
    ...lumenType('lumenTab'),
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  hint: {
    ...lumenType('lumenTab'),
  },
  dots: {
    flexDirection: 'row',
    gap: space.stack.xs,
  },
  dotHit: {
    flex: 1,
    justifyContent: 'center',
  },
  dot: {
    height: 4,
    borderRadius: 999,
  },
  rowNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.stack.sm,
  },
  pagerCount: {
    flexShrink: 0,
  },
});
