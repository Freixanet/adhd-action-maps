export const LONG_SOURCE_WORD_THRESHOLD = 15_000;
export const SINGLE_NUCLEO_SYNTHESIS_NOTICE =
  'Fuente sintetizada en un único Núcleo de 9 pasos por decisión del usuario.';

export type Coleccion = {
  id: string;
  title: string;
  nucleoIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CollectionPart = {
  title: string;
  text: string;
};

export type SourceAnalysisResult = {
  shouldProposeSplit: boolean;
  partCount: number;
  parts: CollectionPart[];
  totalWords: number;
  collectionTitle: string;
};

const CHAPTER_LINE =
  /^(?:cap[ií]tulo|chapter|parte|part|section|secci[oó]n)\s+([\dIVXLC]+(?:[.\-]\d+)*)\s*(?:[:\.\-\u2013\u2014]\s*)?(.*)$/i;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function formatCollectionProgress(completed: number, total: number): string {
  return `${completed}/${total} Núcleos`;
}

export function detectChapterParts(text: string): CollectionPart[] {
  const lines = text.split('\n');
  const markers: Array<{ lineIndex: number; title: string }> = [];

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(CHAPTER_LINE);
    if (!match) return;
    const suffix = match[2]?.trim();
    markers.push({
      lineIndex,
      title: suffix || trimmed,
    });
  });

  if (markers.length < 2) return [];

  const parts: CollectionPart[] = [];
  for (let index = 0; index < markers.length; index += 1) {
    const start = markers[index].lineIndex;
    const end = markers[index + 1]?.lineIndex ?? lines.length;
    const chunk = lines.slice(start, end).join('\n').trim();
    if (!chunk) continue;
    parts.push({
      title: markers[index].title,
      text: chunk,
    });
  }

  return parts.length >= 2 ? parts : [];
}

export function splitLongTextIntoParts(
  text: string,
  maxWordsPerPart = 5_000
): CollectionPart[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= LONG_SOURCE_WORD_THRESHOLD) return [];

  const parts: CollectionPart[] = [];
  for (let offset = 0; offset < words.length; offset += maxWordsPerPart) {
    const chunkWords = words.slice(offset, offset + maxWordsPerPart);
    if (!chunkWords.length) continue;
    parts.push({
      title: `Parte ${parts.length + 1}`,
      text: chunkWords.join(' '),
    });
  }

  return parts.length >= 2 ? parts : [];
}

export function analyzeSourceText(text: string, sourceLabel?: string): SourceAnalysisResult {
  const normalized = text.trim();
  const totalWords = countWords(normalized);
  const chapterParts = detectChapterParts(normalized);
  const parts =
    chapterParts.length >= 2 ? chapterParts : splitLongTextIntoParts(normalized);
  const hasDetectableChapters = chapterParts.length >= 2;
  const shouldProposeSplit =
    parts.length >= 2 && (totalWords >= LONG_SOURCE_WORD_THRESHOLD || hasDetectableChapters);

  return {
    shouldProposeSplit,
    partCount: parts.length,
    parts,
    totalWords,
    collectionTitle: sourceLabel?.trim() || parts[0]?.title || 'Colección',
  };
}

export function getCollectionProgress(
  collection: Pick<Coleccion, 'nucleoIds'>,
  entries: Array<{ id: string; session: { isComplete?: boolean } }>
): { completed: number; total: number; label: string } {
  const total = collection.nucleoIds.length;
  let completed = 0;

  for (const nucleoId of collection.nucleoIds) {
    const entry = entries.find((item) => item.id === nucleoId);
    if (entry?.session.isComplete) completed += 1;
  }

  return {
    completed,
    total,
    label: formatCollectionProgress(completed, total),
  };
}

export function groupHistoryEntries<
  T extends { id: string; collectionId?: string; pinned?: boolean; updatedAt: number }
>(entries: T[], collections: Coleccion[]) {
  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]));
  const standalone: T[] = [];
  const byCollection = new Map<string, T[]>();

  for (const entry of entries) {
    if (!entry.collectionId) {
      standalone.push(entry);
      continue;
    }
    const bucket = byCollection.get(entry.collectionId) ?? [];
    bucket.push(entry);
    byCollection.set(entry.collectionId, bucket);
  }

  const groups = [...collectionMap.values()]
    .map((collection) => {
      const members = (byCollection.get(collection.id) ?? []).sort((a, b) => {
        const indexA = collection.nucleoIds.indexOf(a.id);
        const indexB = collection.nucleoIds.indexOf(b.id);
        return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) -
          (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
      });
      return { collection, members };
    })
    .filter((group) => group.members.length > 0)
    .sort((a, b) => b.collection.updatedAt - a.collection.updatedAt);

  return { standalone, groups };
}
