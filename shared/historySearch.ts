import type { HistoryEntry } from './history';

export function historyEntrySearchText(entry: HistoryEntry): string {
  const parts: string[] = [entry.title];
  const coreIdea = (entry.session.data as { coreIdea?: string } | undefined)?.coreIdea;
  if (typeof coreIdea === 'string' && coreIdea.trim()) {
    parts.push(coreIdea.trim());
  }
  return parts.join('\n').toLowerCase();
}

export function filterHistoryEntries(entries: HistoryEntry[], query: string): HistoryEntry[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return entries;

  return entries.filter((entry) => {
    const haystack = historyEntrySearchText(entry);
    return tokens.every((token) => haystack.includes(token));
  });
}

export function filterHistoryByCategory(
  entries: HistoryEntry[],
  category: string | null
): HistoryEntry[] {
  if (!category) return entries;
  const key = category.toLowerCase();
  return entries.filter((entry) => entry.category?.toLowerCase() === key);
}

export function filterHistoryByIncomplete(
  entries: HistoryEntry[],
  incompleteOnly: boolean
): HistoryEntry[] {
  if (!incompleteOnly) return entries;
  return entries.filter((entry) => !entry.session.isComplete);
}

/** Single active chip in sidebar search: Todas, Incompletos, or one category. */
export type HistoryListFilter = 'all' | 'incomplete' | string;

export function applyHistoryListFilter(
  entries: HistoryEntry[],
  filter: HistoryListFilter
): HistoryEntry[] {
  if (filter === 'incomplete') return filterHistoryByIncomplete(entries, true);
  if (filter !== 'all') return filterHistoryByCategory(entries, filter);
  return entries;
}
