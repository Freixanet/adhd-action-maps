import React from 'react';
import { View } from 'react-native';
import { getEntrySourceLabel } from '@shared/categories';
import { resolveEntrySourceIcon } from '../logic/entrySourceIcon';
import type { HistoryEntry } from '../logic/history';
import { TEXT_SECONDARY } from '@shared/uiTokens';
import { color, type } from '@shared/design-tokens';

type HistoryEntrySourceIconProps = {
  entry: HistoryEntry;
  size?: number;
  color?: string;
};

export default function HistoryEntrySourceIcon({
  entry,
  size = 12,
  color = TEXT_SECONDARY,
}: HistoryEntrySourceIconProps) {
  const Icon = resolveEntrySourceIcon(entry);
  const label = getEntrySourceLabel(entry);

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      className="shrink-0"
    >
      <Icon size={size} color={color} strokeWidth={2} />
    </View>
  );
}
