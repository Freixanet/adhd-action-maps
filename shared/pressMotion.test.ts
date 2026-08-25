import { describe, expect, it } from 'vitest';
import { motion } from './design-tokens';

describe('press motion tokens', () => {
  it('uses a 0.97 scale with a short in/out and a light fade', () => {
    expect(motion.press.scale).toBe(0.97);
    expect(motion.press.in).toBe(90);
    expect(motion.press.out).toBe(160);
    expect(motion.press.fade).toBe(0.25);
  });
});
