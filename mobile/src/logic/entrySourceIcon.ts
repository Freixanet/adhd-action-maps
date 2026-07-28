import {
  BookOpen,
  Briefcase,
  File,
  FileText,
  Image as ImageIcon,
  Layers,
  Link2,
  CirclePlay,
  MessageSquareText,
  Upload,
  Video,
  type AppIconComponent,
} from '../icons';
import type { SourceContentKind, SourceType } from '@shared/contracts';
import { inferLegacySourceContentKind } from '@shared/sourceContentKind';
import type { HistoryEntry } from './history';

/**
 * Visual bucket for history / continue icons. Semantic kinds take precedence;
 * the file format is only a neutral fallback when classification is absent.
 */
export type SourceVisual =
  | SourceType
  | 'image'
  | 'video'
  | SourceContentKind;

const SOURCE_ICONS: Record<SourceVisual, AppIconComponent> = {
  text: FileText,
  link: Link2,
  youtube: CirclePlay,
  file: Upload,
  pdf: File,
  image: ImageIcon,
  video: Video,
  book: BookOpen,
  article: FileText,
  report: Briefcase,
  paper: File,
  manual: Layers,
  notes: FileText,
  slides: Layers,
  transcript: MessageSquareText,
  other: FileText,
};

type SourceMeta = {
  kind?: string;
  contentKind?: SourceContentKind;
};

function readSourceMeta(entry: HistoryEntry): SourceMeta {
  return (
    (entry.session.data as { sourceMetadata?: SourceMeta } | undefined)?.sourceMetadata ?? {}
  );
}

/**
 * Resolve from semantic identity. A PDF/EPUB/DOCX does not imply a book, and
 * collection membership does not imply any content kind.
 */
export function resolveSourceVisual(entry: HistoryEntry): SourceVisual {
  const meta = readSourceMeta(entry);
  const kind = meta.kind?.toLowerCase();
  const contentKind =
    meta.contentKind ?? inferLegacySourceContentKind(entry.session.data);
  if (contentKind) return contentKind;

  if (kind === 'image') return 'image';
  if (kind === 'video') return 'video';
  if (kind === 'pdf' || kind === 'epub' || kind === 'docx') return 'pdf';

  return entry.sourceType;
}

export function resolveEntrySourceIcon(entry: HistoryEntry): AppIconComponent {
  return SOURCE_ICONS[resolveSourceVisual(entry)] ?? FileText;
}
