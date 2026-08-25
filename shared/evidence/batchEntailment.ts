/**
 * Batched entailment verifier — 2–4 provider calls per Núcleo, not one per claim.
 * Deterministic checks still run per claim on selected chunk text.
 */

import type { ContentClaim, EntailmentDecision } from './types';
import type { CandidateChunk } from './retrieveCandidates';
import { buildVerifierContext } from './retrieveCandidates';
import type { EntailmentResult } from './policy';
import type { CheckCode } from './types';
import type { EvidenceJsonGenerator } from './entailment';
import { BATCH_ENTAILMENT_RESPONSE_SCHEMA } from './entailment';

/** Re-export so callers can wire the Gemini responseSchema. */
export { BATCH_ENTAILMENT_RESPONSE_SCHEMA };

export const EVIDENCE_BATCH_TARGET_CALLS = 3;
export const EVIDENCE_PROVIDER_BREAKER_THRESHOLD = 2;
export const EVIDENCE_429_MAX_RETRIES = 2;

export type BatchedClaimInput = {
  claim: ContentClaim;
  candidates: CandidateChunk[];
};

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('invalid_json');
  }
}

function sanitizeOne(
  raw: unknown,
  allowed: Set<string>
): { decision: EntailmentDecision; chunkIds: string[]; qualifierNote?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const decision = o.decision;
  if (
    decision !== 'supports' &&
    decision !== 'contradicts' &&
    decision !== 'qualifies' &&
    decision !== 'insufficient'
  ) {
    return null;
  }
  if (!Array.isArray(o.chunkIds)) return null;
  const chunkIds = o.chunkIds
    .filter((id): id is string => typeof id === 'string' && allowed.has(id.trim()))
    .map((id) => id.trim());
  if (
    (decision === 'supports' || decision === 'qualifies' || decision === 'contradicts') &&
    chunkIds.length === 0
  ) {
    return { decision: 'insufficient', chunkIds: [] };
  }
  return {
    decision,
    chunkIds,
    qualifierNote:
      typeof o.qualifierNote === 'string' && o.qualifierNote.trim()
        ? o.qualifierNote.trim()
        : undefined,
  };
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /429|rate.?limit|RESOURCE_EXHAUSTED|quota/i.test(msg);
}

function providerErrorResult(modelVersion = 'error'): EntailmentResult {
  return {
    decision: 'insufficient',
    chunkIds: [],
    modelVersion,
    checkCodes: ['ENTAILMENT_ERROR'] as CheckCode[],
    error: true,
  };
}

