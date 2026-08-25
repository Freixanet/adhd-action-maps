import { describe, expect, it } from 'vitest';
import {
  countNucleosThisWeek,
  isDemoOrPreviewHistoryEntry,
  resolveContinueProgress,
  resolveNucleoCover,
  selectHomeRecents,
  selectLatestCreatedNucleos,
} from './homeFeed.ts';
import type { HistoryEntry } from './history.ts';
import { buildEditorialFixture } from './editorial/fixtures.ts';

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

describe('selectLatestCreatedNucleos', () => {
  it('orders strictly by createdAt descending', () => {
    const entries = [
      entry({ id: 'old', title: 'Old', createdAt: 10, updatedAt: 999 }),
      entry({ id: 'new', title: 'New', createdAt: 50, updatedAt: 50 }),
      entry({ id: 'mid', title: 'Mid', createdAt: 30, updatedAt: 800 }),
    ];
    expect(selectLatestCreatedNucleos(entries, 5).map((e) => e.id)).toEqual([
      'new',
      'mid',
      'old',
    ]);
  });

  it('never returns more than five', () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      entry({ id: `e${i}`, title: `T${i}`, createdAt: i + 1, updatedAt: i + 1 })
    );
    expect(selectLatestCreatedNucleos(entries, 5)).toHaveLength(5);
  });

  it('excludes demo and editorial preview nucleos', () => {
    const entries = [
      entry({ id: 'nucleo-demo-included', title: 'Demo', createdAt: 100 }),
      entry({ id: 'nucleo-editorial-demo', title: 'Editorial', createdAt: 90 }),
      entry({ id: 'nucleo-editorial-demo-attention', title: 'Attention', createdAt: 80 }),
      entry({ id: 'real-1', title: 'Real', createdAt: 70 }),
    ];
    expect(selectLatestCreatedNucleos(entries, 5).map((e) => e.id)).toEqual(['real-1']);
  });

  it('does not mutate the original array', () => {
    const entries = [
      entry({ id: 'a', title: 'A', createdAt: 1 }),
      entry({ id: 'b', title: 'B', createdAt: 2 }),
    ];
    const before = entries.map((e) => e.id);
    selectLatestCreatedNucleos(entries, 5);
    expect(entries.map((e) => e.id)).toEqual(before);
  });

  it('returns empty when only demos exist', () => {
    const entries = [entry({ id: 'nucleo-demo-included', title: 'Demo', createdAt: 1 })];
    expect(selectLatestCreatedNucleos(entries, 5)).toEqual([]);
  });

  it('returns the ids that Home cards open via handleSelectHistory', () => {
    const entries = [
      entry({ id: 'open-me', title: 'Abrir', createdAt: 20 }),
      entry({ id: 'nucleo-demo-included', title: 'Demo', createdAt: 99 }),
      entry({ id: 'also', title: 'También', createdAt: 10 }),
    ];
    const ids = selectLatestCreatedNucleos(entries, 5).map((e) => e.id);
    expect(ids).toEqual(['open-me', 'also']);
    // Contract: JumpBackInSection onSelect(id) → session.handleSelectHistory(id)
    const opened: string[] = [];
    const handleSelectHistory = (id: string) => opened.push(id);
    ids.forEach((id) => handleSelectHistory(id));
    expect(opened).toEqual(['open-me', 'also']);
  });
});

describe('isDemoOrPreviewHistoryEntry', () => {
  it('flags known demo id prefixes', () => {
    expect(isDemoOrPreviewHistoryEntry({ id: 'nucleo-demo-included' })).toBe(true);
    expect(isDemoOrPreviewHistoryEntry({ id: 'nucleo-editorial-demo-attention' })).toBe(true);
    expect(isDemoOrPreviewHistoryEntry({ id: 'user-map-1' })).toBe(false);
  });
});

describe('resolveNucleoCover', () => {
  it('is stable for the same map', () => {
    const map = entry({
      id: 'stable-1',
      title: 'Atención y foco sostenido',
      sourceType: 'youtube',
      createdAt: 1,
    });
    expect(resolveNucleoCover(map)).toEqual(resolveNucleoCover(map));
  });

  it('uses editorial cover illustration when present', () => {
    const plan = buildEditorialFixture('procrastination');
    const map = entry({
      id: 'ed-1',
      title: plan.title,
      createdAt: 1,
      session: {
        data: {
          title: plan.title,
          generationMode: 'editorial-v1',
          editorialPlan: plan,
          steps: [{ id: '1', title: 'A', body: '', time: '1 min' }],
        },
        currentStep: 0,
        isComplete: false,
      } as HistoryEntry['session'],
    });
    const cover = resolveNucleoCover(map);
    expect(cover.source).toBe('editorial-cover');
    expect(cover.assetId.length).toBeGreaterThan(0);
    expect(cover.localModule.length).toBeGreaterThan(0);
  });

  it('falls back deterministically without editorial plan', () => {
    const a = resolveNucleoCover(
      entry({ id: 'f1', title: 'PDF densos y exámenes', sourceType: 'pdf', createdAt: 1 })
    );
    const b = resolveNucleoCover(
      entry({ id: 'f1', title: 'PDF densos y exámenes', sourceType: 'pdf', createdAt: 1 })
    );
    expect(a.source).toBe('fallback');
    expect(a.assetId).toBe(b.assetId);
  });
});
