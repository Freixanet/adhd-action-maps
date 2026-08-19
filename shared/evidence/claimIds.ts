/**
 * Stable claim IDs — model never controls them.
 */

import { sha256Hex } from '../sha256Hex';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from './versions';

export function buildClaimIdentitySeed(args: {
  contentHash: string;
  sourceVersionId?: string;
  depth?: string;
}): string {
  return sha256Hex(
    [
      args.contentHash,
      args.sourceVersionId ?? '',
      EVIDENCE_SCHEMA_VERSION,
      EVIDENCE_PROMPT_VERSION,
      EVIDENCE_VERIFIER_VERSION,
      EVIDENCE_COMPILER_VERSION,
      args.depth ?? 'estandar',
    ].join('|')
  ).slice(0, 24);
}

export function stableClaimId(seed: string, slotKey: string, index: number): string {
  const h = sha256Hex(`${seed}|${slotKey}|${index}`).slice(0, 12);
  return `cl_${h}`;
}

export function stableEvidenceLinkId(claimId: string, chunkId: string, relation: string): string {
  const h = sha256Hex(`${claimId}|${chunkId}|${relation}`).slice(0, 12);
  return `ev_${h}`;
}
