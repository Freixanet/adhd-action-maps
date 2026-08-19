import { describe, expect, it, vi } from 'vitest';
import {
  EVIDENCE_PROVIDER_BREAKER_THRESHOLD,
  runBatchedEntailment,
  type BatchedClaimInput,
} from './batchEntailment';
import type { ContentClaim } from './types';
import type { CandidateChunk } from './retrieveCandidates';

function claim(id: string, text = 'Afirmación de prueba con texto suficiente'): ContentClaim {
  return {
    id,
    text,
    kind: 'fact',
    criticality: 'supporting',
    sourceLocator: { kind: 'chunk', chunkId: 'c1' },
  } as ContentClaim;
}

function candidates(): CandidateChunk[] {
  return [
    {
      chunk: { id: 'c1', text: 'texto fuente suficiente para el claim', ordinal: 0 },
      score: 1,
    } as CandidateChunk,
  ];
}

function items(n: number): BatchedClaimInput[] {
  return Array.from({ length: n }, (_, i) => ({
    claim: claim(`claim-${i}`),
    candidates: candidates(),
  }));
}

describe('runBatchedEntailment', () => {
  it('uses about 2–4 provider calls for many claims', async () => {
    const generateJson = vi.fn(async ({ user }: { user: string }) => {
      const ids = [...user.matchAll(/claimId: (claim-\d+)/g)].map((m) => m[1]!);
      return {
        text: JSON.stringify({
          results: ids.map((claimId) => ({
            claimId,
            decision: 'insufficient',
            chunkIds: [],
          })),
        }),
        model: 'test',
      };
    });

    const out = await runBatchedEntailment({
      items: items(58),
      generateJson,
      targetCalls: 3,
    });

    expect(out).toHaveLength(58);
    expect(generateJson.mock.calls.length).toBeLessThanOrEqual(4);
    expect(generateJson.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('opens circuit after repeated provider failures and stops calling', async () => {
    let calls = 0;
    const generateJson = vi.fn(async () => {
      calls += 1;
      throw new Error('PROVIDER_ERROR');
    });

    const out = await runBatchedEntailment({
      items: items(12),
      generateJson,
      targetCalls: 4,
    });

    expect(out).toHaveLength(12);
    expect(calls).toBeLessThanOrEqual(EVIDENCE_PROVIDER_BREAKER_THRESHOLD);
    expect(out.every((r) => r.error || r.decision === 'insufficient')).toBe(true);
  });

  it('retries on 429 then succeeds', async () => {
    let calls = 0;
    const generateJson = vi.fn(async ({ user }: { user: string }) => {
      calls += 1;
      if (calls === 1) throw new Error('429 rate limit');
      const ids = [...user.matchAll(/claimId: (claim-\d+)/g)].map((m) => m[1]!);
      return {
        text: JSON.stringify({
          results: ids.map((claimId) => ({
            claimId,
            decision: 'insufficient',
            chunkIds: [],
          })),
        }),
        model: 'test',
      };
    });

    const out = await runBatchedEntailment({
      items: items(2),
      generateJson,
      targetCalls: 1,
    });

    expect(out).toHaveLength(2);
    expect(calls).toBe(2);
  });
});
