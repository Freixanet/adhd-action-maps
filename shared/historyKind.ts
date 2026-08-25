export type HistoryEntryKind = 'nucleo' | 'chat';

export type ChatExchange = {
  question: string;
  answer: string;
};

export type ChatHistoryRecord = {
  question: string;
  answer: string;
  modelUsed?: string;
  /** Full thread. Absent means a single question/answer pair. */
  exchanges?: ChatExchange[];
};

export function chatExchanges(chat: ChatHistoryRecord): ChatExchange[] {
  if (Array.isArray(chat.exchanges) && chat.exchanges.length > 0) {
    return chat.exchanges.filter(
      (item) => item.question.trim().length > 0 && item.answer.trim().length > 0
    );
  }
  if (chat.question.trim() && chat.answer.trim()) {
    return [{ question: chat.question, answer: chat.answer }];
  }
  return [];
}

/** Leaf helpers — keep this file free of `history.ts` so Metro cycles cannot leave these undefined. */
export function isChatHistoryEntry(
  entry: { kind?: HistoryEntryKind } | null | undefined
): boolean {
  return entry?.kind === 'chat';
}

export function isNucleoHistoryEntry(
  entry: { kind?: HistoryEntryKind } | null | undefined
): boolean {
  return !isChatHistoryEntry(entry);
}

export function chatHistoryTitle(question: string, modelTitle?: string | null): string {
  const labeled = modelTitle?.trim();
  if (labeled) return labeled.slice(0, 80);
  const q = question.trim().replace(/\s+/g, ' ');
  if (!q) return 'Chat';
  if (q.length <= 48) return q;
  return `${q.slice(0, 47)}…`;
}
