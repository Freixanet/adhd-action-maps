/**
 * Canonical digest of the evidence artifact used for S06 cache/identity.
 * Different evidence with the same contentHash must not reuse a plan.
 */

import { sha256Hex } from '../sha256Hex';
import type { EvidenceArtifact } from '../evidence/types';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from '../evidence/versions';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
} from '../understanding/versions';

export function evidenceArtifactDigest(evidence: EvidenceArtifact): string {
  const claims = evidence.claims
    .map((c) =>
      [
        c.id,
        c.presentationStatus,
        c.text,
        (c.evidenceLinkIds ?? []).join(','),
      ].join(':')
    )
    .sort()
    .join('|');
  const links = evidence.links
    .map((l) => [l.id, l.contentNodeId, l.chunkId, l.relation, l.verifierStatus].join(':'))
    .sort()
    .join('|');
  return sha256Hex(
    [
      evidence.schemaVersion,
      evidence.promptVersion,
      evidence.verifierVersion,
      evidence.compilerVersion,
      claims,
      links,
    ].join('\u0001')
  ).slice(0, 40);
}

export function authorizedChunkManifest(evidence: EvidenceArtifact): Set<string> {
  const ids = new Set<string>();
  for (const link of evidence.links) {
    if (link.chunkId) ids.add(link.chunkId);
  }
  return ids;
}

export function understandingVersionPins(args?: {
  schemaVersion?: string;
  promptVersion?: string;
  compilerVersion?: string;
}): { schema: string; prompt: string; compiler: string } {
  return {
    schema: args?.schemaVersion ?? UNDERSTANDING_SCHEMA_VERSION,
    prompt: args?.promptVersion ?? UNDERSTANDING_PROMPT_VERSION,
    compiler: args?.compilerVersion ?? UNDERSTANDING_COMPILER_VERSION,
  };
}

export function evidenceVersionPins(evidence?: EvidenceArtifact): {
  schema: string;
  prompt: string;
  verifier: string;
  compiler: string;
} {
  return {
    schema: evidence?.schemaVersion ?? EVIDENCE_SCHEMA_VERSION,
    prompt: evidence?.promptVersion ?? EVIDENCE_PROMPT_VERSION,
    verifier: evidence?.verifierVersion ?? EVIDENCE_VERIFIER_VERSION,
    compiler: evidence?.compilerVersion ?? EVIDENCE_COMPILER_VERSION,
  };
}
