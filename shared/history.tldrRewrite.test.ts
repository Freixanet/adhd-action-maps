import { afterEach, describe, expect, it } from 'vitest';
import { configureStorage } from './storage';
import {
  loadHistory,
  markTldrSixtyRewriteDone,
  rewriteLatestEntryTldrSixtySeconds,
  saveHistory,
  type HistoryStore,
} from './history';
import { TLDR_MAX_COUNT } from './contracts';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

function sampleStore(): HistoryStore {
  return {
    activeId: 'older',
    collections: [],
    entries: [
      {
        id: 'older',
        title: 'Antiguo',
        createdAt: 1_000,
        updatedAt: 1_000,
        sourceType: 'text',
        session: {
          data: {
            title: 'Antiguo',
            coreIdea: 'Idea vieja',
            coreSupport: 'Apoyo viejo',
            tldr: [
              { title: 'A', desc: 'Primera idea antigua conservada aquí.' },
              { title: 'B', desc: 'Segunda idea antigua conservada aquí.' },
              { title: 'C', desc: 'Tercera idea antigua conservada aquí.' },
              { title: 'D', desc: 'Cuarta idea antigua que sobra casi siempre.' },
              { title: 'E', desc: 'Quinta idea antigua que no debe persistir.' },
            ],
            steps: [
              {
                id: 's1',
                shortNav: 'Uno',
                title: 'Paso uno',
                time: '~1 min',
                purpose: 'Propósito del paso uno en el mapa antiguo.',
                content: [{ type: 'prose', text: 'x' }],
              },
            ],
          },
          currentStep: 0,
        },
      },
      {
        id: 'newest',
        title: 'Reciente',
        createdAt: 2_000,
        updatedAt: 9_000,
        sourceType: 'pdf',
        session: {
          data: {
            title: 'Reciente',
            coreIdea: 'La carga concurrente revela el límite real del sistema.',
            coreSupport: 'Bajo concurrencia aparecen fallos ocultos en cola única.',
            tldr: [
              {
                title: 'La carga concurrente revela el límite real del sist',
                desc: 'La carga concurrente revela el límite real del sistema cuando la cola única satura.',
              },
              {
                title: 'Fallos ocultos',
                desc: 'Bajo concurrencia aparecen fallos ocultos en la cola única compartida.',
              },
              {
                title: 'Cola única',
                desc: 'Una sola cola concentra el cuello de botella del servicio.',
              },
              {
                title: 'Detalle',
                desc: 'Un ejemplo de log concreto ilustra el patrón sin aportar más.',
              },
              {
                title: 'Extra',
                desc: 'Una anécdota operativa que no cambia la síntesis esencial.',
              },
            ],
            knowledgeSections: [
              {
                title: 'Cola única',
                summary: 'Todo el tráfico comparte una cola; el límite aparece al saturar.',
              },
            ],
            coverage: {
              summary: 'ok',
              notes: [
                {
                  label: 'Límite',
                  detail: 'No afirma que más hilos arreglen la saturación de cola.',
                  tone: 'warning',
                },
              ],
            },
            steps: [
              {
                id: 's1',
                shortNav: 'Límite',
                title: 'Ver el límite',
                time: '~2 min',
                purpose: 'Identificar dónde satura la cola bajo carga concurrente.',
                content: [{ type: 'prose', text: 'y' }],
              },
            ],
          },
          currentStep: 1,
        },
      },
    ],
  };
}

describe('rewriteLatestEntryTldrSixtySeconds', () => {
  afterEach(() => {
    configureStorage(memoryStorage());
  });

  it('rewrites only the newest entry tldr and caps at four', () => {
    configureStorage(memoryStorage());
    const store = sampleStore();
    const next = rewriteLatestEntryTldrSixtySeconds(store);
    expect(next).not.toBeNull();
    const newest = next!.entries.find((e) => e.id === 'newest');
    const older = next!.entries.find((e) => e.id === 'older');
    expect(newest?.session.data.tldr.length).toBeLessThanOrEqual(TLDR_MAX_COUNT);
    expect(newest?.session.data.tldr.length).toBeGreaterThanOrEqual(1);
    expect(older?.session.data.tldr).toHaveLength(5);
    expect(newest?.id).toBe('newest');
    expect(newest?.title).toBe('Reciente');
    expect(newest?.session.currentStep).toBe(1);
    expect(newest?.session.data.steps).toHaveLength(1);
  });

  it('persists the rewrite across loadHistory', () => {
    const storage = memoryStorage();
    configureStorage(storage);
    saveHistory(sampleStore());
    const loaded = loadHistory();
    const newest = loaded.entries.find((e) => e.id === 'newest');
    expect(newest?.session.data.tldr.length).toBeLessThanOrEqual(TLDR_MAX_COUNT);
    const again = loadHistory();
    expect(again.entries.find((e) => e.id === 'newest')?.session.data.tldr).toEqual(
      newest?.session.data.tldr
    );
  });

  it('is idempotent after the one-shot flag when tldr already fits', () => {
    configureStorage(memoryStorage());
    const store = sampleStore();
    const newest = store.entries.find((e) => e.id === 'newest')!;
    newest.session.data.tldr = [
      { title: 'Límite', desc: 'La carga concurrente revela el límite del sistema.' },
      { title: 'Cola única', desc: 'Una sola cola concentra el cuello de botella.' },
      { title: 'Fallos ocultos', desc: 'Bajo concurrencia afloran fallos de la cola.' },
    ];
    markTldrSixtyRewriteDone();
    expect(rewriteLatestEntryTldrSixtySeconds(store)).toBeNull();
  });

  it('rewrites again if something restored more than four items', () => {
    configureStorage(memoryStorage());
    markTldrSixtyRewriteDone();
    const next = rewriteLatestEntryTldrSixtySeconds(sampleStore());
    expect(next).not.toBeNull();
    expect(next!.entries.find((e) => e.id === 'newest')!.session.data.tldr.length).toBeLessThanOrEqual(
      TLDR_MAX_COUNT
    );
  });
});
