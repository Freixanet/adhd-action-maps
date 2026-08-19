import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type } from '@shared/design-tokens';
import type { HistoryEntry } from '@shared/history';
import { useThemeColors } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import { stepHaptic } from '../logic/stepHaptic';
import { SIDEBAR_EDGE_INSET } from './sidebarLayout';
import NucleoCover from './NucleoCover';

type NucleoOpenCoverProps = {
  entry: HistoryEntry | null;
  title: string;
  subtitle?: string;
  onExplore: () => void;
};

type CoverBox = { width: number; height: number };

function coverSubtitle(title: string, subtitle?: string): string | null {
  const next = subtitle?.trim();
  if (!next) return null;
  if (next.toLocaleLowerCase() === title.trim().toLocaleLowerCase()) return null;
  return next;
}

/** First page when opening a Núcleo: full-bleed placeholder cover + title + CTA. */
export default function NucleoOpenCover({
  entry,
  title,
  subtitle,
  onExplore,
}: NucleoOpenCoverProps) {
  const colors = useThemeColors();
  const { font } = useTypography();
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState<CoverBox | null>(null);
  const line = coverSubtitle(title, subtitle);
  const footerReserve = box ? Math.round(box.height * 0.26) : 0;

  return (
    <View
      style={styles.root}
      accessibilityLabel={`Portada: ${title}`}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width <= 0 || height <= 0) return;
        setBox((prev) =>
          prev && prev.width === Math.round(width) && prev.height === Math.round(height)
            ? prev
            : { width: Math.round(width), height: Math.round(height) }
        );
      }}
    >
      {box && entry ? (
        <View style={styles.coverSlot} pointerEvents="none">
          <NucleoCover
            entry={entry}
            width={box.width}
            height={box.height}
            contentInsetBottom={footerReserve}
            artOffsetY={space.stack.xl}
            artOffsetX={-space.stack.xl}
            artScale={0.88}
          />
        </View>
      ) : (
        <View style={[styles.fallback, { backgroundColor: colors.background.accentSoft }]} />
      )}
      <View
        pointerEvents="box-none"
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, space.stack.md) + space.stack.sm,
            paddingHorizontal: SIDEBAR_EDGE_INSET,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            { color: colors.text.primary, fontFamily: font.family },
          ]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.35}
        >
          {title}
        </Text>
        {line ? (
          <Text
            style={[
              styles.subtitle,
              { color: colors.text.secondary, fontFamily: font.family },
            ]}
            numberOfLines={2}
            maxFontSizeMultiplier={1.35}
          >
            {line}
          </Text>
        ) : null}
        <Pressable
          onPress={() => {
            stepHaptic();
            onExplore();
          }}
          accessibilityRole="button"
          accessibilityLabel="Explorar Núcleo"
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: pressed ? colors.action.ctaPressed : colors.action.cta,
            },
            Platform.OS === 'ios' ? styles.continuous : null,
          ]}
        >
          <Text
            style={[
              styles.ctaLabel,
              { color: colors.text.onAccent, fontFamily: font.family },
            ]}
          >
            Explorar Núcleo
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  coverSlot: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
    gap: space.stack.sm,
  },
  title: {
    fontSize: type.editorialCoverTitle.fontSize,
    lineHeight: type.editorialCoverTitle.lineHeight,
    fontWeight: type.editorialCoverTitle.fontWeight as '700',
    letterSpacing: type.editorialCoverTitle.letterSpacing,
  },
  subtitle: {
    fontSize: type.button.fontSize,
    lineHeight: type.button.lineHeight,
    fontWeight: type.button.fontWeight as '600',
    letterSpacing: type.button.letterSpacing,
  },
  cta: {
    marginTop: space.stack.sm,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.cta,
    paddingHorizontal: space.stack.lg,
    paddingVertical: space.stack.md,
  },
  continuous: {
    borderCurve: 'continuous',
  },
  ctaLabel: {
    fontSize: type.button.fontSize,
    lineHeight: type.button.lineHeight,
    fontWeight: type.button.fontWeight as '600',
    letterSpacing: type.button.letterSpacing,
  },
});
