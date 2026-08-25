import { describe, expect, it } from 'vitest';
import { motion } from './design-tokens';

describe('press motion tokens', () => {
  it('uses a 0.975 scale with a short in/out and no opacity fade', () => {
    expect(motion.press.scale).toBe(0.975);
    expect(motion.press.in).toBe(90);
    expect(motion.press.out).toBe(160);
    expect('fade' in motion.press).toBe(false);
  });
});
