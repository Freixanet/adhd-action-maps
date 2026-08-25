import { describe, expect, it } from 'vitest';
import type { UnderstandingUnit } from '../understanding/types';
import { composeStepContent } from './compose';
import { selectNucleoFormat } from './select';
import type { NucleoFormatId } from './types';

function unit(
  partial: Partial<UnderstandingUnit> & Pick<UnderstandingUnit, 'id' | 'title'>
): UnderstandingUnit {
  return {
    role: 'concept',
    explanation:
      'La memoria de trabajo sostiene pocas piezas a la vez. Si llega más carga, se pierde el hilo. El texto insiste en no tratar ese límite como un fallo de carácter.',
    relations: [],
    examples: ['Pasar de chat a documento pierde el hilo'],
    cautions: ['no equivale a inteligencia'],
    segmentRefs: [],
    incomplete: false,
    ...partial,
  };
}

function typesOf(format: NucleoFormatId, extra?: Partial<ComposeExtras>): string[] {
  const a = unit({
    id: 'u1',
    title: 'Capacidad limitada',
    relations: extra?.relations ?? [
      { toUnitId: 'u2', kind: 'limits', id: 'rel_1' },
    ],
    examples: extra?.examples ?? ['Pasar de chat a documento pierde el hilo'],
    cautions: extra?.cautions ?? ['no equivale a inteligencia'],
  });
  const b = unit({
    id: 'u2',
    title: 'Interferencia',
    explanation: 'Otra pieza del mismo mapa para anclar la relación.',
    examples: [],
    cautions: [],
  });
  return composeStepContent({
    unit: a,
    allUnits: [a, b],
    format,
    includeRelations: extra?.includeRelations ?? true,
    isFirst: extra?.isFirst ?? true,
    isLast: extra?.isLast ?? false,
    nuclearIdea: extra?.nuclearIdea ?? 'Pocas piezas activas a la vez.',
  }).map((block) => block.type);
}

type ComposeExtras = {
  relations?: UnderstandingUnit['relations'];
  examples?: string[];
  cautions?: string[];
  includeRelations?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  nuclearIdea?: string;
};

describe('selectNucleoFormat', () => {
  it('lets discourse decide the reading job', () => {
    expect(selectNucleoFormat({ discourseStructure: 'comparative' })).toBe('contrast');
    expect(selectNucleoFormat({ discourseStructure: 'causal' })).toBe('causal');
    expect(selectNucleoFormat({ discourseStructure: 'chronological' })).toBe('sequence');
    expect(selectNucleoFormat({ discourseStructure: 'procedural' })).toBe('process');
    expect(selectNucleoFormat({ discourseStructure: 'problem_solution' })).toBe('argument');
    expect(selectNucleoFormat({ discourseStructure: 'conceptual' })).toBe('concept');
  });

  it('uses genre when discourse is mixed or unknown', () => {
    expect(
      selectNucleoFormat({ genre: 'procedural', discourseStructure: 'mixed' })
    ).toBe('process');
    expect(
      selectNucleoFormat({ genre: 'argumentative', discourseStructure: 'unknown' })
    ).toBe('argument');
    expect(
      selectNucleoFormat({ genre: 'narrative', discourseStructure: 'mixed' })
    ).toBe('sequence');
    expect(
      selectNucleoFormat({ genre: 'explanatory', discourseStructure: 'unknown' })
    ).toBe('reading');
  });
});

describe('composeStepContent', () => {
  it('does not clone the same stack for every format', () => {
    const contrast = typesOf('contrast');
    const sequence = typesOf('sequence');
    const process = typesOf('process');
    const concept = typesOf('concept');

    expect(contrast[0]).toBe('comparison');
    expect(sequence[0]).toBe('list');
    expect(process[0]).toBe('list');
    expect(concept.includes('callout') || concept[0] === 'callout').toBe(true);

    expect(contrast).not.toEqual(sequence);
    expect(sequence).toEqual(process);
    expect(concept).not.toEqual(contrast);
  });

  it('never stacks comparison and Conexión callouts', () => {
    for (const format of ['contrast', 'causal', 'sequence', 'concept'] as const) {
      const a = unit({
        id: 'u1',
        title: 'Origen',
        relations: [{ toUnitId: 'u2', kind: 'contributes', id: 'rel_x' }],
      });
      const b = unit({ id: 'u2', title: 'Destino', examples: [], cautions: [] });
      const blocks = composeStepContent({
        unit: a,
        allUnits: [a, b],
        format,
        includeRelations: true,
        isFirst: false,
        isLast: false,
        nuclearIdea: 'Idea',
      });
      const hasComparison = blocks.some((block) => block.type === 'comparison');
      const hasConnection = blocks.some(
        (block) => block.type === 'callout' && block.label === 'Conexión'
      );
      expect(hasComparison && hasConnection).toBe(false);
      expect(hasComparison || hasConnection).toBe(true);
    }
  });

  it('puts extra density in accordion instead of stacked callouts', () => {
    const blocks = composeStepContent({
      unit: unit({
        id: 'u1',
        title: 'Límite',
        explanation:
          'Primera frase con el punto. Segunda que aún cabe. Tercera que ya sobra en la página y debe ir debajo. Cuarta para que el recorte sea obvio.',
        examples: ['Ejemplo A', 'Ejemplo B'],
        cautions: ['Matiz uno', 'Matiz dos'],
      }),
      allUnits: [],
      format: 'concept',
      includeRelations: false,
      isFirst: false,
      isLast: false,
      nuclearIdea: 'Pocas piezas.',
    });
    const callouts = blocks.filter((block) => block.type === 'callout');
    const accordions = blocks.filter((block) => block.type === 'accordion');
    expect(callouts.length).toBeLessThanOrEqual(1);
    expect(accordions.length).toBe(1);
    expect(accordions[0]?.body).toMatch(/Tercera|Ejemplo B|Matiz/);
  });

  it('closes the last page with the nuclear idea when it is not already on screen', () => {
    const blocks = composeStepContent({
      unit: unit({
        id: 'u2',
        title: 'Cierre',
        explanation: 'Última pieza del recorrido.',
        examples: [],
        cautions: [],
      }),
      allUnits: [],
      format: 'reading',
      includeRelations: false,
      isFirst: false,
      isLast: true,
      nuclearIdea: 'La capacidad es estrecha y se satura.',
    });
    const last = blocks[blocks.length - 1];
    expect(last?.type).toBe('callout');
    if (last?.type !== 'callout') return;
    expect(last.label).toBe('Idea clave');
    expect(last.text).toContain('capacidad');
  });
});
