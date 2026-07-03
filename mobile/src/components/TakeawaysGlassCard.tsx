import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADII } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import { useTheme } from '../context/ThemeContext';
import { useAppSession } from '../context/AppSessionContext';

type TakeawaysGlassCardProps = {
  items: string[];
  title?: string;
  className?: string;
};

/** Para recordar — same liquid glass panel as Fuente detectada. */
export default function TakeawaysGlassCard({
  items,
  title = 'Para recordar',
  className = 'mt-8',
}: TakeawaysGlassCardProps) {
  const { isDark } = useTheme();
  const { isStreamGenerating } = useAppSession();

  if (!items.length) return null;

  return (
    <View className={className}>
      <GlassSurface
        liquid
        borderRadius={RADII.md}
        className="rounded-2xl overflow-hidden"
        style={styles.shell}
        overlayClassName={isDark ? 'bg-white/[0.05]' : 'bg-white/45'}
        glassRefreshKey={isStreamGenerating ? 'streaming' : 'ready'}
      >
        <View className="px-5 py-6">
          <Text className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            {title}
          </Text>
          {items.slice(0, 7).map((item, index) => (
            <View key={`${item}-${index}`} className="flex-row gap-3 mt-4">
              <View className="mt-2 h-1.5 w-1.5 rounded-full bg-accent/100" />
              <Text className="flex-1 text-base leading-6 text-body">{item}</Text>
            </View>
          ))}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: RADII.md,
    overflow: 'hidden',
  },
});
