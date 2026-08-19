import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { getVisualAssetById } from '@shared/editorial/visualLibrary';
import { resolveNucleoCover } from '@shared/homeFeed';
import type { HistoryEntry } from '@shared/history';
import { useThemeColors } from '../context/ThemeContext';
import EditorialIllustrationRenderer from '../editorial/visuals/EditorialIllustrationRenderer';

type NucleoCoverProps = {
  entry: HistoryEntry;
  width: number;
  height: number;
  /**
   * Push the illustration below a top chrome/safe-area bleed (e.g. Dynamic Island)
   * while the wash still fills the full frame.
   */
  contentInsetTop?: number;
  /** Keep the illustration in the upper band so a bottom title/fade can sit on the wash. */
  contentInsetBottom?: number;
  /** Negative lifts the illustration inside the art band. */
  artOffsetY?: number;
  /** Negative shifts the illustration left inside the art band. */
  artOffsetX?: number;
  /** Fraction of the art plane. Default 0.92. */
  artScale?: number;
};

/**
 * Compact decorative cover for Home cards and the Idea central intro.
 * Resolves once per entry identity; VoiceOver skips this leaf (card owns the label).
 */
export default function NucleoCover({
  entry,
  width,
  height,
  contentInsetTop = 0,
  contentInsetBottom = 0,
  artOffsetY = 0,
  artOffsetX = 0,
  artScale = 0.92,
}: NucleoCoverProps) {
  const colors = useThemeColors();
  const resolution = useMemo(() => resolveNucleoCover(entry), [entry]);
  const asset = useMemo(
    () => getVisualAssetById(resolution.assetId),
    [resolution.assetId]
  );

  const artPlane = Math.max(0, height - contentInsetTop - contentInsetBottom);
  const artSize = Math.min(width, artPlane) * artScale;
  const topBand = Math.max(0, height - contentInsetBottom);

  return (
    <View
      style={[
        styles.root,
        {
          width,
          height,
          backgroundColor: colors.background.accentSoft,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.artBand,
          {
            width,
            height: topBand,
            paddingTop: contentInsetTop,
          },
        ]}
      >
        {asset ? (
          <View
            style={[
              styles.art,
              {
                width: artSize,
                height: artSize,
                marginTop: artOffsetY,
                marginLeft: artOffsetX,
              },
            ]}
          >
            <EditorialIllustrationRenderer asset={asset} width={artSize} height={artSize} />
          </View>
        ) : (
          <View
            style={[
              styles.fallbackWash,
              { backgroundColor: colors.background.accentWash },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  artBand: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  art: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackWash: {
    ...StyleSheet.absoluteFillObject,
  },
});
