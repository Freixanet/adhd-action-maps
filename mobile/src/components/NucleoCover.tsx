import React, { useMemo } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { isGeneratedCoverRecord } from '@shared/generatedCover';
import { getVisualAssetById } from '@shared/editorial/visualLibrary';
import { resolveNucleoCover } from '@shared/homeFeed';
import type { HistoryEntry } from '@shared/history';
import { useThemeColors } from '../context/ThemeContext';
import EditorialIllustrationRenderer from '../editorial/visuals/EditorialIllustrationRenderer';

type NucleoCoverProps = {
  entry: HistoryEntry;
  width: number;
  height: number;
  /** Home jump-back photo. When set, replaces catalog and generated covers. */
  photoSource?: ImageSourcePropType;
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
  /** `cover` fills the frame and crops, like Lumen’s `object-cover` kind banner. */
  fit?: 'contain' | 'cover';
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
  photoSource,
  fit = 'contain',
}: NucleoCoverProps) {
  const colors = useThemeColors();
  const resolution = useMemo(() => resolveNucleoCover(entry), [entry]);
  const asset = useMemo(
    () => getVisualAssetById(resolution.assetId),
    [resolution.assetId]
  );
  const generatedCover = isGeneratedCoverRecord(entry.generatedCover) ? entry.generatedCover : null;

  const artPlane = Math.max(0, height - contentInsetTop - contentInsetBottom);
  const cover = fit === 'cover';
  const artSize = (cover ? Math.max(width, artPlane) : Math.min(width, artPlane)) * artScale;
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
          cover ? styles.artBandCover : null,
          {
            width,
            height: topBand,
            paddingTop: contentInsetTop,
          },
        ]}
      >
        {photoSource ? (
          <Image
            source={photoSource}
            resizeMode="cover"
            style={styles.generatedCover}
          />
        ) : generatedCover ? (
          <Image
            source={{ uri: generatedCover.localUri }}
            resizeMode="cover"
            style={styles.generatedCover}
          />
        ) : asset ? (
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
  artBandCover: {
    overflow: 'hidden',
  },
  art: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatedCover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  fallbackWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
