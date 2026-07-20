import { describe, expect, it } from 'vitest';
import {
  countNucleosThisWeek,
  resolveContinueProgress,
  selectHomeRecents,
} from './homeFeed.ts';
import type { HistoryEntry } from './history.ts';

function entry(partial: Partial<HistoryEntry> & Pick<HistoryEntry, 'id' | 'title'>): HistoryEntry {
  return {
    createdAt: 1,
    updatedAt: partial.updatedAt ?? 1,
    sourceType: 'text',
    session: {
      data: {
        title: partial.title,
        steps: [
          { id: '1', title: 'A', body: '', time: '2 min' },
          { id: '2', title: 'B', body: '', time: '3 min' },
          { id: '3', title: 'C', body: '', time: '1 min' },
        ],
      } as HistoryEntry['session']['data'],
      currentStep: 2,
      isComplete: false,
      ...(partial.session ?? {}),
    },
    ...partial,
  } as HistoryEntry;
}

describe('homeFeed', () => {
  it('builds Continuar progress meta', () => {
    const progress = resolveContinueProgress(entry({ id: 'a', title: 'Hábitos' }));
    expect(progress.pasoActual).toBe(2);
    expect(progress.totalPasos).toBe(3);
    expect(progress.metaLabel).toContain('Paso 2 de 3');
    expect(progress.metaLabel).toContain('min restantes');
  });

  it('selects up to 3 recents excluding continue id', () => {
    const entries = [
      entry({ id: '1', title: 'A', updatedAt: 30 }),
      entry({ id: '2', title: 'B', updatedAt: 20 }),
      entry({ id: '3', title: 'C', updatedAt: 10 }),
      entry({ id: '4', title: 'D', updatedAt: 5 }),
    ];
    const recents = selectHomeRecents(entries, '1', 3);
    expect(recents.map((item) => item.id)).toEqual(['2', '3', '4']);
  });

  it('counts nucleos from the last week', () => {
    const now = Date.now();
    const entries = [
      entry({ id: '1', title: 'A', updatedAt: now }),
      entry({ id: '2', title: 'B', updatedAt: now - 2 * 24 * 60 * 60 * 1000 }),
      entry({ id: '3', title: 'C', updatedAt: now - 10 * 24 * 60 * 60 * 1000 }),
    ];
    expect(countNucleosThisWeek(entries, now)).toBe(2);
  });
});