function partitionBatches<T>(items: T[], targetCalls: number): T[][] {
  if (items.length === 0) return [];
  const calls = Math.max(1, Math.min(targetCalls, items.length, 4));
  const size = Math.ceil(items.length / calls);
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function buildBatchUserPayload(items: BatchedClaimInput[]): string {
  const parts = items.map((item, index) => {
    const { userPayload } = buildVerifierContext(item.claim, item.candidates);
    return `### CLAIM ${index + 1}\nclaimId: ${item.claim.id}\n${userPayload}`;
  });
  return [
    'Verifica cada claim por separado. Responde SOLO JSON:',
    '{"results":[{"claimId":"...","decision":"supports|contradicts|qualifies|insufficient","chunkIds":["..."],"qualifierNote":"..."}]}',
    'Una entrada por claimId. chunkIds solo de allowedChunkIds del claim.',
    parts.join('\n\n'),
  ].join('\n\n');
}

async function generateWithBackoff(
  generateJson: EvidenceJsonGenerator,
  args: Parameters<EvidenceJsonGenerator>[0],
  isCancelled?: () => boolean
): Promise<{ text: string; model: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= EVIDENCE_429_MAX_RETRIES; attempt++) {
    if (isCancelled?.()) throw Object.assign(new Error('cancelled'), { code: 'EVIDENCE_CANCELLED' });
    try {
      return await generateJson(args);
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err) || attempt === EVIDENCE_429_MAX_RETRIES) throw err;
      const waitMs = 400 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

/**
 * Run batched entailment. Preserves input order in the returned array.
 * After PROVIDER_BREAKER_THRESHOLD consecutive batch failures, remaining
 * claims are marked insufficient without further provider calls.
 */
export async function runBatchedEntailment(args: {
  items: BatchedClaimInput[];
  generateJson: EvidenceJsonGenerator;
  isCancelled?: () => boolean;
  onHeartbeat?: (info: { processed: number; total: number }) => void;
  targetCalls?: number;
}): Promise<EntailmentResult[]> {
  const results = new Array<EntailmentResult>(args.items.length);
  if (args.items.length === 0) return results;

  const batches = partitionBatches(
    args.items.map((item, index) => ({ item, index })),
    args.targetCalls ?? EVIDENCE_BATCH_TARGET_CALLS
  );

  let consecutiveFailures = 0;
  let processed = 0;
  const total = args.items.length;
  args.onHeartbeat?.({ processed, total });

  for (const batch of batches) {
    if (args.isCancelled?.()) {
      for (const { index } of batch) {
        if (!results[index]) {
          results[index] = providerErrorResult('cancelled');
        }
      }
      continue;
    }

    if (consecutiveFailures >= EVIDENCE_PROVIDER_BREAKER_THRESHOLD) {
      for (const { index } of batch) {
        results[index] = providerErrorResult('circuit_open');
        processed += 1;
      }
      args.onHeartbeat?.({ processed, total });
      continue;
    }

    const allowedByClaim = new Map(
      batch.map(({ item }) => [
        item.claim.id,
        new Set(item.candidates.map((c) => c.chunk.id)),
      ])
    );

    const systemBound =
      batch[0] != null
        ? buildVerifierContext(batch[0].item.claim, batch[0].item.candidates).systemBound
        : 'Eres un verificador de evidencia.';

    try {
      const gen = await generateWithBackoff(
        args.generateJson,
        {
          stage: 'entailment',
          system: `${systemBound}\nResponde un lote JSON con results[] por claimId.`,
          user: buildBatchUserPayload(batch.map((b) => b.item)),
          maxOutputTokens: Math.min(2048, 256 + batch.length * 180),
        },
        args.isCancelled
      );

      const raw = parseJson(gen.text) as { results?: unknown };
      const byId = new Map<string, unknown>();
      if (Array.isArray(raw?.results)) {
        for (const row of raw.results) {
          if (row && typeof row === 'object' && typeof (row as { claimId?: unknown }).claimId === 'string') {
            byId.set((row as { claimId: string }).claimId, row);
          }
        }
      }

      let batchHadValid = false;
      const firstItem = batch[0]?.item;
      const classicFirst = firstItem
        ? sanitizeOne(
            raw,
            allowedByClaim.get(firstItem.claim.id) ?? new Set<string>()
          )
        : null;
      for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
        const { item, index } = batch[batchIndex]!;
        const allowed = allowedByClaim.get(item.claim.id) ?? new Set<string>();
        const parsed = sanitizeOne(byId.get(item.claim.id), allowed);
        if (parsed) {
          batchHadValid = true;
          results[index] = {
            decision: parsed.decision,
            chunkIds: parsed.chunkIds,
            qualifierNote: parsed.qualifierNote,
            modelVersion: gen.model,
            checkCodes: [],
          };
        } else if (batchIndex === 0 && classicFirst) {
          // Backward-compatible provider response: an old single-decision
          // shape can only be attributed safely to the first requested claim.
          // Never copy that decision onto the rest of the batch.
          if (classicFirst) {
            batchHadValid = true;
            results[index] = {
              decision: classicFirst.decision,
              chunkIds: classicFirst.chunkIds,
              qualifierNote: classicFirst.qualifierNote,
              modelVersion: gen.model,
              checkCodes: [],
            };
          }
        } else {
          results[index] = providerErrorResult(gen.model);
        }
        processed += 1;
      }

      if (batchHadValid) consecutiveFailures = 0;
      else consecutiveFailures += 1;
    } catch {
      consecutiveFailures += 1;
      for (const { index } of batch) {
        results[index] = providerErrorResult('error');
        processed += 1;
      }
    }

    args.onHeartbeat?.({ processed, total });
  }

  for (let i = 0; i < results.length; i++) {
    if (!results[i]) results[i] = providerErrorResult('missing');
  }
  return results;
}
