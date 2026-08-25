import { describe, expect, it } from 'vitest';
import {
  getNucleoVisualQualityIssues,
  normalizeNucleoVisual,
  normalizeOptionalStepVisual,
} from './nucleoVisual';
import type { NucleoVisualKind } from './contracts';

const fallback = {
  coreIdea: 'La atención cambia según el entorno y la carga de la tarea.',
  tldr: [
    { title: 'Contexto', desc: 'El entorno modifica el esfuerzo necesario.' },
    { title: 'Carga', desc: 'La complejidad consume recursos ejecutivos.' },
    { title: 'Respuesta', desc: 'La estrategia reduce la fricción.' },
  ],
};

const diagramKinds: NucleoVisualKind[] = [
  'concept',
  'flow',
  'cycle',
  'hierarchy',
];

describe('normalizeNucleoVisual v2', () => {
  it.each(diagramKinds)('normalizes %s without flattening its semantic kind', (kind) => {
    const visual = normalizeNucleoVisual({
      version: 2,
      kind,
      title: 'Relación principal',
      summary: 'Una explicación accesible de la relación.',
      items: [
        { id: 'a', label: 'Entrada', detail: 'Punto de partida.', order: 1 },
        { id: 'b', label: 'Cambio', detail: 'Mecanismo principal.', order: 2 },
        { id: 'c', label: 'Resultado', detail: 'Efecto observable.', order: 3 },
      ],
    });

    expect(visual?.kind).toBe(kind);
    expect(visual?.version).toBe(2);
    expect(visual?.items).toHaveLength(3);
  });

  it('normalizes a comparison with aligned groups', () => {
    const visual = normalizeNucleoVisual({
      version: 2,
      kind: 'comparison',
      title: 'Dos enfoques',
      summary: 'Contrasta coste y efecto.',
      items: [
        { id: 'a1', group: 'Reactivo', label: 'Inicio', detail: 'Espera al problema.' },
        { id: 'b1', group: 'Preventivo', label: 'Inicio', detail: 'Prepara el entorno.' },
      ],
    });

    expect(visual?.kind).toBe('comparison');
    expect(visual?.items.map((item) => item.group)).toEqual(['Reactivo', 'Preventivo']);
  });

  it.each(['bar', 'line'] as const)('accepts a grounded %s chart with finite values and units', (kind) => {
    const visual = normalizeNucleoVisual({
      version: 2,
      kind,
      title: 'Duración observada',
      summary: 'Valores publicados por la fuente.',
      unit: 'min',
      items: [
        { id: 'a', group: 'Sesión', label: 'Lunes', value: 12 },
        { id: 'b', group: 'Sesión', label: 'Martes', value: 18 },
      ],
    });

    expect(visual?.kind).toBe(kind);
    expect(getNucleoVisualQualityIssues(visual!)).toEqual([]);
  });

  it('migrates the flat version 1 shape into version 2', () => {
    const visual = normalizeNucleoVisual({
      kind: 'cycle',
      title: 'Ciclo antiguo',
      items: [
        { id: 'signal', label: 'Señal', detail: 'Inicia el circuito.' },
        { id: 'response', label: 'Respuesta', detail: 'Modifica la señal.' },
      ],
    });

    expect(visual).toMatchObject({
      version: 2,
      kind: 'cycle',
      title: 'Ciclo antiguo',
      summary: 'Inicia el circuito.',
    });
    expect(visual?.links).toEqual([
      { source: 'signal', target: 'response' },
      { source: 'response', target: 'signal' },
    ]);
  });

  it('builds an honest concept map for a legacy map without visualization', () => {
    const visual = normalizeNucleoVisual(undefined, fallback);

    expect(visual).toMatchObject({
      version: 2,
      kind: 'concept',
      title: 'Lo esencial de un vistazo',
      summary: fallback.coreIdea,
    });
    expect(visual?.items.map((item) => item.id)).toEqual([
      'core',
      'branch-1',
      'branch-2',
      'branch-3',
    ]);
  });

  it('repairs duplicate ids and drops links that do not resolve', () => {
    const visual = normalizeNucleoVisual({
      kind: 'flow',
      title: 'Secuencia',
      summary: 'Tres pasos.',
      items: [
        { id: 'same', label: 'Uno', detail: 'Primero.' },
        { id: 'same', label: 'Dos', detail: 'Segundo.' },
        { id: 'three', label: 'Tres', detail: 'Tercero.' },
      ],
      links: [{ source: 'same', target: 'missing' }],
    });

    expect(visual?.items.map((item) => item.id)).toEqual(['same', 'visual-2', 'three']);
    expect(visual?.links).toEqual([
      { source: 'same', target: 'visual-2' },
      { source: 'visual-2', target: 'three' },
    ]);
  });

  it('caps items, text, references and validates step links', () => {
    const visual = normalizeNucleoVisual(
      {
        kind: 'concept',
        title: 'Partes',
        summary: 'Resumen',
        items: Array.from({ length: 8 }, (_, index) => ({
          id: `item-${index}`,
          label: `Parte ${index} con una etiqueta deliberadamente muy larga que debe recortarse`,
          detail: 'Detalle '.repeat(60),
          stepId: index === 0 ? 'valid-step' : 'missing-step',
          references: Array.from({ length: 5 }, (_, refIndex) => ({
            label: `Fuente ${refIndex}`,
            locator: `p. ${refIndex}`,
          })),
        })),
      },
      { ...fallback, stepIds: ['valid-step'] }
    );

    expect(visual?.items).toHaveLength(6);
    expect(visual?.items[0]?.label.length).toBeLessThanOrEqual(36);
    expect(visual?.items[0]?.detail?.length).toBeLessThanOrEqual(240);
    expect(visual?.items[0]?.references).toHaveLength(3);
    expect(visual?.items[0]?.stepId).toBe('valid-step');
    expect(visual?.items[1]?.stepId).toBeUndefined();
  });

  it.each([
    ['missing value', [{ id: 'a', label: 'A', value: 2 }, { id: 'b', label: 'B' }]],
    ['non-finite value', [{ id: 'a', label: 'A', value: 2 }, { id: 'b', label: 'B', value: Infinity }]],
    ['missing units', [{ id: 'a', label: 'A', value: 2 }, { id: 'b', label: 'B', value: 3 }]],
  ])('never returns an invented chart when there is %s', (_name, items) => {
    const visual = normalizeNucleoVisual(
      { kind: 'bar', title: 'Datos', summary: 'Comparación.', items },
      fallback
    );

    expect(visual?.kind).toBe('concept');
  });

  it('drops an unsupported optional step chart instead of inventing values', () => {
    expect(
      normalizeOptionalStepVisual({
        kind: 'line',
        title: 'Tendencia',
        summary: 'Sin datos suficientes.',
        unit: '%',
        items: [
          { id: 'a', label: 'Antes', value: 20, group: 'Grupo A' },
          { id: 'b', label: 'Después', group: 'Grupo A' },
        ],
      })
    ).toBeUndefined();
  });

  it('rejects a line series with fewer than two points', () => {
    expect(
      normalizeOptionalStepVisual({
        kind: 'line',
        title: 'Series rotas',
        summary: 'Una serie queda aislada.',
        unit: '%',
        items: [
          { id: 'a1', label: 'Inicio', value: 10, group: 'A' },
          { id: 'a2', label: 'Final', value: 20, group: 'A' },
          { id: 'b1', label: 'Inicio', value: 15, group: 'B' },
        ],
      })
    ).toBeUndefined();
  });

  it('limits comparisons to two or three readable columns', () => {
    expect(
      normalizeOptionalStepVisual({
        kind: 'comparison',
        title: 'Demasiadas columnas',
        summary: 'No cabe como comparación alineada.',
        items: ['A', 'B', 'C', 'D'].map((group) => ({
          id: group.toLowerCase(),
          group,
          label: 'Criterio',
          detail: group,
        })),
      })
    ).toBeUndefined();
  });
});
