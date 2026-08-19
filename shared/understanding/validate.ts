/**
 * Strict validators for S04 understanding artifacts.
 * Fail closed — never invent missing thesis/units/cautions.
 */

import type { MapDepth } from '../contracts';
import { understandingDepthBudget } from './depthLimits';
import { stableRelationId } from './relationIds';
import { essentialIdeaSearchText, normalizeEssentialIdeaItems } from '../tldr';
import type {
  UnderstandingArtifact,
  UnderstandingBlueprint,
  UnderstandingClassification,
  UnderstandingClosure,
  UnderstandingEssential,
  UnderstandingPlan,
  UnderstandingUnit,
  UnitRole,
  SourceGenre,
  DiscourseStructure,
  ScopeKnown,
  PendingSegmentRef,
} from './types';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
  UNDERSTANDING_SUPPORTED_COMPILER_VERSIONS,
  UNDERSTANDING_SUPPORTED_PROMPT_VERSIONS,
  UNDERSTANDING_SUPPORTED_SCHEMA_VERSIONS,
} from './versions';

const GENRES = new Set<SourceGenre>([
  'explanatory',
  'argumentative',
  'narrative',
  'procedural',
  'reference',
  'mixed',
  'unknown',
]);

const STRUCTURES = new Set<DiscourseStructure>([
  'causal',
  'conceptual',
  'comparative',
  'chronological',
  'problem_solution',
  'procedural',
  'mixed',
  'unknown',
]);

const SCOPES = new Set<ScopeKnown>(['complete', 'partial', 'unknown']);

const ROLES = new Set<UnitRole>([
  'thesis',
  'concept',
  'cause',
  'mechanism',
  'relation',
  'evidence_described',
  'example',
  'counterargument',
  'caution',
  'limitation',
  'synthesis',
]);

const GENERIC_TITLES = /^(punto\s*\d+|introducci[oó]n|conclusi[oó]n|secci[oó]n\s*\d+|unit\s*\d+|step\s*\d+|idea\s*\d+)$/i;

export type ValidateOk<T> = { ok: true; value: T };
export type ValidateFail = { ok: false; errors: string[] };
export type ValidateResult<T> = ValidateOk<T> | ValidateFail;

function validationErrors(result: { ok: boolean; errors?: string[] }): string[] {
  if (result.ok) return [];
  return Array.isArray(result.errors) ? result.errors : [];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (!isNonEmptyString(item)) return null;
    out.push(item.trim());
  }
  return out;
}

export function validateClassification(raw: unknown): ValidateResult<UnderstandingClassification> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['classification missing'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (!GENRES.has(o.genre as SourceGenre)) errors.push('classification.genre invalid');
  if (!STRUCTURES.has(o.discourseStructure as DiscourseStructure)) {
    errors.push('classification.discourseStructure invalid');
  }
  if (!isNonEmptyString(o.language)) errors.push('classification.language required');
  if (!SCOPES.has(o.scopeKnown as ScopeKnown)) errors.push('classification.scopeKnown invalid');
  const uncertainties = asStringArray(o.uncertainties);
  if (!uncertainties) errors.push('classification.uncertainties must be string[]');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      genre: o.genre as SourceGenre,
      discourseStructure: o.discourseStructure as DiscourseStructure,
      language: String(o.language).trim(),
      scopeKnown: o.scopeKnown as ScopeKnown,
      uncertainties: uncertainties!,
    },
  };
}

