import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GuidedReadingRenderSpec } from '@shared/visualize';
import { SEM_CLAVE, SEM_EJEMPLO, TEXT_BODY, TEXT_PRIMARY, TEXT_SECONDARY } from '@shared/uiTokens';

type Props = {
  spec: GuidedReadingRenderSpec;
};

export default function GuidedReadingRenderer({ spec }: Props) {
  return (
    <View style={styles.root} accessibilityRole="summary">
      <Text style={styles.title}>{spec.title}</Text>
      {spec.insight ? <Text style={styles.insight}>{spec.insight}</Text> : null}

      <View style={styles.nucleus} accessibilityLabel={`Idea central: ${spec.nucleus.label}`}>
        <Text style={styles.kicker}>Idea central</Text>
        <Text style={styles.nucleusLabel}>{spec.nucleus.label}</Text>
        {spec.nucleus.detail ? (
          <Text style={styles.detail}>{spec.nucleus.detail}</Text>
        ) : null}
      </View>

      {spec.ideas.map((idea, index) => (
        <View key={idea.id} style={styles.idea} accessibilityLabel={`Idea ${index + 1}: ${idea.label}`}>
          <Text style={styles.ideaIndex}>{index + 1}</Text>
          <View style={styles.ideaBody}>
            <Text style={styles.ideaLabel}>{idea.label}</Text>
            {idea.detail ? <Text style={styles.detail}>{idea.detail}</Text> : null}
          </View>
        </View>
      ))}

      {spec.example ? (
        <View style={styles.example} accessibilityLabel={`Ejemplo: ${spec.example.label}`}>
          <Text style={styles.exampleKicker}>Ejemplo</Text>
          <Text style={styles.ideaLabel}>{spec.example.label}</Text>
          {spec.example.detail ? <Text style={styles.detail}>{spec.example.detail}</Text> : null}
        </View>
      ) : null}

      {spec.check ? (
        <View style={styles.check} accessibilityLabel={spec.check.prompt}>
          <Text style={styles.checkKicker}>Comprueba</Text>
          <Text style={styles.detail}>{spec.check.prompt}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
    paddingVertical: 4,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  insight: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
  },
  nucleus: {
    gap: 6,
    paddingLeft: 14,
    borderLeftWidth: 3,
    borderLeftColor: SEM_CLAVE,
  },
  kicker: {
    color: SEM_CLAVE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  nucleusLabel: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  detail: {
    color: TEXT_BODY,
    fontSize: 15,
    lineHeight: 21,
  },
  idea: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  ideaIndex: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
    marginTop: 2,
  },
  ideaBody: {
    flex: 1,
    gap: 4,
  },
  ideaLabel: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  example: {
    gap: 6,
    paddingLeft: 14,
    borderLeftWidth: 3,
    borderLeftColor: SEM_EJEMPLO,
  },
  exampleKicker: {
    color: SEM_EJEMPLO,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  check: {
    gap: 6,
    paddingTop: 4,
  },
  checkKicker: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
