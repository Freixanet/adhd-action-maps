import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256Hex';
import { stableClaimId, buildClaimIdentitySeed } from './evidence/claimIds';

describe('sha256Hex portable', () => {
  it('matches node:crypto for ascii and unicode', () => {
    for (const s of ['', 'abc', 'Afirmación respaldada', 'emoji 🧠\nline']) {
      const node = createHash('sha256').update(s, 'utf8').digest('hex');
      expect(sha256Hex(s)).toBe(node);
    }
  });

  it('keeps claim id helpers stable', () => {
    const seed = buildClaimIdentitySeed({ contentHash: 'h1' });
    expect(seed).toHaveLength(24);
    expect(stableClaimId(seed, 'nuclear', 0)).toMatch(/^cl_[a-f0-9]{12}$/);
  });
});
