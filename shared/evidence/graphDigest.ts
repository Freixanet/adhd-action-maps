/**
 * Canonical evidence graph digest — same string format in TS and SQL.
 * Server recomputes; never trust a client-only hash as authority.
 */

import { sha256Hex } from '../sha256Hex';
import type { EvidenceArtifact } from './types';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_MODEL_ROUTE,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from './versions';

export type DigestNode = {
  claim_id: string;
  unit_id: string | null;
  claim_text: string;
  claim_type: string;
  criticality: string;
  epistemic_status: string;
  presentation_status: string;
  abstention_codes: string[];
};

export type DigestLink = {
  content_node_claim_id: string;
  chunk_id: string;
  relation: string;
  verifier_status: string;
  epistemic_status: string;
  verifier_version: string;
  check_codes: string[];
  abstention_codes: string[];
  link_key: string;
};

export type GraphDigestInput = {
  mapId: string;
  sourceId: string | null;
  sourceVersionId: string | null;
  contentHash: string | null;
  schemaVersion: string;
  promptVersion: string;
  verifierVersion: string;
  compilerVersion: string;
  modelRoute: string;
  nodes: DigestNode[];
  links: DigestLink[];
};

function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\|/g, '\\|');
}

function sortedCodes(codes: string[]): string {
  return [...codes].map(String).sort().join(',');
}

/**
 * Line-oriented canonical form (must match SQL in persist_evidence_graph).
 * Null/empty pins become empty fields.
 */
export function canonicalizeEvidenceGraph(input: GraphDigestInput): string {
  const lines: string[] = [
    `mapId=${esc(input.mapId)}`,
    `sourceId=${esc(input.sourceId)}`,
    `sourceVersionId=${esc(input.sourceVersionId)}`,
    `contentHash=${esc(input.contentHash)}`,
    `schemaVersion=${esc(input.schemaVersion)}`,
    `promptVersion=${esc(input.promptVersion)}`,
    `verifierVersion=${esc(input.verifierVersion)}`,
    `compilerVersion=${esc(input.compilerVersion)}`,
    `modelRoute=${esc(input.modelRoute)}`,
  ];

  const nodes = [...input.nodes].sort((a, b) => a.claim_id.localeCompare(b.claim_id));
  for (const n of nodes) {
    lines.push(
      [
        'NODE',
        esc(n.claim_id),
        esc(n.unit_id),
        esc(n.claim_text),
        esc(n.claim_type),
        esc(n.criticality),
        esc(n.epistemic_status),
        esc(n.presentation_status),
        esc(sortedCodes(n.abstention_codes ?? [])),
      ].join('|')
    );
  }

  const links = [...input.links].sort((a, b) => a.link_key.localeCompare(b.link_key));
  for (const l of links) {
    lines.push(
      [
        'LINK',
        esc(l.link_key),
        esc(l.content_node_claim_id),
        esc(l.chunk_id),
        esc(l.relation),
        esc(l.verifier_status),
        esc(l.epistemic_status),
        esc(l.verifier_version),
        esc(sortedCodes(l.check_codes ?? [])),
        esc(sortedCodes(l.abstention_codes ?? [])),
      ].join('|')
    );
  }

  return `${lines.join('\n')}\n`;
}

export function computeEvidenceGraphDigest(input: GraphDigestInput): string {
  return sha256Hex(canonicalizeEvidenceGraph(input));
}

export function nodesAndLinksFromArtifact(evidence: EvidenceArtifact): {
  nodes: DigestNode[];
  links: DigestLink[];
} {
  return {
    nodes: evidence.claims.map((claim) => ({
      claim_id: claim.id,
      unit_id: claim.unitId ?? null,
      claim_text: claim.presentationText || claim.text,
      claim_type: claim.claimType,
      criticality: claim.criticality,
      epistemic_status: claim.epistemicStatus,
      presentation_status: claim.presentationStatus,
      abstention_codes: [...claim.abstentionCodes],
    })),
    links: evidence.links.map((link) => ({
      content_node_claim_id: link.contentNodeId,
      chunk_id: link.chunkId,
      relation: link.relation,
      verifier_status: link.verifierStatus,
      epistemic_status: link.epistemicStatus,
      verifier_version: link.verifierVersion,
      check_codes: [...link.checkCodes],
      abstention_codes: [...link.abstentionCodes],
      link_key: link.id,
    })),
  };
}

export function digestForPersist(args: {
  mapId: string;
  sourceId?: string;
  sourceVersionId?: string;
  contentHash?: string;
  evidence: EvidenceArtifact;
}): { digest: string; nodes: DigestNode[]; links: DigestLink[]; canonical: string } {
  const { nodes, links } = nodesAndLinksFromArtifact(args.evidence);
  const input: GraphDigestInput = {
    mapId: args.mapId,
    sourceId: args.sourceId ?? null,
    sourceVersionId: args.sourceVersionId ?? null,
    contentHash: args.contentHash ?? null,
    schemaVersion: args.evidence.schemaVersion || EVIDENCE_SCHEMA_VERSION,
    promptVersion: args.evidence.promptVersion || EVIDENCE_PROMPT_VERSION,
    verifierVersion: args.evidence.verifierVersion || EVIDENCE_VERIFIER_VERSION,
    compilerVersion: args.evidence.compilerVersion || EVIDENCE_COMPILER_VERSION,
    modelRoute: args.evidence.modelRoute || EVIDENCE_MODEL_ROUTE,
    nodes,
    links,
  };
  const canonical = canonicalizeEvidenceGraph(input);
  return {
    digest: sha256Hex(canonical),
    nodes,
    links,
    canonical,
  };
}
