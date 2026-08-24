import { useEffect, useRef } from 'react';
import { needsGeneratedCover, type GeneratedCoverRecord } from '@shared/generatedCover';
import type { HistoryEntry } from '@shared/history';
import { ensureNucleoCovers } from '../logic/ensureNucleoCover';

export function useEnsureNucleoCovers(
  entries: readonly HistoryEntry[],
  onReady: (id: string, cover: GeneratedCoverRecord) => void
): void {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const pendingKey = entries
    .filter(needsGeneratedCover)
    .map((entry) => entry.id)
    .sort()
    .join('|');

  useEffect(() => {
    if (!pendingKey) return;
    const pending = entries.filter(needsGeneratedCover);
    void ensureNucleoCovers(pending, (id, cover) => {
      onReadyRef.current(id, cover);
    });
  }, [pendingKey, entries]);
}