export function validatePlan(raw: unknown): ValidateResult<UnderstandingPlan> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['plan missing'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(o.centralQuestion)) errors.push('plan.centralQuestion required');
  const thesis =
    o.thesisOrPurpose === 'unknown'
      ? 'unknown'
      : isNonEmptyString(o.thesisOrPurpose)
        ? o.thesisOrPurpose.trim()
        : null;
  if (thesis === null) errors.push('plan.thesisOrPurpose required');
  const unitOrder = asStringArray(o.unitOrder);
  if (!unitOrder || unitOrder.length < 1) errors.push('plan.unitOrder required');
  if (unitOrder?.some((t) => GENERIC_TITLES.test(t))) {
    errors.push('plan.unitOrder has generic titles');
  }
  const mustKeep = asStringArray(o.mustKeep);
  if (!mustKeep) errors.push('plan.mustKeep must be string[]');

  const relationsToPreserve: UnderstandingPlan['relationsToPreserve'] = [];
  if (!Array.isArray(o.relationsToPreserve)) {
    errors.push('plan.relationsToPreserve must be array');
  } else {
    for (const r of o.relationsToPreserve) {
      if (!r || typeof r !== 'object') {
        errors.push('plan.relationsToPreserve item invalid');
        break;
      }
      const rel = r as Record<string, unknown>;
      if (!isNonEmptyString(rel.from) || !isNonEmptyString(rel.to) || !isNonEmptyString(rel.kind)) {
        errors.push('plan.relationsToPreserve fields required');
        break;
      }
      relationsToPreserve.push({
        from: rel.from.trim(),
        to: rel.to.trim(),
        kind: rel.kind.trim(),
      });
    }
  }

  const excludedNoise: UnderstandingPlan['excludedNoise'] = [];
  if (!Array.isArray(o.excludedNoise)) {
    errors.push('plan.excludedNoise must be array');
  } else {
    for (const n of o.excludedNoise) {
      if (!n || typeof n !== 'object') {
        errors.push('plan.excludedNoise item invalid');
        break;
      }
      const item = n as Record<string, unknown>;
      if (!isNonEmptyString(item.item) || !isNonEmptyString(item.reason)) {
        errors.push('plan.excludedNoise fields required');
        break;
      }
      excludedNoise.push({ item: item.item.trim(), reason: item.reason.trim() });
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      centralQuestion: String(o.centralQuestion).trim(),
      thesisOrPurpose: thesis as string | 'unknown',
      unitOrder: unitOrder!,
      relationsToPreserve,
      mustKeep: mustKeep!,
      excludedNoise,
    },
  };
}

export function validateEssential(raw: unknown): ValidateResult<UnderstandingEssential> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['essential missing'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(o.nuclearIdea)) errors.push('essential.nuclearIdea required');
  // Soft: accept structured {title,desc} or legacy strings; cap at 4 without failing the map.
  const essentialIdeas = normalizeEssentialIdeaItems(o.essentialIdeas);
  if (essentialIdeas.length < 1) errors.push('essential.essentialIdeas required');
  const limitsOrConditions = asStringArray(o.limitsOrConditions);
  if (!limitsOrConditions) errors.push('essential.limitsOrConditions must be string[]');
  const doesNotClaim = asStringArray(o.doesNotClaim);
  if (!doesNotClaim) errors.push('essential.doesNotClaim must be string[]');
  if (!isNonEmptyString(o.layer0Synthesis)) errors.push('essential.layer0Synthesis required');
  if (!isNonEmptyString(o.layer0Why)) errors.push('essential.layer0Why required');
  if (!Array.isArray(o.layer0Actions) || o.layer0Actions.length !== 3) {
    errors.push('essential.layer0Actions must have exactly 3 items');
  } else if (!o.layer0Actions.every((a) => isNonEmptyString(a))) {
    errors.push('essential.layer0Actions items must be non-empty strings');
  }
  if (errors.length) return { ok: false, errors };
  const actions = (o.layer0Actions as string[]).map((a) => a.trim()) as [string, string, string];
  return {
    ok: true,
    value: {
      nuclearIdea: String(o.nuclearIdea).trim(),
      essentialIdeas,
      limitsOrConditions: limitsOrConditions!,
      doesNotClaim: doesNotClaim!,
      layer0Synthesis: String(o.layer0Synthesis).trim(),
      layer0Why: String(o.layer0Why).trim(),
      layer0Actions: actions,
    },
  };
}

export function validateBlueprint(raw: unknown): ValidateResult<UnderstandingBlueprint> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['blueprint missing'] };
  const o = raw as Record<string, unknown>;
  const c = validateClassification(o.classification);
  const p = validatePlan(o.plan);
  const e = validateEssential(o.essential);
  const errors: string[] = [
    ...validationErrors(c),
    ...validationErrors(p),
    ...validationErrors(e),
  ];
  if (errors.length) return { ok: false, errors };
  if (!c.ok || !p.ok || !e.ok) return { ok: false, errors: ['blueprint invalid'] };
  return {
    ok: true,
    value: {
      classification: c.value,
      plan: p.value,
      essential: e.value,
    },
  };
}

function validateSegmentRefs(
  raw: unknown,
  allowedChunkIds: Set<string>
): ValidateResult<PendingSegmentRef[]> {
  if (!Array.isArray(raw)) return { ok: false, errors: ['segmentRefs must be array'] };
  const out: PendingSegmentRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, errors: ['segmentRefs item invalid'] };
    }
    const o = item as Record<string, unknown>;
    if (!isNonEmptyString(o.chunkId)) {
      return { ok: false, errors: ['segmentRefs.chunkId required'] };
    }
    if (o.status !== 'pending') {
      return { ok: false, errors: ['segmentRefs.status must be pending (S04)'] };
    }
    if (!allowedChunkIds.has(o.chunkId.trim())) {
      return { ok: false, errors: [`hallucinated chunkId: ${o.chunkId}`] };
    }
    out.push({ chunkId: o.chunkId.trim(), status: 'pending' });
  }
  return { ok: true, value: out };
}

