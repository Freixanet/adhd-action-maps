/**
 * Versioned entailment verifier — structured JSON only.
 * Provider failure → uncertain, never verified.
 */

import type { ContentClaim, EntailmentDecision } from './types';
import type { CandidateChunk } from './retrieveCandidates';
import { buildVerifierContext } from './retrieveCandidates';
import type { EntailmentResult } from './policy';
import type { CheckCode } from './types';

export type EvidenceJsonGenerator = (args: {
  stage: 'entailment' | 'repair';
  system: string;
  user: string;
  maxOutputTokens: number;
}) => Promise<{ text: string; model: string }>;

export const ENTAILMENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    decision: {
      type: 'string',
      enum: ['supports', 'contradicts', 'qualifies', 'insufficient'],
    },
    chunkIds: { type: 'array', items: { type: 'string' } },
    qualifierNote: { type: 'string' },
  },
  required: ['decision', 'chunkIds'],
} as const;

/** Batched verifier — one provider call covers many claims. */
export const BATCH_ENTAILMENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claimId: { type: 'string' },
          decision: {
            type: 'string',
            enum: ['supports', 'contradicts', 'qualifies', 'insufficient'],
          },
          chunkIds: { type: 'array', items: { type: 'string' } },
          qualifierNote: { type: 'string' },
        },
        required: ['claimId', 'decision', 'chunkIds'],
      },
    },
  },
  required: ['results'],
} as const;

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

function sanitizeDecision(
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
  // Model cannot introduce non-allowed IDs — drop them; if none left and decision needs chunk, insufficient
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

export async function runEntailment(args: {
  claim: ContentClaim;
  candidates: CandidateChunk[];
  generateJson: EvidenceJsonGenerator;
  isCancelled?: () => boolean;
}): Promise<EntailmentResult> {
  const allowed = new Set(args.candidates.map((c) => c.chunk.id));
  if (!args.candidates.length) {
    return {
      decision: 'insufficient',
      chunkIds: [],
      modelVersion: 'n/a',
      checkCodes: ['ENTAILMENT_INSUFFICIENT'] as CheckCode[],
    };
  }

  const { systemBound, userPayload } = buildVerifierContext(args.claim, args.candidates);

  const attempt = async (stage: 'entailment' | 'repair', previous?: unknown, errors?: string[]) => {
    const user =
      stage === 'repair'
        ? `${userPayload}\n\nReparación: errores=${JSON.stringify(errors ?? [])}\nprev=${JSON.stringify(previous)}`
        : userPayload;
    const gen = await args.generateJson({
      stage,
      system: systemBound,
      user,
      maxOutputTokens: 512,
    });
    return { raw: parseJson(gen.text), model: gen.model };
  };

  try {
    if (args.isCancelled?.()) {
      return {
        decision: 'insufficient',
        chunkIds: [],
        modelVersion: 'cancelled',
        checkCodes: ['ENTAILMENT_ERROR'],
        error: true,
      };
    }
    let { raw, model } = await attempt('entailment');
    let parsed = sanitizeDecision(raw, allowed);
    if (!parsed) {
      if (args.isCancelled?.()) {
        return {
          decision: 'insufficient',
          chunkIds: [],
          modelVersion: model,
          checkCodes: ['ENTAILMENT_ERROR'],
          error: true,
        };
      }
      const repaired = await attempt('repair', raw, ['schema invalid or hallucinated chunkIds']);
      model = repaired.model;
      parsed = sanitizeDecision(repaired.raw, allowed);
    }
    if (!parsed) {
      return {
        decision: 'insufficient',
        chunkIds: [],
        modelVersion: model,
        checkCodes: ['ENTAILMENT_ERROR'],
        error: true,
      };
    }
    return {
      decision: parsed.decision,
      chunkIds: parsed.chunkIds,
      qualifierNote: parsed.qualifierNote,
      modelVersion: model,
      checkCodes: [],
    };
  } catch {
    return {
      decision: 'insufficient',
      chunkIds: [],
      modelVersion: 'error',
      checkCodes: ['ENTAILMENT_ERROR'],
      error: true,
    };
  }
}
