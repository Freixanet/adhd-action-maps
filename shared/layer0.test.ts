import { describe, expect, it } from 'vitest';
import { ensureLayer0, isLayer0Complete, normalizeLayer0 } from './layer0';
import type { ActionMapData } from './contracts';

describe('layer0', () => {
  it('normalizes a valid layer0 and caps what to 12 words', () => {
    const layer0 = normalizeLayer0({
      what: 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce',
      why: 'Ordena tu atención cuando el material se dispersa.',
      actions: [
        { id: 'a1', label: 'Marca la idea central' },
        { label: 'Corta lo que no usas' },
        { id: 'a3', label: 'Prueba el primer paso' },
      ],
    });
    expect(layer0).toBeTruthy();
    expect(layer0!.what.split(/\s+/)).toHaveLength(12);
    expect(layer0!.actions).toHaveLength(3);
    expect(layer0!.actions[1]!.id).toBe('action-2');
    expect(isLayer0Complete(layer0)).toBe(true);
  });

  it('rejects incomplete layer0', () => {
    expect(
      normalizeLayer0({
        what: 'Una idea',
        why: 'Ayuda a decidir',
        actions: [{ label: 'Solo una' }],
      })
    ).toBeUndefined();
    expect(isLayer0Complete(undefined)).toBe(false);
  });

  it('ensureLayer0 falls back from coreIdea and tldr', () => {
    const map = {
      title: 'Atención',
      coreIdea: 'La atención cambia con la carga de la tarea y el entorno cercano',
      coreSupport: '',
      intent: 'understand' as const,
      tldr: [
        { title: 'Carga', desc: 'Mide cuánta carga mental llevas antes de empezar.' },
        { title: 'Entorno', desc: 'Quita una distracción visible de la mesa.' },
        { title: 'Ritmo', desc: 'Trabaja en bloques cortos con pausa real.' },
      ],
      steps: [],
    } as unknown as ActionMapData;

    const layer0 = ensureLayer0(map);
    expect(layer0.what.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(layer0.actions).toHaveLength(3);
    expect(layer0.actions[0]!.label.length).toBeGreaterThan(0);
  });
});
