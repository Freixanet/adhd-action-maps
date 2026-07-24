import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  RADII,
  SEM_ALERTA,
  SEM_CLAVE,
  SEM_EJEMPLO,
  SEM_MATIZ,
  TEXT_BODY,
  TEXT_PRIMARY,
} from '@shared/uiTokens';
import type { SourceReference } from '@shared/contracts';
import GlassSurface from '../GlassSurface';
import { useTheme } from '../../context/ThemeContext';
import BlockEnter from './BlockEnter';

export type CalloutTone = 'clave' | 'matiz' | 'ejemplo' | 'alerta';

const TONE_COLOR: Record<CalloutTone, string> = {
  clave: SEM_CLAVE,
  matiz: SEM_MATIZ,
  ejemplo: SEM_EJEMPLO,
  alerta: SEM_ALERTA,
};

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

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = Number.parseInt(normalized, 16);
  if (!Number.isFinite(n)) return `rgba(139,143,245,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

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

function CalloutReferences({ references }: { references?: SourceReference[] }) {
  if (!references?.length) return null;
  return (
    <View style={styles.refs}>
      {references.slice(0, 3).map((reference, idx) => (
        <View key={`${reference.label}-${reference.locator}-${idx}`} style={styles.refChip}>
          <Text style={styles.refText} maxFontSizeMultiplier={1.3}>
            <Text style={styles.refLabel}>{reference.label} </Text>
            {reference.locator}
          </Text>
        </View>
      ))}
    </View>
  );
}

type CalloutBlockProps = {
  label?: string;
  text: string;
  kind?: string;
  references?: SourceReference[];
  index?: number;
};

/**
 * Glass-sonner–inspired highlight card for Nucleo callouts.
 * Tinted liquid glass + tone label; no vertical side bar.
 */
export default function CalloutBlock({
  label,
  text,
  kind,
  references,
  index = 0,
}: CalloutBlockProps) {
  const { isDark } = useTheme();
  const tone = resolveCalloutTone(kind, label);
  const color = TONE_COLOR[tone];
  const title = (label && label.trim()) || TONE_LABEL[tone];

  const tint = useMemo(
    () => hexToRgba(color, isDark ? 0.2 : 0.14),
    [color, isDark]
  );
  const border = useMemo(
    () => hexToRgba(color, isDark ? 0.42 : 0.35),
    [color, isDark]
  );

  return (
    <BlockEnter delayMs={index * 60}>
      <View style={styles.wrap}>
        <GlassSurface
          liquid
          borderRadius={RADII.sm}
          liquidBorder="perimeter"
          tintColor={tint}
          style={[styles.glass, { borderColor: border }]}
          contentClassName="px-4 py-3.5"
        >
          <Text
            style={[styles.title, { color }]}
            maxFontSizeMultiplier={1.35}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {text.trim() ? (
            <Text style={styles.body} maxFontSizeMultiplier={1.35}>
              {text}
            </Text>
          ) : null}
          <CalloutReferences references={references} />
        </GlassSurface>
      </View>
    </BlockEnter>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 14,
  },
  glass: {
    borderRadius: RADII.sm,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    // Soft depth like glass-sonner (no left rail).
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: TEXT_BODY,
    opacity: 0.78,
  },
  refs: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  refChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  refText: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_BODY,
  },
  refLabel: {
    color: 'rgba(156,160,171,1)',
  },
});
