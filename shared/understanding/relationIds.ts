/**
 * Stable relation identity shared by IR, comparison rows, and Conexión callouts.
 * Never use titles or free-form text as identity.
 */

import { sha256Hex } from '../sha256Hex';

/** Deterministic id for a compiled relation edge (emit ordinal among valid targets). */
export function stableRelationId(
  fromUnitId: string,
  toUnitId: string,
  kind: string,
  emitOrdinal: number
): string {
  const h = sha256Hex(
    `${fromUnitId}|${toUnitId}|${kind.trim().toLowerCase()}|${emitOrdinal}`
  ).slice(0, 16);
  return `rel_${h}`;
}
