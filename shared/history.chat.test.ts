import { describe, expect, it } from 'vitest';
import { appendChatExchange, createChatEntry, type HistoryStore } from './history';
import { chatExchanges } from './historyKind';

function emptyStore(): HistoryStore {
  return { activeId: null, entries: [], collections: [] };
}

describe('chat history thread', () => {
  it('stores the first exchange and appends follow-ups without renaming', () => {
    const first = createChatEntry(emptyStore(), {
      question: 'Qué es Troya?',
      answer: 'Una ciudad de la Edad del Bronce.',
      title: 'Qué es Troya?',
    });
    const chatId = first.entries[0]?.id;
    expect(chatId).toBeTruthy();
    expect(first.entries[0]?.title).toBe('Qué es Troya?');
    expect(chatExchanges(first.entries[0]!.chat!)).toHaveLength(1);

    const next = appendChatExchange(first, chatId!, {
      question: '¿Y Schliemann?',
      answer: 'Excavó Hisarlik en 1870.',
    });
    expect(next.entries[0]?.title).toBe('Qué es Troya?');
    const exchanges = chatExchanges(next.entries[0]!.chat!);
    expect(exchanges).toHaveLength(2);
    expect(exchanges[1]).toEqual({
      question: '¿Y Schliemann?',
      answer: 'Excavó Hisarlik en 1870.',
    });
    expect(next.entries[0]?.chat?.answer).toBe('Excavó Hisarlik en 1870.');
  });
});
