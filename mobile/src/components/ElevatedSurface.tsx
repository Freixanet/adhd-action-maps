import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { elevatedSurface, specular } from '@shared/uiTokens';

type ElevatedSurfaceProps = {
  children: React.ReactNode;
  borderRadius: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Opaque capsule material for result reading blocks. No BlurView / GlassView.
 * Reduce Transparency is a no-op here — the fill is already ≥0.92.
 */
export default function ElevatedSurface({
  children,
  borderRadius,
  style,
}: ElevatedSurfaceProps) {
  return (
    <View
      style={[
        styles.shell,
        {
          borderRadius,
          backgroundColor: elevatedSurface.backgroundColor,
          borderColor: elevatedSurface.borderColor,
        },
        Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null,
        style,
      ]}
    >
      <View pointerEvents="none" style={styles.specular} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: specular,
  },
});
