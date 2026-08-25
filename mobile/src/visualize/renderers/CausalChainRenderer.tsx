import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CausalChainRenderSpec } from '@shared/visualize';
import { ACCENT, TEXT_BODY, TEXT_PRIMARY, TEXT_SECONDARY } from '@shared/uiTokens';
import { typography, type } from '@shared/design-tokens';

type Props = {
  spec: CausalChainRenderSpec;
};

export default function CausalChainRenderer({ spec }: Props) {
  return (
    <View style={styles.root} accessibilityRole="summary">
      <Text style={styles.title}>{spec.title}</Text>
      {spec.insight ? <Text style={styles.insight}>{spec.insight}</Text> : null}

      <View style={styles.chain}>
        {spec.steps.map((step, index) => {
          const next = spec.steps[index + 1];
          const edge = next
            ? spec.edges.find((e) => e.from === step.id && e.to === next.id) ||
              spec.edges.find((e) => e.from === step.id)
            : undefined;
          return (
            <View key={step.id} style={styles.stepBlock}>
              <View
                style={styles.node}
                accessibilityLabel={`${step.label}. ${step.detail || ''}`}
              >
                <Text style={styles.nodeLabel}>{step.label}</Text>
                {step.detail ? <Text style={styles.nodeDetail}>{step.detail}</Text> : null}
              </View>
              {edge && next ? (
                <View style={styles.edge} accessibilityLabel={`Relación: ${edge.label}`}>
                  <View style={styles.edgeLine} />
                  <Text style={styles.edgeLabel}>{edge.label}</Text>
                  <View style={styles.edgeLine} />
                </View>
              ) : next ? (
                <View style={styles.edgeSpacer} />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
    paddingVertical: 4,
  },
  title: {
    color: TEXT_PRIMARY,
    ...typography('subtitle'),
  },
  insight: {
    color: TEXT_SECONDARY,
    ...typography('callout'),
  },
  chain: {
    gap: 0,
    marginTop: 8,
  },
  stepBlock: {
    gap: 0,
  },
  node: {
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    paddingLeft: 14,
    paddingVertical: 10,
    gap: 4,
  },
  nodeLabel: {
    color: TEXT_PRIMARY,
    ...typography('inputTitle'),
  },
  nodeDetail: {
    color: TEXT_BODY,
    ...typography('body'),
  },
  edge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 14,
  },
  edgeLine: {
    width: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: ACCENT,
    opacity: 0.5,
  },
  edgeLabel: {
    color: ACCENT,
    ...typography('labelSemibold'),
    flexShrink: 1,
  },
  edgeSpacer: {
    height: 12,
  },
});
