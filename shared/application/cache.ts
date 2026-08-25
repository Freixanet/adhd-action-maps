/**
 * Owner-scoped application cache.
 * Valid hit → zero provider calls. Corrupt entries are evicted.
 * Cache key includes versions, routing pin, source, depth, and canonical context hash.
 * Never logs personal context text.
 */

import type { ApplicationArtifactV1 } from './types';
import { applicationCacheKey } from './ids';
import { validateApplicationArtifact } from './validate';

type Entry = { ownerId: string; artifact: ApplicationArtifactV1; storedAt: number };
const store = new Map<string, Entry>();
const MAX = 64;

export { applicationCacheKey };

export function getApplicationCache(
  key: string,
  ownerId: string
): ApplicationArtifactV1 | null {
  const hit = store.get(key);
  if (!hit || hit.ownerId !== ownerId) return null;
  const validated = validateApplicationArtifact(hit.artifact, { strictVersions: true });
  if (!validated.ok) {
    store.delete(key);
    return null;
  }
  if (
    validated.value.status !== 'complete' &&
    validated.value.status !== 'provisional' &&
    validated.value.status !== 'needs_context' &&
    validated.value.status !== 'abstained'
  ) {
    store.delete(key);
    return null;
  }
  return validated.value;
}

export function setApplicationCache(
  key: string,
  ownerId: string,
  artifact: ApplicationArtifactV1
): void {
  const validated = validateApplicationArtifact(artifact, { strictVersions: true });
  if (!validated.ok) return;
  store.set(key, { ownerId, artifact: validated.value, storedAt: Date.now() });
  if (store.size > MAX) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
}

export function deleteApplicationCache(key: string): void {
  store.delete(key);
}

export function clearApplicationCache(): void {
  store.clear();
}
