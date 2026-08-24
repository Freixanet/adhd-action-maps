import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { hapticSegment } from '../logic/haptics';
import { useThemeColors } from '../context/ThemeContext';

export type DepthLayer = 'surface' | 'core' | 'depth';

type Props = {
  layer: DepthLayer;
  onChange: (layer: DepthLayer) => void;
};

export default function DepthRings({ layer, onChange }: Props) {
  const colors = useThemeColors();
  const stroke = colors.text.primary;

  const select = (next: DepthLayer) => {
    if (next === layer) return;
    hapticSegment();
    onChange(next);
  };

  return (
    <View style={styles.wrap} accessibilityLabel="Profundidad">
      <Svg viewBox="0 0 200 120" width="100%" height={112} accessibilityElementsHidden>
        <Circle
          cx={100}
          cy={60}
          r={52}
          fill="none"
          stroke={stroke}
          strokeWidth={layer === 'surface' ? 2.4 : 1}
          opacity={layer === 'surface' ? 1 : 0.28}
          onPress={() => select('surface')}
        />
        <Circle
          cx={100}
          cy={60}
          r={34}
          fill="none"
          stroke={stroke}
          strokeWidth={layer === 'core' ? 2.4 : 1}
          opacity={layer === 'core' ? 1 : 0.4}
          onPress={() => select('core')}
        />
        <Circle
          cx={100}
          cy={60}
          r={14}
          fill={layer === 'depth' ? stroke : 'none'}
          stroke={stroke}
          strokeWidth={1.5}
          opacity={layer === 'depth' ? 1 : 0.55}
          onPress={() => select('depth')}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
});
