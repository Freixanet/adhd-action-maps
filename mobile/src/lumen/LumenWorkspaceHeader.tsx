import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SIDEBAR_EDGE_INSET } from '../components/sidebarLayout';
import { READING_PROGRESS_BAR_HEIGHT } from '../components/ReadingProgressBar';
import { useThemeColors } from '../context/ThemeContext';
import { space } from '@shared/design-tokens';
import { lumenType } from './lumenType';

type Props = {
  title: string;
  topInset: number;
};

export default function LumenWorkspaceHeader({ title, topInset }: Props) {
  const colors = useThemeColors();
  return (
    <View style={[styles.bar, { paddingTop: topInset, backgroundColor: colors.background.canvas }]}>
      <View style={styles.row}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.text.primary }]}
          maxFontSizeMultiplier={1.3}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingBottom: space.stack.xs,
  },
  row: {
    minHeight: READING_PROGRESS_BAR_HEIGHT,
    paddingHorizontal: SIDEBAR_EDGE_INSET,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...lumenType('lumenDisplayLg'),
    flex: 1,
  },
});
