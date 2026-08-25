import { describe, expect, it } from 'vitest';
import {
  BEAM_YELLOW_TINT,
  LOADING_BORDER_BEAM_VARIANTS,
  beamDashIntervals,
  beamLayerColors,
  roundRectPerimeter,
  shouldAnimateLoadingBorderBeam,
  shouldShowLoadingBorderBeam,
} from './loadingBorderBeam';

describe('loadingBorderBeam config', () => {
  it('exposes bounded full/compact variants with 2.4–2.8s orbits', () => {
    for (const key of ['full', 'compact'] as const) {
      const v = LOADING_BORDER_BEAM_VARIANTS[key];
      expect(v.durationMs).toBeGreaterThanOrEqual(2400);
      expect(v.durationMs).toBeLessThanOrEqual(2800);
      expect(v.trailRatio).toBeGreaterThan(0);
      expect(v.trailRatio).toBeLessThan(0.3);
      expect(v.canvasPad).toBeGreaterThan(0);
    }
    expect(LOADING_BORDER_BEAM_VARIANTS.compact.strength).toBeLessThan(
      LOADING_BORDER_BEAM_VARIANTS.full.strength
    );
  });

  it('computes rounded-rect perimeter and dash intervals that sum to the lap', () => {
    const p = roundRectPerimeter(300, 220, 24);
    expect(p).toBeGreaterThan(900);
    const [on, off] = beamDashIntervals(p, 0.14);
    expect(on + off).toBeCloseTo(p, 5);
    expect(on).toBeLessThan(off);
  });

  it('animates only when active and motion is allowed', () => {
    expect(shouldAnimateLoadingBorderBeam({ active: true, reduceMotion: false })).toBe(true);
    expect(shouldAnimateLoadingBorderBeam({ active: true, reduceMotion: true })).toBe(false);
    expect(shouldAnimateLoadingBorderBeam({ active: false, reduceMotion: false })).toBe(false);
  });

  it('shows only during generating — not ready/error/cancelled', () => {
    expect(shouldShowLoadingBorderBeam({ active: true })).toBe(true);
    expect(shouldShowLoadingBorderBeam({ active: true, status: 'generating' })).toBe(true);
    expect(shouldShowLoadingBorderBeam({ active: true, status: 'ready' })).toBe(false);
    expect(shouldShowLoadingBorderBeam({ active: true, status: 'error' })).toBe(false);
    expect(shouldShowLoadingBorderBeam({ active: true, status: 'cancelled' })).toBe(false);
    expect(shouldShowLoadingBorderBeam({ active: false, status: 'generating' })).toBe(false);
  });

  it('keeps yellow as a tint and lavender as the primary beam', () => {
    const colors = beamLayerColors(1);
    expect(colors.halo).toContain('139, 143, 245');
    expect(colors.peak).toContain('248, 249, 255');
    expect(BEAM_YELLOW_TINT).toContain('224, 180, 92');
    expect(BEAM_YELLOW_TINT).toMatch(/0\.2[0-9]/);
  });
});
