/**
 * Stable application IDs — model never controls persisted IDs.
 */

import { sha256Hex } from '../sha256Hex';
import {
  APPLICATION_COMPILER_VERSION,
  APPLICATION_MODEL_ROUTE,
  APPLICATION_POLICY_VERSION,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
} from './versions';
import type { ApplicationContextV1 } from './types';

export type ApplicationIdentitySeedArgs = {
  contentHash: string;
  sourceVersionId?: string;
  depth: string;
  contextCanonicalHash: string;
  evidenceDigest?: string;
  understandingSchemaVersion?: string;
  understandingPromptVersion?: string;
  understandingCompilerVersion?: string;
  evidenceSchemaVersion?: string;
  evidencePromptVersion?: string;
  evidenceVerifierVersion?: string;
  evidenceCompilerVersion?: string;
  schemaVersion?: string;
  promptVersion?: string;
  compilerVersion?: string;
  policyVersion?: string;
};

export function buildApplicationIdentitySeed(args: ApplicationIdentitySeedArgs): string {
  return sha256Hex(
    [
      args.contentHash,
      args.sourceVersionId ?? '',
      args.depth,
      args.contextCanonicalHash,
      args.evidenceDigest ?? '',
      args.understandingSchemaVersion ?? '',
      args.understandingPromptVersion ?? '',
      args.understandingCompilerVersion ?? '',
      args.evidenceSchemaVersion ?? '',
      args.evidencePromptVersion ?? '',
      args.evidenceVerifierVersion ?? '',
      args.evidenceCompilerVersion ?? '',
      args.schemaVersion ?? APPLICATION_SCHEMA_VERSION,
      args.promptVersion ?? APPLICATION_PROMPT_VERSION,
      args.compilerVersion ?? APPLICATION_COMPILER_VERSION,
      args.policyVersion ?? APPLICATION_POLICY_VERSION,
    ].join('|')
  ).slice(0, 24);
}

export function stableApplicationId(seed: string, slotKey: string, index: number): string {
  return `ap_${sha256Hex(`${seed}|${slotKey}|${index}`).slice(0, 12)}`;
}

export function stableCandidateId(seed: string, claimId: string, index: number): string {
  return `ac_${sha256Hex(`${seed}|cand|${claimId}|${index}`).slice(0, 12)}`;
}

export function stableAssumptionId(seed: string, slot: string, index: number): string {
  return `as_${sha256Hex(`${seed}|assume|${slot}|${index}`).slice(0, 12)}`;
}

export function stableActionId(seed: string, planSlot: string): string {
  return `aa_${sha256Hex(`${seed}|action|${planSlot}`).slice(0, 12)}`;
}

export function stableReviewId(seed: string, reviewedAt: string): string {
  return `ar_${sha256Hex(`${seed}|review|${reviewedAt}`).slice(0, 12)}`;
}

/**
 * Canonical context hash for cache keys.
 * Does NOT embed raw personal text in returned key material beyond the hash itself.
 */
export function canonicalContextHash(context: ApplicationContextV1 | null | undefined): string {
  const c = context ?? {};
  const parts = [
    (c.goal ?? '').trim().toLowerCase(),
    (c.situation ?? '').trim().toLowerCase(),
    (c.constraint ?? '').trim().toLowerCase(),
    (c.horizon ?? '').trim().toLowerCase(),
    ...(c.optionalConstraints ?? []).map((x) => x.trim().toLowerCase()).sort(),
  ];
  return sha256Hex(parts.join('\u0001')).slice(0, 32);
}

export function applicationCacheKey(args: {
  ownerId: string;
  contentHash: string;
  sourceVersionId?: string;
  depth: string;
  contextCanonicalHash: string;
  evidenceDigest: string;
  understandingSchemaVersion: string;
  understandingPromptVersion: string;
  understandingCompilerVersion: string;
  evidenceSchemaVersion: string;
  evidencePromptVersion: string;
  evidenceVerifierVersion: string;
  evidenceCompilerVersion: string;
  schemaVersion?: string;
  promptVersion?: string;
  compilerVersion?: string;
  policyVersion?: string;
  modelRoute?: string;
}): string {
  return sha256Hex(
    [
      args.ownerId,
      args.contentHash,
      args.sourceVersionId ?? '',
      args.depth,
      args.contextCanonicalHash,
      args.evidenceDigest,
      args.understandingSchemaVersion,
      args.understandingPromptVersion,
      args.understandingCompilerVersion,
      args.evidenceSchemaVersion,
      args.evidencePromptVersion,
      args.evidenceVerifierVersion,
      args.evidenceCompilerVersion,
      args.schemaVersion ?? APPLICATION_SCHEMA_VERSION,
      args.promptVersion ?? APPLICATION_PROMPT_VERSION,
      args.compilerVersion ?? APPLICATION_COMPILER_VERSION,
      args.policyVersion ?? APPLICATION_POLICY_VERSION,
      args.modelRoute ?? APPLICATION_MODEL_ROUTE,
    ].join('|')
  );
}
