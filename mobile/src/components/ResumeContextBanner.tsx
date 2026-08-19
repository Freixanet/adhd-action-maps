import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from '../icons';
import { useAppSession } from '../context/AppSessionContext';
import { useTheme } from '../context/ThemeContext';
import { RADII } from '@shared/uiTokens';
import { color, primitive } from '@shared/design-tokens';

export default function ResumeContextBanner() {
  const session = useAppSession();
  const { isDark } = useTheme();
  const summary = session.resumeSummary;

  if (!summary || !session.resumeBannerVisible) return null;

  const closeColor = isDark ? primitive.color.neutral['300'] : primitive.color.neutral['600'];

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark
            ? color.background.accentSofter
            : color.background.accentFade10,
          borderColor: isDark
            ? color.background.accentFade24
            : color.background.accentAltFade18,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${summary.objective}. ${summary.untilNow} ${summary.point} ${summary.remaining}`}
    >
      <View style={styles.header}>
        <Text
          className="text-meta font-bold uppercase tracking-widest text-accent"
          maxFontSizeMultiplier={1.5}
        >
          Retomas aquí
        </Text>
        <Pressable
          onPress={session.dismissResumeBanner}
          accessibilityRole="button"
          accessibilityLabel="Ocultar punto de reanudación"
          hitSlop={8}
          style={styles.close}
        >
          <X size={16} color={closeColor} />
        </Pressable>
      </View>
      <Text
        className="mt-1 text-body font-semibold leading-5 text-primary"
        maxFontSizeMultiplier={1.6}
        numberOfLines={2}
      >
        {summary.objective}
      </Text>
      <Text
        className="mt-1 text-label leading-5 text-body"
        maxFontSizeMultiplier={1.6}
        numberOfLines={3}
      >
        {summary.untilNow} {summary.point}
      </Text>
      <Text
        className="mt-1 text-caption leading-5 text-secondary"
        maxFontSizeMultiplier={1.6}
        numberOfLines={2}
      >
        {summary.remaining}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  header: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  close: {
    width: 44,
    height: 44,
    marginTop: -8,
    marginRight: -10,
    marginBottom: -8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.lg,
  },
});
