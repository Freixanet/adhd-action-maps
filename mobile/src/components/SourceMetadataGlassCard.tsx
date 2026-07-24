import React, { useMemo, useState } from 'react';
import { Image, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import type { SourceMetadata } from '@shared/contracts';
import { TEXT_SECONDARY } from '@shared/uiTokens';
import { isYouTubeUrl } from '@shared/youtube';
import { CirclePlay, FileText, Link2 } from '../icons';

type Props = {
  sourceMetadata?: SourceMetadata | null;
  /** Fallback when the map was generated from a pasted link / YouTube URL. */
  sourceUrl?: string | null;
};

const ICON_SIZE = 14;
const ROW_HEIGHT = 16;

function asHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  const direct = /^https?:\/\//i.test(trimmed) ? trimmed : null;
  const embedded = trimmed.match(/https?:\/\/[^\s<>\]]+/i)?.[0] ?? null;
  const candidate = direct || embedded;
  if (!candidate) return null;
  try {
    // eslint-disable-next-line no-new
    new URL(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function resolveSourceHref(
  sourceMetadata: SourceMetadata,
  sourceUrl?: string | null
): string | null {
  const candidates = [
    sourceUrl,
    sourceMetadata.url,
    sourceMetadata.label,
    ...(sourceMetadata.detected ?? []),
  ];
  for (const candidate of candidates) {
    const href = asHttpUrl(candidate);
    if (href) return href;
  }
  return null;
}

function firstHumanText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed)) continue;
    return trimmed;
  }
  return null;
}

function formatLinkDomain(href: string): string {
  try {
    const host = new URL(href).hostname.replace(/^www\./i, '');
    if (
      host === 'youtu.be' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host.endsWith('.youtube.com')
    ) {
      return 'youtube.com';
    }
    return host || href;
  } catch {
    return href;
  }
}

function googleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

/**
 * Quiet source attribution: favicon + domain only (Perplexity-style).
 * Prefer persisted `sourceMetadata.url` so reopen still works after the model
 * replaces the raw URL label with a human title.
 */
export function SourceMetadataGlassCard({ sourceMetadata, sourceUrl }: Props) {
  const [faviconFailed, setFaviconFailed] = useState(false);

  const href = useMemo(() => {
    if (!sourceMetadata) return null;
    return resolveSourceHref(sourceMetadata, sourceUrl);
  }, [sourceMetadata, sourceUrl]);

  const isYoutube =
    sourceMetadata?.kind === 'youtube' || (href != null && isYouTubeUrl(href));

  const domain = useMemo(() => {
    if (href) return formatLinkDomain(href);
    if (isYoutube) return 'youtube.com';
    return '';
  }, [href, isYoutube]);

  const primary = domain || firstHumanText(sourceMetadata?.label, sourceMetadata?.title) || '';

  const faviconUri = domain ? googleFaviconUrl(domain) : null;
  const showFavicon = Boolean(faviconUri) && !faviconFailed;

  if (!sourceMetadata || !primary) return null;

  const FallbackIcon = isYoutube ? CirclePlay : sourceMetadata.kind === 'link' ? Link2 : FileText;

  const content = (
    <View style={styles.row} pointerEvents="none">
      <View style={styles.iconSlot}>
        {showFavicon ? (
          <Image
            source={{ uri: faviconUri! }}
            style={styles.favicon}
            resizeMode="contain"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <FallbackIcon size={ICON_SIZE} color={TEXT_SECONDARY} strokeWidth={2} />
        )}
      </View>
      <View style={styles.labelSlot}>
        <Text numberOfLines={1} style={styles.label}>
          {primary}
        </Text>
      </View>
    </View>
  );

  if (!href) return content;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir fuente ${primary}`}
      onPress={() => {
        void Linking.openURL(href);
      }}
      hitSlop={12}
      style={styles.pressable}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'flex-start',
    zIndex: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: ROW_HEIGHT,
    gap: 7,
  },
  iconSlot: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favicon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 2.5,
  },
  labelSlot: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    lineHeight: 16,
    ...Platform.select({
      ios: { transform: [{ translateY: -1 }] },
      android: { includeFontPadding: false, textAlignVertical: 'center' as const },
      default: {},
    }),
  },
});

export default SourceMetadataGlassCard;