export function validateUnits(
  raw: unknown,
  opts: { depth?: MapDepth; allowedChunkIds: Set<string>; blueprint: UnderstandingBlueprint }
): ValidateResult<UnderstandingUnit[]> {
  if (!Array.isArray(raw)) return { ok: false, errors: ['units must be array'] };
  const budget = understandingDepthBudget(opts.depth);
  const errors: string[] = [];
  if (raw.length < budget.minUnits || raw.length > budget.maxUnits) {
    errors.push(`units count ${raw.length} outside ${budget.minUnits}–${budget.maxUnits}`);
  }

  const units: UnderstandingUnit[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object') {
      errors.push(`unit ${i} invalid`);
      continue;
    }
    const o = item as Record<string, unknown>;
    if (!isNonEmptyString(o.id)) errors.push(`unit ${i} id required`);
    if (isNonEmptyString(o.id) && seenIds.has(o.id.trim())) errors.push(`unit ${i} duplicate id`);
    if (!isNonEmptyString(o.title)) errors.push(`unit ${i} title required`);
    if (isNonEmptyString(o.title) && GENERIC_TITLES.test(o.title)) {
      errors.push(`unit ${i} generic title`);
    }
    if (isNonEmptyString(o.title)) {
      const key = o.title.trim().toLowerCase();
      if (seenTitles.has(key)) errors.push(`unit ${i} duplicate title`);
      seenTitles.add(key);
    }
    if (!ROLES.has(o.role as UnitRole)) errors.push(`unit ${i} role invalid`);
    if (!isNonEmptyString(o.explanation)) errors.push(`unit ${i} explanation required`);
    const examples = asStringArray(o.examples);
    if (!examples) errors.push(`unit ${i} examples must be string[]`);
    if (examples && examples.length > budget.maxExamplesPerUnit) {
      errors.push(`unit ${i} too many examples`);
    }
    const cautions = asStringArray(o.cautions);
    if (!cautions) errors.push(`unit ${i} cautions must be string[]`);
    const refs = validateSegmentRefs(o.segmentRefs ?? [], opts.allowedChunkIds);
    if (!refs.ok) errors.push(...validationErrors(refs).map((err) => `unit ${i}: ${err}`));
    const incomplete = o.incomplete === true;
    if (incomplete && !isNonEmptyString(o.incompleteReason)) {
      errors.push(`unit ${i} incompleteReason required when incomplete`);
    }

    const relations: UnderstandingUnit['relations'] = [];
    if (!Array.isArray(o.relations)) {
      errors.push(`unit ${i} relations must be array`);
    } else {
      for (const r of o.relations) {
        if (!r || typeof r !== 'object') {
          errors.push(`unit ${i} relation invalid`);
          break;
        }
        const rel = r as Record<string, unknown>;
        if (!isNonEmptyString(rel.toUnitId) || !isNonEmptyString(rel.kind)) {
          errors.push(`unit ${i} relation fields required`);
          break;
        }
        const toUnitId = rel.toUnitId.trim();
        const kind = rel.kind.trim();
        const unitId = isNonEmptyString(o.id) ? o.id.trim() : `unit_${i}`;
        const emitOrdinal = relations.length;
        const id = isNonEmptyString(rel.id)
          ? rel.id.trim()
          : stableRelationId(unitId, toUnitId, kind, emitOrdinal);
        relations.push({
          id,
          toUnitId,
          kind,
        });
      }
    }

    if (isNonEmptyString(o.id)) seenIds.add(o.id.trim());
    if (
      isNonEmptyString(o.id) &&
      isNonEmptyString(o.title) &&
      ROLES.has(o.role as UnitRole) &&
      isNonEmptyString(o.explanation) &&
      examples &&
      cautions &&
      refs.ok
    ) {
      units.push({
        id: o.id.trim(),
        title: o.title.trim(),
        role: o.role as UnitRole,
        explanation: o.explanation.trim(),
        relations,
        examples,
        cautions,
        segmentRefs: refs.value,
        incomplete,
        incompleteReason: incomplete ? String(o.incompleteReason).trim() : undefined,
      });
    }
  }

  // Relation targets must exist.
  const idSet = new Set(units.map((u) => u.id));
  for (const u of units) {
    for (const r of u.relations) {
      if (!idSet.has(r.toUnitId)) {
        errors.push(`unit ${u.id} relation to unknown ${r.toUnitId}`);
      }
    }
  }

  // Relation count vs depth budget
  let relationCount = 0;
  for (const u of units) relationCount += u.relations.length;
  if (relationCount > budget.maxRelations) {
    errors.push(`relations ${relationCount} exceed maxRelations ${budget.maxRelations}`);
  }

  // Every mustKeep caution must appear in some unit caution or explanation.
  for (const keep of opts.blueprint.plan.mustKeep) {
    const needle = keep.trim().toLowerCase();
    if (!needle) continue;
    const found = units.some(
      (u) =>
        u.cautions.some((c) => c.toLowerCase().includes(needle) || needle.includes(c.toLowerCase())) ||
        u.explanation.toLowerCase().includes(needle) ||
        u.title.toLowerCase().includes(needle)
    );
    if (!found) {
      // Soft semantic: also accept substring overlap of significant tokens
      const tokens = needle.split(/\s+/).filter((t) => t.length > 4);
      const soft = tokens.length
        ? units.some((u) => {
            const hay = `${u.title} ${u.explanation} ${u.cautions.join(' ')}`.toLowerCase();
            return tokens.filter((t) => hay.includes(t)).length >= Math.min(2, tokens.length);
          })
        : false;
      if (!soft) errors.push(`mustKeep not preserved: ${keep}`);
    }
  }

  // Every essential idea should surface in a unit.
  for (const idea of opts.blueprint.essential.essentialIdeas) {
    const needle = essentialIdeaSearchText(idea).toLowerCase();
    const found = units.some((u) => {
      const hay = `${u.title} ${u.explanation}`.toLowerCase();
      return hay.includes(needle) || needle.split(/\s+/).filter((t) => t.length > 4).some((t) => hay.includes(t));
    });
    if (!found) errors.push(`essential idea missing from units: ${essentialIdeaSearchText(idea)}`);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: units };
}

