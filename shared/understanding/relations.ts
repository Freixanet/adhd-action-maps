/**
 * Relation kind families + planned-edge matching (no global edgeBlob).
 */

export type RelationFamily =
  | 'causal'
  | 'contribution'
  | 'limitation'
  | 'contradiction'
  | 'response'
  | 'precedence'
  | 'enablement'
  | 'support'
  | 'other';

const KIND_TO_FAMILY: Record<string, RelationFamily> = {
  causes: 'causal',
  cause: 'causal',
  causa: 'causal',
  contributes: 'contribution',
  contribute: 'contribution',
  contribuye: 'contribution',
  limited_by: 'limitation',
  limits: 'limitation',
  limit: 'limitation',
  limita: 'limitation',
  contradicts: 'contradiction',
  contradict: 'contradiction',
  contradice: 'contradiction',
  answers: 'response',
  answer: 'response',
  responde: 'response',
  faces: 'response',
  precedes: 'precedence',
  precede: 'precedence',
  enables: 'enablement',
  enable: 'enablement',
  habilita: 'enablement',
  implies: 'support',
  supports: 'support',
  support: 'support',
  apoya: 'support',
};

export function relationFamily(kind: string): RelationFamily {
  const key = kind.trim().toLowerCase().replace(/\s+/g, '_');
  return KIND_TO_FAMILY[key] ?? 'other';
}

export function familiesCompatible(a: string, b: string): boolean {
  const fa = relationFamily(a);
  const fb = relationFamily(b);
  if (fa === 'other' || fb === 'other') {
    // Allow exact string match for undocumented kinds
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return fa === fb;
}

export type ConcreteEdge = {
  fromTitle: string;
  toTitle: string;
  fromId: string;
  toId: string;
  kind: string;
};

function titleMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  const ax = x.slice(0, 16);
  const ay = y.slice(0, 16);
  return x.includes(ay) || y.includes(ax);
}

/**
 * Each planned relation must match one concrete edge by origin, destination, and family.
 * No global blob matching across unrelated pairs.
 */
export function matchPlannedRelation(
  planned: { from: string; to: string; kind: string },
  edges: ConcreteEdge[]
): ConcreteEdge | null {
  for (const e of edges) {
    if (!titleMatch(e.fromTitle, planned.from)) continue;
    if (!titleMatch(e.toTitle, planned.to)) continue;
    if (!familiesCompatible(e.kind, planned.kind)) continue;
    return e;
  }
  return null;
}

const CAUSAL_HEDGE =
  /correlaci[oó]n|correlacion|puede\b|asocia|no prueba causalidad|no afirma.*causa|sin causalidad|posibilidad/i;

export type CausalGuardContext = {
  mustKeep: string[];
  limitsOrConditions: string[];
  doesNotClaim: string[];
  unitCautions: string[];
  unitExplanation: string;
  classificationUncertainties: string[];
};

/** True when material establishes correlation/possibility/non-causality. */
export function materialForbidsCausalClaim(ctx: CausalGuardContext): boolean {
  const blob = [
    ...ctx.mustKeep,
    ...ctx.limitsOrConditions,
    ...ctx.doesNotClaim,
    ...ctx.unitCautions,
    ctx.unitExplanation,
    ...ctx.classificationUncertainties,
  ].join('\n');
  return CAUSAL_HEDGE.test(blob);
}

/**
 * If material forbids causality and kind is causal family, degrade to contribution.
 * Deterministic — never silently hide only in UI.
 */
export function enforceCausalSemantics(
  kind: string,
  ctx: CausalGuardContext
): { kind: string; degraded: boolean } {
  if (relationFamily(kind) !== 'causal') {
    return { kind, degraded: false };
  }
  if (!materialForbidsCausalClaim(ctx)) {
    return { kind, degraded: false };
  }
  return { kind: 'contributes', degraded: true };
}
