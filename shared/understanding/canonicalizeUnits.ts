/**
 * Canonicalize model-local unit IDs → deterministic stable IDs and remap relations.
 * Uses versioned structural seed + slot keys (not free-form titles alone).
 */

import type { UnderstandingUnit } from './types';
import {
  buildUnitIdentitySeed,
  stableUnderstandingId,
  unitSlotKey,
  type UnitIdentitySeedArgs,
} from './ids';
import { stableRelationId } from './relationIds';

export type CanonicalizeUnitsResult =
  | { ok: true; units: UnderstandingUnit[]; idMap: Map<string, string>; seed: string }
  | { ok: false; errors: string[] };

export function canonicalizeUnits(
  units: UnderstandingUnit[],
  seedArgs: UnitIdentitySeedArgs,
  planUnitOrder?: string[]
): CanonicalizeUnitsResult {
  const errors: string[] = [];
  const seenLocal = new Set<string>();
  for (const u of units) {
    if (!u.id?.trim()) {
      errors.push('unit missing local id');
      continue;
    }
    if (seenLocal.has(u.id)) {
      errors.push(`duplicate local id: ${u.id}`);
    }
    seenLocal.add(u.id);
  }
  if (errors.length) return { ok: false, errors };

  const seed = buildUnitIdentitySeed(seedArgs);
  const idMap = new Map<string, string>();
  units.forEach((u, index) => {
    const slot = unitSlotKey({
      index,
      planUnitOrder,
      localId: u.id,
    });
    idMap.set(u.id, stableUnderstandingId(seed, slot, index));
  });

  const remapped: UnderstandingUnit[] = units.map((u) => {
    const stableId = idMap.get(u.id)!;
    const relations: UnderstandingUnit['relations'] = [];
    const edgeKeys = new Set<string>();
    for (const rel of u.relations ?? []) {
      const toStable = idMap.get(rel.toUnitId);
      if (!toStable) {
        errors.push(`relation target missing after canonicalize: ${rel.toUnitId}`);
        continue;
      }
      if (toStable === stableId) {
        errors.push(`self-relation rejected: ${u.title}`);
        continue;
      }
      const key = `${stableId}|${toStable}|${rel.kind.trim().toLowerCase()}`;
      if (edgeKeys.has(key)) {
        errors.push(`duplicate relation: ${key}`);
        continue;
      }
      edgeKeys.add(key);
      const emitOrdinal = relations.length;
      relations.push({
        id: stableRelationId(stableId, toStable, rel.kind.trim(), emitOrdinal),
        toUnitId: toStable,
        kind: rel.kind.trim(),
      });
    }
    return { ...u, id: stableId, relations };
  });

  if (errors.length) return { ok: false, errors };

  const idSet = new Set(remapped.map((u) => u.id));
  for (const u of remapped) {
    for (const r of u.relations) {
      if (!idSet.has(r.toUnitId)) {
        errors.push(`orphan relation to ${r.toUnitId}`);
      }
    }
  }
  if (errors.length) return { ok: false, errors };

  return { ok: true, units: remapped, idMap, seed };
}
