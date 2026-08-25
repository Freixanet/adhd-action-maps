/**
 * Fail-closed runtime validation for ClaimSurfaceBinding.
 * Never throws — returns result objects.
 */

import type { ClaimSurfaceBinding } from './types';

export type SurfaceValidateOk<T> = { ok: true; value: T };
export type SurfaceValidateFail = { ok: false; errors: string[] };
export type SurfaceValidateResult<T> = SurfaceValidateOk<T> | SurfaceValidateFail;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Non-negative integer index (rejects decimals, negatives, strings, NaN). */
export function isSurfaceIndex(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && Number.isSafeInteger(v);
}

/**
 * Exhaustive discriminated validator. Unknown kinds / wrong types → fail-closed.
 */
export function validateClaimSurfaceBinding(
  raw: unknown
): SurfaceValidateResult<ClaimSurfaceBinding> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['surface binding must be object'] };
  }
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.kind)) {
    return { ok: false, errors: ['surface.kind required'] };
  }
  const kind = o.kind.trim();

  switch (kind) {
    case 'title':
    case 'coreIdea':
    case 'coreSupport':
    case 'layer0.what':
    case 'layer0.why':
      return { ok: true, value: { kind } };

    case 'layer0.action':
    case 'tldr':
    case 'coverage.limit':
      if (!isSurfaceIndex(o.index)) {
        return { ok: false, errors: [`${kind}.index must be non-negative integer`] };
      }
      return { ok: true, value: { kind, index: o.index } };

    case 'step.prose':
    case 'knowledge':
      if (!isNonEmptyString(o.unitId)) {
        return { ok: false, errors: [`${kind}.unitId required`] };
      }
      if (!isSurfaceIndex(o.sentenceIndex)) {
        return { ok: false, errors: [`${kind}.sentenceIndex must be non-negative integer`] };
      }
      return {
        ok: true,
        value: { kind, unitId: o.unitId.trim(), sentenceIndex: o.sentenceIndex },
      };

    case 'step.caution':
    case 'step.example':
      if (!isNonEmptyString(o.unitId)) {
        return { ok: false, errors: [`${kind}.unitId required`] };
      }
      if (!isSurfaceIndex(o.index)) {
        return { ok: false, errors: [`${kind}.index must be non-negative integer`] };
      }
      return {
        ok: true,
        value: { kind, unitId: o.unitId.trim(), index: o.index },
      };

    case 'step.relation':
      if (!isNonEmptyString(o.unitId)) {
        return { ok: false, errors: ['step.relation.unitId required'] };
      }
      if (!isNonEmptyString(o.toUnitId)) {
        return { ok: false, errors: ['step.relation.toUnitId required'] };
      }
      if (!isNonEmptyString(o.relKind)) {
        return { ok: false, errors: ['step.relation.relKind required'] };
      }
      return {
        ok: true,
        value: {
          kind: 'step.relation',
          unitId: o.unitId.trim(),
          toUnitId: o.toUnitId.trim(),
          relKind: o.relKind.trim(),
        },
      };

    case 'step.relation.callout':
    case 'step.relation.comparison':
      if (!isNonEmptyString(o.unitId)) {
        return { ok: false, errors: [`${kind}.unitId required`] };
      }
      if (!isNonEmptyString(o.relationId)) {
        return { ok: false, errors: [`${kind}.relationId required`] };
      }
      return {
        ok: true,
        value: {
          kind,
          unitId: o.unitId.trim(),
          relationId: o.relationId.trim(),
        },
      };

    case 'closure.summary':
      if (!isSurfaceIndex(o.sentenceIndex)) {
        return {
          ok: false,
          errors: ['closure.summary.sentenceIndex must be non-negative integer'],
        };
      }
      return { ok: true, value: { kind: 'closure.summary', sentenceIndex: o.sentenceIndex } };

    case 'closure.takeaway':
      if (!isSurfaceIndex(o.index)) {
        return { ok: false, errors: ['closure.takeaway.index must be non-negative integer'] };
      }
      return { ok: true, value: { kind: 'closure.takeaway', index: o.index } };

    default:
      return { ok: false, errors: [`unknown surface kind: ${kind}`] };
  }
}

export function validateClaimSurfaceBindings(
  raw: unknown
): SurfaceValidateResult<ClaimSurfaceBinding[]> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, errors: ['surfaces must be an array'] };
  }
  const out: ClaimSurfaceBinding[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = validateClaimSurfaceBinding(raw[i]);
    if (r.ok === false) {
      return { ok: false, errors: r.errors.map((e) => `surfaces[${i}]: ${e}`) };
    }
    out.push(r.value);
  }
  return { ok: true, value: out };
}

/** Safe parse for apply path — skips invalid entries, never throws. */
export function safeParseClaimSurfaceBindings(raw: unknown): ClaimSurfaceBinding[] {
  if (!Array.isArray(raw)) return [];
  const out: ClaimSurfaceBinding[] = [];
  for (const item of raw) {
    const r = validateClaimSurfaceBinding(item);
    if (r.ok) out.push(r.value);
  }
  return out;
}
