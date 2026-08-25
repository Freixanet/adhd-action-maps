import { describe, expect, it } from 'vitest';
import { themeColor } from './design-tokens';

describe('home ambient wash', () => {
  it('keeps the lavender bloom at 8% in both schemes', () => {
    expect(themeColor.dark.orb.homeAmbient).toBe('rgba(139,143,245,0.08)');
    expect(themeColor.light.orb.homeAmbient).toBe('rgba(91,96,212,0.08)');
  });
});
