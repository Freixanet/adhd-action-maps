import { describe, expect, it, vi } from 'vitest';
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
  it('preserva la clasificación semántica y descarta valores desconocidos', () => {
    const book = normalizeMapData({
      ...legacyMap,
      sourceMetadata: {
        kind: 'pdf',
        contentKind: 'book',
        label: 'Fuente',
        detected: [],
      },
    });
    const unknown = normalizeMapData({
      ...legacyMap,
      sourceMetadata: {
        kind: 'pdf',
        contentKind: 'invoice',
        label: 'Fuente',
        detected: [],
      },
    });

    expect(book?.sourceMetadata?.contentKind).toBe('book');
    expect(unknown?.sourceMetadata?.contentKind).toBeUndefined();
  });

  it('ignora visualization presente y normaliza el mapa sin overview (F3 off)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const normalized = normalizeMapData({
      ...legacyMap,
      visualization: {
        version: 2,
        kind: 'flow',
        title: 'No debe persistir',
        summary: 'Canal visualization apagado.',
        items: [
          { id: 'a', label: 'Planificación', detail: 'Antes.' },
          { id: 'b', label: 'Ejecución', detail: 'Durante.' },
        ],
        links: [{ source: 'a', target: 'b' }],
      },
      steps: [
        {
          ...legacyMap.steps[0],
          visualization: {
            version: 2,
            kind: 'concept',
            title: 'Step visual',
            summary: 'Tampoco.',
            items: [
              { id: 'x', label: 'Nodo' },
              { id: 'y', label: 'Otro' },
            ],
          },
        },
      ],
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.title).toBe(legacyMap.title);
    expect(normalized?.coreIdea).toBe(legacyMap.coreIdea);
    expect(normalized?.tldr).toHaveLength(2);
    expect(normalized?.steps).toHaveLength(1);
    expect(normalized?.steps[0]?.content[0]).toMatchObject({
      type: 'prose',
      text: 'Contenido persistido.',
    });
    expect(normalized?.visualization).toBeUndefined();
    expect(normalized?.steps[0]?.visualization).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('preserves visualize-html-test generationMode without hydrating NucleoVisualSpec', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const normalized = normalizeMapData({
      ...legacyMap,
      generationMode: 'visualize-html-test',
      visualization: {
        version: 2,
        kind: 'flow',
        title: 'Proceso',
        summary: 'Flujo de prueba para el modo Visualize HTML.',
        items: [
          { id: 'a', label: 'Inicio', detail: 'Empieza aquí.' },
          { id: 'b', label: 'Fin', detail: 'Termina aquí.', stepId: 'step-one' },
        ],
        links: [{ source: 'a', target: 'b', label: 'sigue' }],
      },
      visualizeArtifact: {
        version: 1,
        semantic: {
          objective: 'understand',
          centralIdea: 'La capacidad sin control se vuelve daño',
          entities: [
            { id: 'a', label: 'Inicio' },
            { id: 'b', label: 'Fin' },
          ],
          relationships: [{ from: 'a', to: 'b', type: 'sigue' }],
        },
        chosen: {
          route: 'structured',
          grammar: 'process',
          spec: { title: 'Proceso', steps: ['Inicio', 'Fin'] },
        },
      },
    });

    expect(normalized?.generationMode).toBe('visualize-html-test');
    expect(normalized?.visualization).toBeUndefined();
    expect(normalized?.visualizeArtifact?.chosen.route).toBe('structured');
    warn.mockRestore();
  });

  it('preserves visualizeRun v2 without requiring debug payloads', () => {
    const normalized = normalizeMapData({
      ...legacyMap,
      generationMode: 'visualize-html-test',
      visualizeRun: {
        schemaVersion: 2,
        pipelineVersion: 'test',
        rendererSpecVersion: 'render-spec-1',
        runId: 'run-test',
        status: 'complete',
        selection: {
          strategy: 'guided-reading',
          reason: 'best-candidate',
          eligible: ['guided-reading'],
          rejected: {},
        },
        renderSpec: {
          type: 'guided-reading',
          title: 'Tesis',
          insight: 'Resumen',
          nucleus: { id: 'nucleus', label: 'Tesis' },
          ideas: [{ id: 'idea-1', label: 'Una idea' }],
        },
        warnings: [],
        usedEvidence: [{ id: 'seg-1', text: 'Fragmento' }],
      },
    });

    expect(normalized?.visualizeRun?.schemaVersion).toBe(2);
    expect(normalized?.visualizeRun?.renderSpec.type).toBe('guided-reading');
    expect(normalized?.visualizeRun?.usedEvidence[0]?.id).toBe('seg-1');
  });

  it('caps tldr at four items without rejecting the map', () => {
    const normalized = normalizeMapData({
      ...legacyMap,
      tldr: [
        { title: 'Uno', desc: 'Primera idea esencial del mapa.' },
        { title: 'Dos', desc: 'Segunda idea esencial del mapa.' },
        { title: 'Tres', desc: 'Tercera idea esencial del mapa.' },
        { title: 'Cuatro', desc: 'Cuarta idea solo si hace falta.' },
        { title: 'Cinco', desc: 'Esta quinta no debe persistir nunca.' },
      ],
    });
    expect(normalized).not.toBeNull();
    expect(normalized!.tldr).toHaveLength(4);
    expect(normalized!.tldr.map((t) => t.title)).toEqual(['Uno', 'Dos', 'Tres', 'Cuatro']);
  });
});
