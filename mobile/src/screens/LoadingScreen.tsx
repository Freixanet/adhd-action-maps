import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingState from '../components/LoadingState';
import SessionErrorBanner from '../components/SessionErrorBanner';
import { useThemeColors } from '../context/ThemeContext';

/**
 * Full-bleed loading host. Safe area is applied inside LoadingState for
 * content only — the Border Beam frame uses the real screen edges.
 */
export default function LoadingScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <View style={[styles.root, { backgroundColor: colors.background.canvas }]}>
      <LoadingState />
      <View pointerEvents="box-none" style={styles.bannerLayer}>
        <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
          <SessionErrorBanner />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bannerLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  banner: {
    paddingHorizontal: 16,
  },
});
