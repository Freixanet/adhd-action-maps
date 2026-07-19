import { describe, expect, it } from 'vitest';
import {
  analyzeSourceText,
  detectChapterParts,
  formatCollectionProgress,
  getCollectionProgress,
  groupHistoryEntries,
  LONG_SOURCE_WORD_THRESHOLD,
  splitLongTextIntoParts,
} from './collections';

describe('detectChapterParts', () => {
  it('detects chapter headings and splits text', () => {
    const text = [
      'Capítulo 1: Introducción',
      'Contenido del capítulo uno.',
      'Capítulo 2: Desarrollo',
      'Contenido del capítulo dos.',
    ].join('\n');

    const parts = detectChapterParts(text);
    expect(parts).toHaveLength(2);
    expect(parts[0].title).toBe('Introducción');
    expect(parts[1].title).toBe('Desarrollo');
  });
});

describe('analyzeSourceText', () => {
  it('proposes split above word threshold', () => {
    const words = Array.from({ length: LONG_SOURCE_WORD_THRESHOLD + 100 }, (_, index) => `w${index}`);
    const analysis = analyzeSourceText(words.join(' '), 'Libro largo');

    expect(analysis.shouldProposeSplit).toBe(true);
    expect(analysis.partCount).toBeGreaterThanOrEqual(2);
  });

  it('proposes split for chapter structure even below threshold', () => {
    const text = [
      'Chapter 1: Alpha',
      'Short chapter one content.',
      'Chapter 2: Beta',
      'Short chapter two content.',
    ].join('\n');

    const analysis = analyzeSourceText(text, 'Libro');
    expect(analysis.shouldProposeSplit).toBe(true);
    expect(analysis.partCount).toBe(2);
  });

  it('does not propose split for short unified text', () => {
    const analysis = analyzeSourceText('Texto breve sin capítulos.', 'Nota');
    expect(analysis.shouldProposeSplit).toBe(false);
  });
});

describe('splitLongTextIntoParts', () => {
  it('creates multiple parts for very long text', () => {
    const words = Array.from({ length: LONG_SOURCE_WORD_THRESHOLD + 500 }, (_, index) => `w${index}`);
    const parts = splitLongTextIntoParts(words.join(' '));
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getCollectionProgress', () => {
  it('counts completed nucleos in a collection', () => {
    const collection = {
      id: 'col-1',
      title: 'Colección',
      nucleoIds: ['a', 'b', 'c'],
      createdAt: 1,
      updatedAt: 1,
    };
    const entries = [
      { id: 'a', session: { isComplete: true } },
      { id: 'b', session: { isComplete: false } },
      { id: 'c', session: { isComplete: true } },
    ];

    const progress = getCollectionProgress(collection, entries);
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(3);
    expect(progress.label).toBe(formatCollectionProgress(2, 3));
  });
});

describe('groupHistoryEntries', () => {
  it('groups collection members and keeps standalone entries separate', () => {
    const collections = [
      {
        id: 'col-1',
        title: 'Libro',
        nucleoIds: ['n1', 'n2'],
        createdAt: 10,
        updatedAt: 20,
      },
    ];
    const entries = [
      { id: 'solo', updatedAt: 30 },
      { id: 'n1', collectionId: 'col-1', updatedAt: 25 },
      { id: 'n2', collectionId: 'col-1', updatedAt: 15 },
    ];

    const grouped = groupHistoryEntries(entries, collections);
    expect(grouped.standalone).toHaveLength(1);
    expect(grouped.standalone[0].id).toBe('solo');
    expect(grouped.groups).toHaveLength(1);
    expect(grouped.groups[0].members.map((member) => member.id)).toEqual(['n1', 'n2']);
  });
});