export function validateClosure(raw: unknown): ValidateResult<UnderstandingClosure> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['closure missing'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(o.finalSynthesis)) errors.push('closure.finalSynthesis required');
  const mainLearnings = asStringArray(o.mainLearnings);
  if (!mainLearnings || mainLearnings.length < 1) errors.push('closure.mainLearnings required');
  const openQuestions = asStringArray(o.openQuestions);
  if (!openQuestions) errors.push('closure.openQuestions must be string[]');
  if (!isNonEmptyString(o.reviewPrompt)) errors.push('closure.reviewPrompt required');
  const comprehensionLimits = asStringArray(o.comprehensionLimits);
  if (!comprehensionLimits) errors.push('closure.comprehensionLimits must be string[]');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      finalSynthesis: String(o.finalSynthesis).trim(),
      mainLearnings: mainLearnings!,
      openQuestions: openQuestions!,
      reviewPrompt: String(o.reviewPrompt).trim(),
      comprehensionLimits: comprehensionLimits!,
    },
  };
}

export function validateArtifact(
  raw: unknown,
  opts: {
    allowedChunkIds: Set<string>;
    depth?: MapDepth;
    /** When true (default), require exact supported schema/prompt/compiler versions. */
    strictVersions?: boolean;
  }
): ValidateResult<UnderstandingArtifact> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['artifact missing'] };
  const o = raw as Record<string, unknown>;
  const strict = opts.strictVersions !== false;
  const errors: string[] = [];

  if (typeof o.schemaVersion !== 'string' || !o.schemaVersion.trim()) {
    errors.push('schemaVersion required');
  } else if (strict && !UNDERSTANDING_SUPPORTED_SCHEMA_VERSIONS.has(o.schemaVersion)) {
    errors.push(`unsupported schemaVersion: ${o.schemaVersion}`);
  }
  if (typeof o.promptVersion !== 'string' || !o.promptVersion.trim()) {
    errors.push('promptVersion required');
  } else if (strict && !UNDERSTANDING_SUPPORTED_PROMPT_VERSIONS.has(o.promptVersion)) {
    errors.push(`unsupported promptVersion: ${o.promptVersion}`);
  }
  if (typeof o.compilerVersion !== 'string' || !o.compilerVersion.trim()) {
    errors.push('compilerVersion required');
  } else if (strict && !UNDERSTANDING_SUPPORTED_COMPILER_VERSIONS.has(o.compilerVersion)) {
    errors.push(`unsupported compilerVersion: ${o.compilerVersion}`);
  }
  if (typeof o.modelVersion !== 'string' || !o.modelVersion.trim()) {
    errors.push('modelVersion required');
  }
  if (o.intent !== 'understand') errors.push('intent must be understand');
  const depth =
    o.depth === 'rapido' || o.depth === 'estandar' || o.depth === 'profundo'
      ? o.depth
      : null;
  if (!depth) errors.push('depth invalid');
  if (
    o.status !== 'complete' &&
    o.status !== 'essential_only' &&
    o.status !== 'invalid' &&
    o.status !== 'cancelled'
  ) {
    errors.push('status invalid');
  }
  // Hostile keys that must not rewrite semantics
  for (const hostile of ['__proto__', 'constructor', 'prototype']) {
    if (Object.prototype.hasOwnProperty.call(o, hostile)) {
      errors.push(`hostile property: ${hostile}`);
    }
  }

  if (errors.length) return { ok: false, errors };

  const bp = validateBlueprint(o.blueprint);
  if (!bp.ok) return { ok: false, errors: validationErrors(bp) };
  const units = validateUnits(o.units, {
    depth: depth!,
    allowedChunkIds: opts.allowedChunkIds,
    blueprint: bp.value,
  });
  if (!units.ok) return { ok: false, errors: validationErrors(units) };
  const closure = validateClosure(o.closure);
  if (!closure.ok) return { ok: false, errors: validationErrors(closure) };

  if (o.status === 'complete' && !o.closure) {
    return { ok: false, errors: ['complete status requires closure'] };
  }
  if (o.status === 'essential_only' && Array.isArray(o.units) && o.units.length > 0) {
    // Allow essential_only with empty units only
  }

  return {
    ok: true,
    value: {
      schemaVersion: String(o.schemaVersion),
      promptVersion: String(o.promptVersion),
      compilerVersion: String(o.compilerVersion),
      modelVersion: String(o.modelVersion),
      intent: 'understand',
      depth: depth!,
      status: o.status as UnderstandingArtifact['status'],
      sourceId: typeof o.sourceId === 'string' ? o.sourceId : undefined,
      sourceVersionId: typeof o.sourceVersionId === 'string' ? o.sourceVersionId : undefined,
      contentHash: typeof o.contentHash === 'string' ? o.contentHash : undefined,
      blueprint: bp.value,
      units: units.value,
      closure: closure.value,
    },
  };
}

