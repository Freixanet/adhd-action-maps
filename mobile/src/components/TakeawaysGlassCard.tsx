import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADII } from '@shared/uiTokens';
import ElevatedSurface from './ElevatedSurface';
import { ReadingText } from '../context/TypographyContext';

type TakeawaysGlassCardProps = {
  items: string[];
  title?: string;
  className?: string;
  plain?: boolean;
};

function TakeawaysContent({ items, title }: { items: string[]; title: string }) {
  return (
    <>
      <Text className="text-meta font-bold uppercase text-secondary">
        {title}
      </Text>
      {items.slice(0, 7).map((item, index) => (
        <View key={`${item}-${index}`} className="flex-row gap-3 mt-4">
          <View className="mt-2 h-1.5 w-1.5 rounded-full bg-accent/100" />
          <ReadingText className="flex-1" typeRole="readingBody">{item}</ReadingText>
        </View>
      ))}
    </>
  );
}

/** Para recordar — elevated solid; glass is reserved for StatBlock. */
export default function TakeawaysGlassCard({
  items,
  title = 'Para recordar',
  className = 'mt-8',
  plain = false,
}: TakeawaysGlassCardProps) {
  if (!items.length) return null;

  if (plain) {
    return (
      <View className={`border-t border-white/10 pt-8 mt-8 ${className}`.trim()}>
        <TakeawaysContent items={items} title={title} />
      </View>
    );
  }

  return (
    <View className={className}>
      <ElevatedSurface borderRadius={RADII.md} style={styles.shell}>
        <View className="px-5 py-6">
          <TakeawaysContent items={items} title={title} />
        </View>
      </ElevatedSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: RADII.md,
    overflow: 'hidden',
  },
});
