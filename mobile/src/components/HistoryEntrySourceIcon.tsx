import React from 'react';
import { View } from 'react-native';
import {
  File,
  FileText,
  Image as ImageIcon,
  Link2,
  CirclePlay,
  Upload,
  Video,
  type AppIconComponent,
} from '../icons';
import { getEntrySourceLabel } from '@shared/categories';
import type { SourceType } from '@shared/contracts';
import type { HistoryEntry } from '../logic/history';

type SourceVisual = SourceType | 'image' | 'video';

const SOURCE_ICONS: Record<SourceVisual, AppIconComponent> = {
  text: FileText,
  link: Link2,
  youtube: CirclePlay,
  file: Upload,
  pdf: File,
  image: ImageIcon,
  video: Video,
};

function resolveSourceVisual(entry: HistoryEntry): SourceVisual {
  const kind = (entry.session.data as { sourceMetadata?: { kind?: string } } | undefined)
    ?.sourceMetadata?.kind;
  if (kind === 'image') return 'image';
  if (kind === 'video') return 'video';
  return entry.sourceType;
}

type HistoryEntrySourceIconProps = {
  entry: HistoryEntry;
  size?: number;
  color?: string;
};

export default function HistoryEntrySourceIcon({
  entry,
  size = 12,
  color = '#a3a3a3',
}: HistoryEntrySourceIconProps) {
  const visual = resolveSourceVisual(entry);
  const Icon = SOURCE_ICONS[visual] ?? FileText;
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
