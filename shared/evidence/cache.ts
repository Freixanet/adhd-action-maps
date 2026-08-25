/**
 * Owner-scoped evidence verification cache.
 * Retry of persistence must not re-call the verifier when cache hits.
 * Key includes every pin that can change the result.
 */

import { sha256Hex } from '../sha256Hex';
import type { EvidenceArtifact } from './types';

type Entry = { ownerId: string; artifact: EvidenceArtifact; storedAt: number };
const store = new Map<string, Entry>();
const MAX = 64;

export function evidenceCacheKey(args: {
  ownerId: string;
  contentHash: string;
  sourceVersionId?: string;
  depth?: string;
  schemaVersion: string;
  promptVersion: string;
  verifierVersion: string;
  compilerVersion: string;
  modelRoute: string;
}): string {
  return sha256Hex(
    [
      args.ownerId,
      args.contentHash,
      args.sourceVersionId ?? '',
      args.depth ?? '',
      args.schemaVersion,
      args.promptVersion,
      args.verifierVersion,
      args.compilerVersion,
      args.modelRoute,
    ].join('|')
  );
}

export function getEvidenceCache(
  key: string,
  ownerId: string
): EvidenceArtifact | null {
  const hit = store.get(key);
  if (!hit || hit.ownerId !== ownerId) return null;
  if (hit.artifact.status !== 'complete') return null;
  return hit.artifact;
}

export function setEvidenceCache(
  key: string,
  ownerId: string,
  artifact: EvidenceArtifact
): void {
  if (artifact.status !== 'complete') return;
  store.set(key, { ownerId, artifact, storedAt: Date.now() });
  if (store.size > MAX) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
}

export function clearEvidenceCache(): void {
  store.clear();
}
