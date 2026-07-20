import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  ArrowRight,
  GitCompareArrows,
  Network,
  RefreshCw,
} from 'lucide-react-native';
import {
  ACCENT,
  BG_SURFACE_2,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@shared/uiTokens';
import type { NucleoVisual, NucleoVisualKind } from '../logic/contracts';
import { stepHaptic } from '../context/AppSessionContext';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';

type NucleoVisualOverviewProps = {
  visual: NucleoVisual;
};

const KIND_LABEL: Record<NucleoVisualKind, string> = {
  flow: 'Flujo',
  cycle: 'Ciclo',
  comparison: 'Comparación',
  hierarchy: 'Jerarquía',
};

function VisualKindIcon({ kind }: { kind: NucleoVisualKind }) {
  if (kind === 'cycle') return <RefreshCw size={15} color={ACCENT} />;
  if (kind === 'comparison') return <GitCompareArrows size={15} color={ACCENT} />;
  if (kind === 'hierarchy') return <Network size={15} color={ACCENT} />;
  return <ArrowRight size={15} color={ACCENT} />;
}

export default function NucleoVisualOverview({ visual }: NucleoVisualOverviewProps) {
  const { reduceMotion } = useGlassAccessibility();
  const [selectedId, setSelectedId] = useState(visual.items[0]?.id ?? '');

  useEffect(() => {
    setSelectedId(visual.items[0]?.id ?? '');
  }, [visual]);

  const selected = useMemo(
    () => visual.items.find((item) => item.id === selectedId) ?? visual.items[0],
    [selectedId, visual.items]
  );

  const selectItem = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    stepHaptic();
  };

  return (
    <View style={styles.root} accessibilityRole="summary">
      <View style={styles.kindRow}>
        <VisualKindIcon kind={visual.kind} />
        <Text style={styles.kindLabel}>{KIND_LABEL[visual.kind]}</Text>
      </View>

      {visual.kind === 'hierarchy' ? (
        <View style={styles.hierarchyStem}>
          <View style={styles.hierarchyCore} />
          <View style={styles.hierarchyVerticalLine} />
        </View>
      ) : null}

      <View style={styles.route}>
        {visual.kind !== 'comparison' ? <View style={styles.connectorLine} /> : null}
        {visual.items.map((item, index) => {
          const isSelected = item.id === selected?.id;
          return (
            <Pressable
              key={`${item.id}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}. ${item.detail}`}
              accessibilityState={{ selected: isSelected }}
              hitSlop={6}
              onPress={() => selectItem(item.id)}
              style={({ pressed }) => [styles.node, pressed && styles.nodePressed]}
            >
              <View style={[styles.nodeDot, isSelected && styles.nodeDotSelected]}>
                <Text style={[styles.nodeIndex, isSelected && styles.nodeIndexSelected]}>
                  {index + 1}
                </Text>
              </View>
              <Text
                numberOfLines={2}
                style={[styles.nodeLabel, isSelected && styles.nodeLabelSelected]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected ? (
        <Animated.View
          key={selected.id}
          entering={FadeIn.duration(reduceMotion ? 0 : 180)}
          exiting={FadeOut.duration(reduceMotion ? 0 : 120)}
          style={styles.detail}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.detailLabel}>{selected.label}</Text>
          <Text numberOfLines={4} style={styles.detailText}>
            {selected.detail}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    marginTop: 22,
    marginBottom: 18,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 18,
  },
  kindLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  hierarchyStem: {
    height: 28,
    alignItems: 'center',
  },
  hierarchyCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ACCENT,
  },
  hierarchyVerticalLine: {
    width: 1,
    flex: 1,
    backgroundColor: 'rgba(139, 143, 245, 0.42)',
  },
  route: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    top: 17,
    height: 1,
    backgroundColor: 'rgba(139, 143, 245, 0.36)',
  },
  node: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  nodePressed: {
    opacity: 0.72,
  },
  nodeDot: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SURFACE_2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  nodeDotSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  nodeIndex: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
  },
  nodeIndexSelected: {
    color: '#181A1F',
  },
  nodeLabel: {
    marginTop: 9,
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    textAlign: 'center',
  },
  nodeLabelSelected: {
    color: TEXT_PRIMARY,
  },
  detail: {
    minHeight: 88,
    marginTop: 18,
    paddingLeft: 15,
    paddingVertical: 4,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
    justifyContent: 'center',
  },
  detailLabel: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 5,
  },
  detailText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 21,
  },
});
