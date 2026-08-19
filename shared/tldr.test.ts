import { describe, expect, it } from 'vitest';
import {
  TLDR_MAX_COUNT,
  TLDR_SUBTITLE_MAX_CHARACTERS,
  type ActionMapData,
} from './contracts';
import {
  normalizeTldrItems,
  selectLatestHistoryEntryByTime,
  softClipWithoutEllipsis,
  synthesizeTldrFromMap,
} from './tldr';

const baseMap = (overrides: Partial<ActionMapData> = {}): ActionMapData =>
  ({
    title: 'Mapa',
    coreIdea: 'La atención fragmentada reduce la calidad de las decisiones.',
    coreSupport: 'Sin foco sostenido, las prioridades se diluyen bajo presión.',
    tldr: [
      {
        title: 'Atención fragmentada',
        desc: 'La fragmentación baja la calidad de las decisiones bajo carga.',
      },
      {
        title: 'Prioridades diluidas',
        desc: 'Sin foco sostenido las prioridades se diluyen con facilidad.',
      },
      {
        title: 'Presión externa',
        desc: 'La presión externa acelera saltos entre tareas incompletas.',
      },
      {
        title: 'Detalle menor',
        desc: 'Un ejemplo de agenda semanal no cambia el mecanismo.',
      },
      {
        title: 'Otro relleno',
        desc: 'Una anécdota secundaria que no aporta comprensión nueva.',
      },
    ],
    knowledgeSections: [
      {
        title: 'Mecanismo',
        summary: 'El cambio de contexto consume memoria de trabajo útil.',
      },
    ],
    steps: [
      {
        id: 's1',
        shortNav: 'Foco',
        title: 'Recuperar foco',
        time: '~2 min',
        purpose: 'Recuperar un bloque de atención antes de decidir.',
        content: [{ type: 'prose', text: 'Paso' }],
      },
    ],
    coverage: {
      summary: 'Cobertura media',
      notes: [
        {
          label: 'Límite',
          detail: 'No afirma causalidad directa entre multitarea y burnout.',
          tone: 'warning',
        },
      ],
    },
    ...overrides,
  }) as ActionMapData;

describe('tldr sixty-second contract', () => {
  it('soft-clips without ellipsis', () => {
    const long =
      'Esta frase es deliberadamente larga para forzar el recorte suave en el límite de caracteres permitido';
    const clipped = softClipWithoutEllipsis(long, TLDR_SUBTITLE_MAX_CHARACTERS);
    expect(clipped.length).toBeLessThanOrEqual(TLDR_SUBTITLE_MAX_CHARACTERS);
    expect(clipped.includes('…')).toBe(false);
    expect(clipped.endsWith('...')).toBe(false);
  });

  it('never persists more than four tldr items', () => {
    const items = normalizeTldrItems(
      Array.from({ length: 8 }, (_, i) => ({
        title: `Idea ${i + 1}`,
        desc: `Descripción completa número ${i + 1} sin relleno vacío.`,
      }))
    );
    expect(items).toHaveLength(TLDR_MAX_COUNT);
  });

  it('synthesizes at most four ideas and prefers three when no indispensable limit', () => {
    const withoutLimit = synthesizeTldrFromMap(
      baseMap({
        coverage: { summary: 'ok', notes: [] },
        sourceMetadata: undefined,
      })
    );
    expect(withoutLimit.length).toBeLessThanOrEqual(TLDR_MAX_COUNT);
    expect(withoutLimit.length).toBeGreaterThanOrEqual(1);
    expect(withoutLimit.length).toBeLessThanOrEqual(3);
    for (const item of withoutLimit) {
      expect(item.desc.length).toBeLessThanOrEqual(TLDR_SUBTITLE_MAX_CHARACTERS);
      expect(item.desc.includes('…')).toBe(false);
    }
  });

  it('can keep a fourth idea when a critical limit is indispensable', () => {
    const withLimit = synthesizeTldrFromMap(baseMap());
    expect(withLimit.length).toBeLessThanOrEqual(4);
    if (withLimit.length === 4) {
      expect(withLimit.some((i) => /límite|no afirma/i.test(`${i.title} ${i.desc}`))).toBe(
        true
      );
    }
  });

  it('selects the latest history entry by real timestamps, not array order', () => {
    const latest = selectLatestHistoryEntryByTime([
      { id: 'old', createdAt: 100, updatedAt: 100 },
      { id: 'mid', createdAt: 200, updatedAt: 150 },
      { id: 'new', createdAt: 50, updatedAt: 400 },
    ]);
    expect(latest?.id).toBe('new');
  });
});
