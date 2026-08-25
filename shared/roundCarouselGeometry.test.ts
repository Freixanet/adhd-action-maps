import { describe, expect, it } from 'vitest';
import {
  ROUND_CAROUSEL_MIN_ITEMS,
  roundCarouselRadius,
} from '../mobile/src/logic/roundCarouselGeometry';

describe('roundCarouselRadius', () => {
  it('matches the Originkit formula for five 200pt faces', () => {
    const radius = roundCarouselRadius(200, 5, 3);
    const expected = (200 * 1.45) / (2 * Math.tan(Math.PI / 5));
    expect(radius).toBeCloseTo(expected, 6);
    expect(radius).toBeGreaterThan(150);
    expect(radius).toBeLessThan(250);
  });

  it('returns 0 when a ring cannot form', () => {
    expect(roundCarouselRadius(200, 1)).toBe(0);
    expect(ROUND_CAROUSEL_MIN_ITEMS).toBe(3);
  });
});
