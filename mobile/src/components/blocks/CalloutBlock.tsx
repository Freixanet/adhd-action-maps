import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADII } from '@shared/uiTokens';
import type { SourceReference } from '@shared/contracts';
import GlassSurface from '../GlassSurface';
import { useTheme } from '../../context/ThemeContext';
import BlockReferences from '../BlockReferences';
import BlockEnter from './BlockEnter';
import { typography, shadow, primitive } from '@shared/design-tokens';

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
  if (!Number.isFinite(n)) {
    const [r, g, b] = primitive.color.brand.accentRgb;
    return `rgba(${r},${g},${b},${alpha})`; // design-token-ignore: runtime alpha wash from brand.accentRgb channels
  }
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`; // design-token-ignore: runtime alpha wash from parsed hex channels
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
  const { isDark, colors } = useTheme();
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

  const tint = useMemo(
    () => hexToRgba(toneColor, isDark ? 0.2 : 0.1),
    [toneColor, isDark]
  );
  const border = useMemo(
    () => hexToRgba(toneColor, isDark ? 0.42 : 0.22),
    [toneColor, isDark]
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
    ...shadow.glassCallout,
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
