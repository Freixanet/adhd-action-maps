import { describe, expect, it } from 'vitest';
import { rubberband, rubberbandOffset } from '../mobile/src/logic/motionWorklets';

describe('rubberbandOffset', () => {
  it('passes through values inside the range', () => {
    expect(rubberbandOffset(120, 0, 300, 300)).toBe(120);
  });

  it('resists past the max instead of clamping dead', () => {
    const overshoot = rubberbandOffset(360, 0, 300, 300);
    expect(overshoot).toBeGreaterThan(300);
    expect(overshoot).toBeLessThan(360);
    expect(overshoot).toBe(300 + rubberband(60, 300));
  });

  it('resists past the min', () => {
    const undershoot = rubberbandOffset(-40, 0, 300, 300);
    expect(undershoot).toBeLessThan(0);
    expect(undershoot).toBeGreaterThan(-40);
  });
});
