import { describe, expect, it } from 'vitest';
import { classifyInput, extractJson } from './json';
import { parseLumenCanvas, parseLumenDoc } from './parse';
import { lumenCanvasToMap } from './toMap';
import { LUMEN_SAMPLE_CANVAS } from './samples';
import { normalizeMapData } from '../mapData';

describe('lumen json', () => {
  it('classifies url, topic and pasted text', () => {
    expect(classifyInput('https://example.com/a')).toBe('url');
    expect(classifyInput('relatividad especial')).toBe('topic');
    expect(classifyInput('Un párrafo largo.\nOtro.')).toBe('text');
  });

  it('extracts a fenced JSON object', () => {
    expect(extractJson('```json\n{"kind":"guide","title":"X"}\n```')).toEqual({
      kind: 'guide',
      title: 'X',
    });
  });
});

describe('lumen parse', () => {
  it('round-trips the relatividad sample', () => {
    const parsed = parseLumenCanvas(LUMEN_SAMPLE_CANVAS);
    expect(parsed?.kind).toBe('explain');
    expect(parsed && parsed.kind === 'explain' ? parsed.insights.length : 0).toBe(3);
  });

  it('rejects unknown kinds', () => {
    expect(parseLumenDoc({ kind: 'timeline', title: 'X', hook: 'Y' })).toBeNull();
  });

  it('pads quiz options to four', () => {
    const parsed = parseLumenDoc({
      kind: 'explain',
      title: 'Luz',
      hook: 'La luz no suma velocidades.',
      essence: 'c es constante.',
      insights: [
        { title: 'Uno', body: 'Cuerpo del insight uno.' },
        { title: 'Dos', body: 'Cuerpo del insight dos.' },
      ],
      layers: { surface: 's', core: 'c', depth: 'd' },
      map: { nodes: [{ id: 'a', label: 'Núcleo' }] },
      cards: [{ term: 'c', meaning: 'velocidad' }],
      walk: [{ title: 'Paso', body: 'Cuerpo' }],
      quiz: [{ question: '¿c?', options: ['sí'], answer: 0, why: 'porque' }],
    });
    expect(parsed?.kind).toBe('explain');
    if (parsed?.kind === 'explain') {
      expect(parsed.quiz[0]?.options).toHaveLength(4);
    }
  });
});

describe('lumen toMap', () => {
  it('embeds the canvas and stubs classic fields', () => {
    const map = lumenCanvasToMap(LUMEN_SAMPLE_CANVAS);
    expect(map.generationMode).toBe('lumen-v1');
    expect(map.lumenCanvas?.kind).toBe('explain');
    expect(map.steps).toHaveLength(1);
    const normalized = normalizeMapData(map);
    expect(normalized?.generationMode).toBe('lumen-v1');
    expect(normalized?.lumenCanvas?.title).toBe('Relatividad especial');
  });
});
