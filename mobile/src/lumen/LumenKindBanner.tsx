import React, { useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { CanvasKind } from '@shared/lumen/types';
import { useThemeColors } from '../context/ThemeContext';
import { control } from '@shared/design-tokens';
import { LUMEN_KIND_ART } from './lumenKindArt';

type Props = {
  kind: CanvasKind;
};

export default function LumenKindBanner({ kind }: Props) {
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const height = control.lumenBanner;
  const side = Math.max(width, height);
  return (
    <View
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== width) setWidth(next);
      }}
      style={[
        styles.frame,
        { height, backgroundColor: colors.background.accentSoft },
      ]}
    >
      <Image
        source={LUMEN_KIND_ART[kind]}
        resizeMode="cover"
        style={{ width: side, height: side }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
