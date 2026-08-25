/**
 * Persist active application plan digests per owner+map (CAS across restarts).
 * No tokens or secrets.
 */

import { getStorage } from '../storage';

function keyForUser(userId: string): string {
  return `nucleo_active_plan_digest:user:${userId.trim()}`;
}

export function loadActivePlanDigests(userId: string): Record<string, string> {
  const id = userId.trim();
  if (!id) return {};
  try {
    const raw = getStorage().getItem(keyForUser(id));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [mapId, digest] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof digest === 'string' && digest.length >= 8) out[mapId] = digest;
    }
    return out;
  } catch {
    return {};
  }
}

export function getActivePlanDigest(userId: string, mapId: string): string | null {
  const digests = loadActivePlanDigests(userId);
  return digests[mapId] ?? null;
}

export function setActivePlanDigest(userId: string, mapId: string, digest: string): void {
  const id = userId.trim();
  if (!id || !mapId || digest.length < 8) return;
  const next = { ...loadActivePlanDigests(id), [mapId]: digest };
  try {
    getStorage().setItem(keyForUser(id), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearActivePlanDigest(userId: string, mapId: string): void {
  const id = userId.trim();
  if (!id || !mapId) return;
  const next = { ...loadActivePlanDigests(id) };
  delete next[mapId];
  try {
    getStorage().setItem(keyForUser(id), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearActivePlanDigestsForUser(userId: string): void {
  try {
    getStorage().removeItem(keyForUser(userId.trim()));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the digest the client believes is active on cloud for CAS.
 * Prefer persisted store, then in-memory, then local P1 core (only when no cloud known).
 */
export function resolvePreviousPlanDigest(args: {
  userId?: string | null;
  mapId: string;
  memoryDigest?: string | null;
  localActiveArtifactDigest?: string | null;
}): string | null {
  if (args.userId) {
    const stored = getActivePlanDigest(args.userId, args.mapId);
    if (stored) return stored;
  }
  if (args.memoryDigest && args.memoryDigest.length >= 8) return args.memoryDigest;
  if (args.localActiveArtifactDigest && args.localActiveArtifactDigest.length >= 8) {
    return args.localActiveArtifactDigest;
  }
  return null;
}
