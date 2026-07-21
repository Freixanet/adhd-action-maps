import { describe, expect, it } from 'vitest';
import { normalizeMapData } from './mapData';

const legacyMap = {
  title: 'Mapa guardado',
  coreIdea: 'La idea central permanece disponible al abrir un Núcleo antiguo.',
  coreSupport: 'Apoyo',
  tldr: [
    { title: 'Primero', desc: 'Una idea conservada.' },
    { title: 'Después', desc: 'Otra idea conservada.' },
  ],
  steps: [
    {
      id: 'step-one',
      shortNav: 'Uno',
      title: 'Primer paso',
      time: '~1 min',
      content: [{ type: 'prose', text: 'Contenido persistido.' }],
    },
  ],
};

describe('normalizeMapData visual integration', () => {
  it('hydrates a saved legacy map with the compatible concept overview', () => {
    const normalized = normalizeMapData(legacyMap);

    expect(normalized?.visualization).toMatchObject({
      version: 2,
      kind: 'concept',
      summary: legacyMap.coreIdea,
    });
  });

  it('keeps a grounded chart and validates item-to-step navigation', () => {
    const normalized = normalizeMapData({
      ...legacyMap,
      visualization: {
        version: 2,
        kind: 'bar',
        title: 'Tiempo publicado',
        summary: 'La fuente ofrece dos duraciones explícitas.',
        unit: 'min',
        items: [
          { id: 'before', label: 'Antes', value: 18, stepId: 'step-one' },
          { id: 'after', label: 'Después', value: 9, stepId: 'missing-step' },
        ],
      },
    });

    expect(normalized?.visualization?.kind).toBe('bar');
    expect(normalized?.visualization?.items[0]?.stepId).toBe('step-one');
    expect(normalized?.visualization?.items[1]?.stepId).toBeUndefined();
  });

  it('drops an invalid optional step chart during partial or persisted hydration', () => {
    const normalized = normalizeMapData({
      ...legacyMap,
      steps: [
        {
          ...legacyMap.steps[0],
          visualization: {
            version: 2,
            kind: 'line',
            title: 'Tendencia incompleta',
            summary: 'Falta un valor.',
            unit: '%',
            items: [
              { id: 'a', group: 'Serie', label: 'Inicio', value: 20 },
              { id: 'b', group: 'Serie', label: 'Final' },
            ],
          },
        },
      ],
    });

    expect(normalized?.steps[0]?.visualization).toBeUndefined();
  });
});
