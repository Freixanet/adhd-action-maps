import { describe, expect, it } from 'vitest';
import { estimateVisualLabelLines, getVisualGeometry } from './nucleoVisualGeometry';
import type { NucleoVisualKind } from './contracts';

const diagramKinds: NucleoVisualKind[] = ['concept', 'flow', 'cycle', 'hierarchy', 'timeline'];

describe('visual geometry', () => {
  it.each([320, 390, 736])('keeps 2–6 nodes inside a %spx viewport', (width) => {
    for (const kind of diagramKinds) {
      for (let count = 2; count <= 6; count += 1) {
        const geometry = getVisualGeometry(
          kind,
          width,
          Array.from({ length: count }, (_, index) => `Elemento ${index + 1}`)
        );
        expect(geometry.frames).toHaveLength(count);
        geometry.frames.forEach((frame) => {
          expect(frame.x).toBeGreaterThanOrEqual(0);
          expect(frame.y).toBeGreaterThanOrEqual(0);
          expect(frame.x + frame.width).toBeLessThanOrEqual(geometry.width + 0.001);
          expect(frame.y + frame.height).toBeLessThanOrEqual(geometry.height + 0.001);
        });
      }
    }
  });

  it('switches dense narrow flows to a vertical reading path', () => {
    expect(getVisualGeometry('flow', 320, Array(5).fill('Paso')).vertical).toBe(true);
    expect(getVisualGeometry('flow', 736, Array(4).fill('Paso')).vertical).toBe(false);
  });

  it('reserves up to three readable lines for long labels', () => {
    const label = 'Una etiqueta esencial deliberadamente larga para una pantalla compacta';
    expect(estimateVisualLabelLines(label, 88)).toBe(3);
    const geometry = getVisualGeometry('hierarchy', 320, [label, label, label, label, label, label]);
    expect(geometry.height).toBeGreaterThan(300);
  });
});
