import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { EditorialVisualAsset } from '@shared/editorial/visualLibrary';
import { getBundledEditorialSvgXml } from './bundledEditorialSvgXml';

type Props = {
  asset: EditorialVisualAsset;
  width: number;
  height?: number;
  /** Override catalog focusViewBox for this paint. */
  focusViewBox?: string;
};

/**
 * Renders a resolved local SVG asset. Knows nothing about Storyset/Streamline.
 * On failure, throws in DEV after logging — never redraws with primitives.
 */
export default function EditorialIllustrationRenderer({
  asset,
  width,
  height,
  focusViewBox,
}: Props) {
  const xml = useMemo(() => {
    const raw = getBundledEditorialSvgXml(asset.localModule);
    if (!raw) {
      const msg = `[editorial] missing local SVG module "${asset.localModule}" for asset ${asset.id}`;
      console.error(msg);
      if (__DEV__) {
        throw new Error(msg);
      }
      return null;
    }
    const vb = focusViewBox ?? asset.focusViewBox;
    let next = raw;
    if (vb) next = next.replace(/viewBox="[^"]*"/, `viewBox="${vb}"`);
    if (/preserveAspectRatio=/.test(next)) {
      next = next.replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="xMidYMid meet"');
    } else {
      next = next.replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid meet"');
    }
    return next;
  }, [asset.focusViewBox, asset.id, asset.localModule, focusViewBox]);

  const h = height ?? width * 0.72;

  if (!xml) {
    return <View style={[styles.missing, { width, height: h }]} accessibilityLabel={asset.accessibilityLabel} />;
  }

  return (
    <View
      style={[styles.wrap, { width, height: h }]}
      accessibilityRole="image"
      accessibilityLabel={asset.accessibilityLabel}
    >
      <SvgXml xml={xml} width={width} height={h} preserveAspectRatio="xMidYMid meet" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    // Safe padded viewBoxes — never clip subject edges.
    overflow: 'visible',
  },
  missing: {
    backgroundColor: 'transparent',
  },
});
