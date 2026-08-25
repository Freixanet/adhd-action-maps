/**
 * Owner-scoped in-memory cache for understanding artifacts.
 * Lookup uses routing pin (not live model id). Never shares across owners.
 */

import type { UnderstandingArtifact } from './types';
import { understandingCacheKey, type UnderstandingCacheKeyArgs } from './ids';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_MODEL_ROUTE,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
} from './versions';

type CacheEntry = {
  artifact: UnderstandingArtifact;
  ownerId: string;
  storedAt: number;
};

const store = new Map<string, CacheEntry>();
const MAX_ENTRIES = 64;

function keyFrom(args: {
  ownerId: string;
  contentHash: string;
  sourceId?: string;
  sourceVersionId?: string;
  depth: string;
}): string {
  const full: UnderstandingCacheKeyArgs = {
    ownerId: args.ownerId,
    contentHash: args.contentHash,
    sourceId: args.sourceId,
    sourceVersionId: args.sourceVersionId,
    intent: 'understand',
    depth: args.depth,
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    modelRoute: UNDERSTANDING_MODEL_ROUTE,
  };
  return understandingCacheKey(full);
}

export function getUnderstandingCache(args: {
  ownerId: string;
  contentHash: string;
  sourceId?: string;
  sourceVersionId?: string;
  depth: string;
}): UnderstandingArtifact | null {
  if (!args.ownerId || !args.contentHash) return null;
  const key = keyFrom(args);
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.ownerId !== args.ownerId) return null;
  if (hit.artifact.status !== 'complete') return null;
  return hit.artifact;
}

export function setUnderstandingCache(args: {
  ownerId: string;
  contentHash: string;
  sourceId?: string;
  sourceVersionId?: string;
  depth: string;
  artifact: UnderstandingArtifact;
}): void {
  if (!args.ownerId || !args.contentHash) return;
  if (args.artifact.status !== 'complete') return;
  const key = keyFrom(args);
  store.set(key, {
    artifact: args.artifact,
    ownerId: args.ownerId,
    storedAt: Date.now(),
  });
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
}

export function deleteUnderstandingCache(args: {
  ownerId: string;
  contentHash: string;
  sourceId?: string;
  sourceVersionId?: string;
  depth: string;
}): void {
  if (!args.ownerId || !args.contentHash) return;
  store.delete(keyFrom(args));
}

/** Test helper. */
export function clearUnderstandingCache(): void {
  store.clear();
}