function collectSegmentRefChunkIds(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.units)) return [];
  const ids: string[] = [];
  for (const u of o.units) {
    if (!u || typeof u !== 'object') continue;
    const refs = (u as { segmentRefs?: unknown }).segmentRefs;
    if (!Array.isArray(refs)) continue;
    for (const r of refs) {
      if (r && typeof r === 'object' && typeof (r as { chunkId?: unknown }).chunkId === 'string') {
        ids.push((r as { chunkId: string }).chunkId.trim());
      }
    }
  }
  return ids;
}

/**
 * Rehydration gate for external / persisted IR.
 * Never builds allowedChunkIds from the artifact's own segmentRefs.
 * Independent set required when any refs are present (manifest, citedChunks, caller).
 */
export function rehydrateUnderstanding(
  raw: unknown,
  opts?: {
    /** Independent chunk id set — never derived from the payload under validation. */
    allowedChunkIds?: Set<string>;
  }
): UnderstandingArtifact | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const independent = opts?.allowedChunkIds;
  const hasIndependent = Boolean(independent && independent.size > 0);
  const refIds = collectSegmentRefChunkIds(raw);

  // Pending-only: reject verified / non-pending refs before full validate
  if (Array.isArray(o.units)) {
    for (const u of o.units) {
      if (!u || typeof u !== 'object') continue;
      const refs = (u as { segmentRefs?: unknown }).segmentRefs;
      if (!Array.isArray(refs)) continue;
      for (const r of refs) {
        if (r && typeof r === 'object' && (r as { status?: unknown }).status !== 'pending') {
          return null;
        }
      }
    }
  }

  if (refIds.length > 0 && !hasIndependent) {
    // Refs present but no independent manifest → reject IR (keep legacy map body).
    return null;
  }

  const chunkIds = hasIndependent ? independent! : new Set<string>();
  const result = validateArtifact(raw, { allowedChunkIds: chunkIds, strictVersions: true });
  if (!result.ok) return null;
  if (result.value.status !== 'complete') return null;
  return result.value;
}
