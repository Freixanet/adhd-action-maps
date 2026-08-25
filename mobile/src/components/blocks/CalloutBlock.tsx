import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADII } from '@shared/uiTokens';
import type { SourceReference } from '@shared/contracts';
import ElevatedSurface from '../ElevatedSurface';
import { useTheme } from '../../context/ThemeContext';
import BlockReferences from '../BlockReferences';
import BlockEnter from './BlockEnter';
import { contentEnterStagger } from '../../motion/contentEnter';
import { typography } from '@shared/design-tokens';

export type CalloutTone = 'clave' | 'matiz' | 'ejemplo' | 'alerta';

const TONE_LABEL: Record<CalloutTone, string> = {
  clave: 'Idea clave',
  matiz: 'Matiz',
  ejemplo: 'Ejemplo',
  alerta: 'Precaución',
};

const KIND_TO_TONE: Record<string, CalloutTone> = {
  clave: 'clave',
  matiz: 'matiz',
  ejemplo: 'ejemplo',
  alerta: 'alerta',
  info: 'clave',
  action: 'ejemplo',
  alert: 'alerta',
};

export function resolveCalloutTone(kind?: string, label?: string): CalloutTone {
  const k = String(kind || '').toLowerCase();
  if (KIND_TO_TONE[k]) return KIND_TO_TONE[k]!;
  const l = String(label || '').toLowerCase();
  if (l.includes('matiz')) return 'matiz';
  if (l.includes('ejemplo') || l.includes('aplicarlo') || l.includes('siguiente')) return 'ejemplo';
  if (l.includes('precauci') || l.includes('límite') || l.includes('limite') || l.includes('alerta')) {
    return 'alerta';
  }
  if (l.includes('clave') || l.includes('idea')) return 'clave';
  return 'clave';
}

type CalloutBlockProps = {
  label?: string;
  text: string;
  kind?: string;
  references?: SourceReference[];
  index?: number;
};

/**
 * Tone-labeled highlight card. Elevated solid — glass is reserved for StatBlock.
 */
export default function CalloutBlock({
  label,
  text,
  kind,
  references,
  index = 0,
}: CalloutBlockProps) {
  const { colors } = useTheme();
  const tone = resolveCalloutTone(kind, label);
  const toneColor =
    tone === 'clave'
      ? colors.text.accent
      : tone === 'matiz'
        ? colors.text.warning
        : tone === 'ejemplo'
          ? colors.text.success
          : colors.text.danger;
  const title = (label && label.trim()) || TONE_LABEL[tone];

  return (
    <BlockEnter delayMs={contentEnterStagger(index)}>
      <View style={styles.wrap}>
        <ElevatedSurface borderRadius={RADII.sm} style={styles.surface}>
          <View style={styles.content}>
            <Text
              style={[styles.title, { color: toneColor }]}
              maxFontSizeMultiplier={1.35}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {text.trim() ? (
              <Text
                style={[styles.body, { color: colors.text.body }]}
                maxFontSizeMultiplier={1.35}
              >
                {text}
              </Text>
            ) : null}
            <BlockReferences references={references} />
          </View>
        </ElevatedSurface>
      </View>
    </BlockEnter>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 14,
  },
  surface: {
    borderRadius: RADII.sm,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    ...typography('labelSemiboldTrack'),
    marginBottom: 6,
  },
  body: {
    ...typography('title'),
    opacity: 0.92,
  },
});
