import { describe, expect, it } from 'vitest';
import {
  normalizeConceptMap,
  normalizeMapData,
  normalizeStepDiagram,
} from './mapData.ts';
import { hasConceptMapHub, maxReadingStepIndex, resolveReadingPage } from './readingPages.ts';

const baseMap = {
  title: 'Mapa visual',
  coreIdea: 'Idea',
  coreSupport: 'Apoyo',
  tldr: [
    { title: 'A', desc: 'a' },
    { title: 'B', desc: 'b' },
    { title: 'C', desc: 'c' },
  ],
  steps: [
    {
      id: '1',
      shortNav: 'Uno',
      title: 'Paso uno',
      time: '2 min',
      content: [{ type: 'prose', text: 'Texto' }],
    },
  ],
};

describe('normalizeConceptMap', () => {
  it('returns null for rapido', () => {
    expect(
      normalizeConceptMap(
        {
          nodes: [
            { id: '1', label: 'A' },
            { id: '2', label: 'B' },
            { id: '3', label: 'C' },
            { id: '4', label: 'D' },
          ],
          edges: [],
        },
        { depth: 'rapido' }
      )
    ).toBeNull();
  });

  it('keeps 4–7 nodes and valid edges', () => {
    const map = normalizeConceptMap(
      {
        title: 'Hub',
        nodes: [
          { id: 'a', label: 'Atención' },
          { id: 'b', label: 'Memoria' },
          { id: 'c', label: 'Motivación' },
          { id: 'd', label: 'Hábito' },
          { id: 'e', label: 'Extra' },
          { id: 'f', label: 'Más' },
          { id: 'g', label: 'Siete' },
          { id: 'h', label: 'Ocho' },
        ],
        edges: [
          { from: 'a', to: 'b', label: 'habilita' },
          { from: 'b', to: 'missing', label: 'x' },
        ],
      },
      { depth: 'estandar' }
    );
    expect(map?.nodes).toHaveLength(7);
    expect(map?.edges).toEqual([{ from: 'a', to: 'b', label: 'habilita' }]);
  });

  it('synthesizes from knowledgeSections when missing', () => {
    const map = normalizeConceptMap(null, {
      depth: 'profundo',
      knowledgeSections: [
        { title: 'Uno', summary: 's1' },
        { title: 'Dos', summary: 's2' },
        { title: 'Tres', summary: 's3' },
        { title: 'Cuatro', summary: 's4' },
      ],
    });
    expect(map?.nodes).toHaveLength(4);
    expect(map?.edges?.length).toBeGreaterThan(0);
  });
});

describe('normalizeStepDiagram', () => {
  it('accepts process with ≥2 nodes', () => {
    const diagram = normalizeStepDiagram({
      kind: 'process',
      nodes: [
        { id: '1', label: 'Inicio' },
        { id: '2', label: 'Fin' },
      ],
    });
    expect(diagram?.kind).toBe('process');
  });

  it('rejects invalid kind', () => {
    expect(normalizeStepDiagram({ kind: 'chart', nodes: [{ id: '1', label: 'A' }] })).toBeNull();
  });
});

describe('normalizeMapData diagrams', () => {
  it('keeps one diagram block per step and conceptMap for estandar', () => {
    const normalized = normalizeMapData(
      {
        ...baseMap,
        conceptMap: {
          nodes: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
            { id: 'c', label: 'C' },
            { id: 'd', label: 'D' },
          ],
          edges: [{ from: 'a', to: 'b', label: 'causa' }],
        },
        steps: [
          {
            ...baseMap.steps[0],
            content: [
              {
                type: 'diagram',
                text: '',
                diagram: {
                  kind: 'compare',
                  columns: [
                    [{ id: 'l1', label: 'Izq' }],
                    [{ id: 'r1', label: 'Der' }],
                  ],
                },
              },
              {
                type: 'diagram',
                text: '',
                diagram: {
                  kind: 'process',
                  nodes: [
                    { id: '1', label: 'A' },
                    { id: '2', label: 'B' },
                  ],
                },
              },
              { type: 'prose', text: 'Cuerpo' },
            ],
          },
        ],
      },
      { depth: 'estandar' }
    );
    expect(normalized?.conceptMap?.nodes).toHaveLength(4);
    expect(normalized?.steps[0]?.content.filter((b) => b.type === 'diagram')).toHaveLength(1);
    expect(normalized?.steps[0]?.content.some((b) => b.type === 'prose')).toBe(true);
  });

  it('strips conceptMap on rapido', () => {
    const normalized = normalizeMapData(
      {
        ...baseMap,
        conceptMap: {
          nodes: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
            { id: 'c', label: 'C' },
            { id: 'd', label: 'D' },
          ],
          edges: [],
        },
      },
      { depth: 'rapido' }
    );
    expect(normalized?.conceptMap).toBeNull();
  });
});

describe('readingPages', () => {
  it('shifts step pages when hub is present', () => {
    const data = normalizeMapData(
      {
        ...baseMap,
        conceptMap: {
          nodes: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
            { id: 'c', label: 'C' },
            { id: 'd', label: 'D' },
          ],
          edges: [],
        },
      },
      { depth: 'estandar' }
    )!;
    expect(hasConceptMapHub(data)).toBe(true);
    expect(maxReadingStepIndex(1, data)).toBe(3);
    expect(resolveReadingPage(2, data)).toEqual({ kind: 'conceptMap' });
    expect(resolveReadingPage(3, data)).toEqual({ kind: 'step', stepIndex: 1 });
  });
});
