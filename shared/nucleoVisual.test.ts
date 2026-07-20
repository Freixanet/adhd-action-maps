import { describe, expect, it } from 'vitest';
import { normalizeNucleoVisual } from './nucleoVisual';

const fallbackTldr = [
  { title: 'Entrada', desc: 'La fuente introduce el problema.' },
  { title: 'Cambio', desc: 'El mecanismo transforma la situación.' },
  { title: 'Resultado', desc: 'El efecto final cierra la relación.' },
];

describe('normalizeNucleoVisual', () => {
  it('preserves a supported semantic visual', () => {
    expect(
      normalizeNucleoVisual(
        {
          kind: 'cycle',
          title: 'Un ciclo que se retroalimenta',
          items: [
            { id: 'signal', label: 'Señal', detail: 'La señal inicia el circuito.' },
            { id: 'response', label: 'Respuesta', detail: 'La respuesta modifica la señal.' },
            { id: 'return', label: 'Retorno', detail: 'El resultado vuelve al inicio.' },
          ],
        },
        fallbackTldr
      )
    ).toEqual({
      kind: 'cycle',
      title: 'Un ciclo que se retroalimenta',
      items: [
        { id: 'signal', label: 'Señal', detail: 'La señal inicia el circuito.' },
        { id: 'response', label: 'Respuesta', detail: 'La respuesta modifica la señal.' },
        { id: 'return', label: 'Retorno', detail: 'El resultado vuelve al inicio.' },
      ],
    });
  });

  it('normalizes common kind aliases', () => {
    const normalized = normalizeNucleoVisual({
      kind: 'timeline',
      title: 'Antes y después',
      items: fallbackTldr.map((item, index) => ({
        id: String(index),
        label: item.title,
        detail: item.desc,
      })),
    });

    expect(normalized?.kind).toBe('flow');
  });

  it('builds a compatible flow from TLDR data when the visual is absent', () => {
    expect(normalizeNucleoVisual(undefined, fallbackTldr)).toEqual({
      kind: 'flow',
      title: 'El Núcleo de un vistazo',
      items: [
        { id: 'visual-1', label: 'Entrada', detail: 'La fuente introduce el problema.' },
        { id: 'visual-2', label: 'Cambio', detail: 'El mecanismo transforma la situación.' },
        { id: 'visual-3', label: 'Resultado', detail: 'El efecto final cierra la relación.' },
      ],
    });
  });

  it('caps visuals at five concise items', () => {
    const normalized = normalizeNucleoVisual({
      kind: 'hierarchy',
      title: 'Partes',
      items: Array.from({ length: 7 }, (_, index) => ({
        id: `item-${index}`,
        label: `Parte ${index} con una etiqueta deliberadamente muy larga que debe recortarse`,
        detail: 'Detalle '.repeat(60),
      })),
    });

    expect(normalized?.items).toHaveLength(5);
    expect(normalized?.items[0]?.label.length).toBeLessThanOrEqual(48);
    expect(normalized?.items[0]?.detail.length).toBeLessThanOrEqual(220);
  });

  it('repairs duplicate item ids so selection stays unambiguous', () => {
    const normalized = normalizeNucleoVisual({
      kind: 'comparison',
      title: 'Dos enfoques',
      items: [
        { id: 'same', label: 'A', detail: 'Primer enfoque.' },
        { id: 'same', label: 'B', detail: 'Segundo enfoque.' },
      ],
    });

    expect(normalized?.items.map((item) => item.id)).toEqual(['same', 'visual-2']);
  });
});
