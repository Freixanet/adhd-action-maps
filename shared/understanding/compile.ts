/**
 * Deterministic compiler: UnderstandingArtifact → ActionMapData.
 * Does not invent thesis/units/cautions/relations absent from the artifact.
 */

import type {
  ActionMapData,
  KnowledgeSection,
  Layer0,
  MapStep,
  SourceKind,
  SourceReference,
  StepContentBlock,
  TLDRItem,
} from '../contracts';
import { TLDR_DEFAULT_COUNT } from '../contracts';
import { ensureLayer0 } from '../layer0';
import { normalizeMapData } from '../mapData';
import { softClipDeliveryMessage } from '../deliveryMessage';
import { normalizeTldrItems } from '../tldr';
import { understandingDepthBudget } from './depthLimits';
import type { SourceProvenance } from './provenance';
import {
  enforceCausalSemantics,
  matchPlannedRelation,
  materialForbidsCausalClaim,
  relationFamily,
  type ConcreteEdge,
  type CausalGuardContext,
} from './relations';
import type {
  UnderstandingArtifact,
  UnderstandingUnit,
} from './types';
import { stableRelationId } from './relationIds';
import { UNDERSTANDING_COMPILER_VERSION } from './versions';

export type CompileUnderstandingOptions = {
  sourceKind?: SourceKind;
  sourceLabel?: string;
  sourceUrl?: string;
  provenance?: SourceProvenance;
  /** When false, omit relation blocks (tests that the compiler must include them). */
  includeRelations?: boolean;
};

const RELATION_LABELS: Record<string, string> = {
  causes: 'causa / contribuye a',
  contributes: 'contribuye a',
  limited_by: 'queda limitado por',
  limits: 'limita',
  contradicts: 'contradice',
  answers: 'responde a',
  faces: 'enfrenta',
  precedes: 'precede a',
  enables: 'habilita',
  implies: 'implica',
  supports: 'apoya',
};

function relationLabel(kind: string): string {
  const key = kind.trim().toLowerCase();
  return RELATION_LABELS[key] ?? kind.trim();
}

function blueprintCausalContext(artifact: UnderstandingArtifact): Omit<
  CausalGuardContext,
  'unitCautions' | 'unitExplanation'
> {
  const bp = artifact.blueprint;
  return {
    mustKeep: bp.plan.mustKeep,
    limitsOrConditions: bp.essential.limitsOrConditions,
    doesNotClaim: bp.essential.doesNotClaim,
    classificationUncertainties: bp.classification.uncertainties,
  };
}

/** Explicit degrade of causal edges when material forbids causality. */
export function applyCausalGuards(artifact: UnderstandingArtifact): UnderstandingArtifact {
  const base = blueprintCausalContext(artifact);
  const units = artifact.units.map((u) => ({
    ...u,
    relations: u.relations.map((r) => {
      const { kind } = enforceCausalSemantics(r.kind, {
        ...base,
        unitCautions: u.cautions,
        unitExplanation: u.explanation,
      });
      return { ...r, kind };
    }),
  }));
  return { ...artifact, units };
}

function unitToStep(
  unit: UnderstandingUnit,
  allUnits: UnderstandingUnit[],
  opts: { includeRelations: boolean }
): MapStep {
  const byId = new Map(allUnits.map((u) => [u.id, u]));
  const refs: SourceReference[] = unit.segmentRefs.map((r) => ({
    label: 'Segmento de origen',
    locator: r.chunkId,
    chunkId: r.chunkId,
    note: 'Referencia pendiente de verificación',
  }));

  const content: StepContentBlock[] = [
    {
      type: 'prose',
      text: unit.explanation,
      kind: 'info',
      references: refs.length ? refs : undefined,
    },
  ];

  for (const example of unit.examples) {
    content.push({
      type: 'callout',
      text: example,
      kind: 'info',
      label: 'Ejemplo',
    });
  }

  for (const caution of unit.cautions) {
    content.push({
      type: 'callout',
      text: caution,
      kind: 'alert',
      label: 'Precaución',
    });
  }

  if (unit.incomplete && unit.incompleteReason) {
    content.push({
      type: 'callout',
      text: unit.incompleteReason,
      kind: 'alert',
      label: 'Matiz',
    });
  }

  if (opts.includeRelations && unit.relations.length) {
    const rows: { label: string; values: string[]; relationId: string }[] = [];
    const callouts: {
      type: 'callout';
      text: string;
      kind: 'info';
      label: 'Conexión';
      relationId: string;
    }[] = [];
    let emitOrdinal = 0;
    for (const rel of unit.relations) {
      const target = byId.get(rel.toUnitId);
      if (!target) continue;
      const relationId =
        rel.id && rel.id.trim().length > 0
          ? rel.id.trim()
          : stableRelationId(unit.id, rel.toUnitId, rel.kind, emitOrdinal);
      emitOrdinal += 1;
      rows.push({
        label: relationLabel(rel.kind),
        values: [unit.title, target.title],
        relationId,
      });
      callouts.push({
        type: 'callout',
        text: `«${unit.title}» ${relationLabel(rel.kind)} «${target.title}».`,
        kind: 'info',
        label: 'Conexión',
        relationId,
      });
    }
    if (rows.length) {
      content.push({
        type: 'comparison',
        columns: ['Desde', 'Hacia'],
        rows,
      });
      content.push(...callouts);
    }
  }

  return {
    id: unit.id,
    shortNav: unit.title.slice(0, 28),
    title: unit.title,
    time: '~3 min',
    content,
    purpose: unit.role,
    references: refs.length ? refs : undefined,
    selfCheck: `¿Qué aporta «${unit.title}» a la idea nuclear?`,
  };
}

function essentialToLayer0(artifact: UnderstandingArtifact): Layer0 {
  const e = artifact.blueprint.essential;
  return {
    what: e.layer0Synthesis,
    why: e.layer0Why,
    actions: e.layer0Actions.map((label, i) => ({
      id: `action-${i + 1}`,
      label,
    })),
  };
}

function essentialToTldr(artifact: UnderstandingArtifact): TLDRItem[] {
  return normalizeTldrItems(artifact.blueprint.essential.essentialIdeas);
}

function softDeliveryFromUnderstanding(
  nuclearIdea: string,
  sourceKind: SourceKind,
  sourceLabel: string,
  unitTitles: string[] = []
): string {
  const focus = nuclearIdea.trim();
  const label = sourceLabel.trim();
  const steps = unitTitles.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  if (label && focus && steps.length >= 2) {
    return softClipDeliveryMessage(
      `De «${label}» saqué un Núcleo en ${steps.length}+ pasos (${steps[0]}, ${steps[1]}…). Lo que queda: ${focus}`
    );
  }
  if (label && focus) {
    return softClipDeliveryMessage(`De «${label}», la lectura queda en esto: ${focus}`);
  }
  if (focus && steps.length >= 2) {
    return softClipDeliveryMessage(
      `Organicé la lectura en «${steps[0]}» y «${steps[1]}». Idea central: ${focus}`
    );
  }
  if (focus) {
    return softClipDeliveryMessage(`La lectura que te dejé gira en torno a esto: ${focus}`);
  }
  void sourceKind;
  return 'Ya tienes el Núcleo listo para abrirlo.';
}

function knowledgeFromUnits(units: UnderstandingUnit[]): KnowledgeSection[] {
  return units.slice(0, 6).map((u) => ({
    title: u.title,
    summary: u.explanation.slice(0, 220),
  }));
}

function concreteEdgesFromArtifact(artifact: UnderstandingArtifact): ConcreteEdge[] {
  const byId = new Map(artifact.units.map((u) => [u.id, u]));
  const edges: ConcreteEdge[] = [];
  for (const u of artifact.units) {
    for (const r of u.relations) {
      const target = byId.get(r.toUnitId);
      if (!target) continue;
      edges.push({
        fromTitle: u.title,
        toTitle: target.title,
        fromId: u.id,
        toId: r.toUnitId,
        kind: r.kind,
      });
    }
  }
  return edges;
}

/**
 * Each planned relation must match one concrete edge (origin, destination, family).
 * No global edgeBlob. Causal plan may be satisfied by contribution after explicit degrade.
 */
export function plannedRelationsRepresented(
  artifact: UnderstandingArtifact
): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  const edges = concreteEdgesFromArtifact(artifact);
  const base = blueprintCausalContext(artifact);

  for (const planned of artifact.blueprint.plan.relationsToPreserve) {
    const matched = matchPlannedRelation(planned, edges);
    if (matched) continue;

    // Explicit degradation path: planned causal + hedge → contribution on same pair.
    if (relationFamily(planned.kind) === 'causal') {
      const hedge = materialForbidsCausalClaim({
        ...base,
        unitCautions: artifact.units.flatMap((u) => u.cautions),
        unitExplanation: artifact.units.map((u) => u.explanation).join('\n'),
      });
      if (hedge) {
        const contrib = matchPlannedRelation(
          { ...planned, kind: 'contributes' },
          edges
        );
        if (contrib) continue;
      }
    }

    missing.push(`${planned.from} —[${planned.kind}]→ ${planned.to}`);
  }
  return missing.length ? { ok: false, missing } : { ok: true };
}

/**
 * Drop blueprint planned relations that units never materialized.
 * Model drift often plans edges that units omit; that must not hard-fail compile.
 */
export function softenUnrepresentedPlannedRelations(
  artifact: UnderstandingArtifact
): UnderstandingArtifact {
  const planned = artifact.blueprint.plan.relationsToPreserve;
  if (!planned.length) return artifact;

  const edges = concreteEdgesFromArtifact(artifact);
  const base = blueprintCausalContext(artifact);
  const kept = planned.filter((rel) => {
    if (matchPlannedRelation(rel, edges)) return true;
    if (relationFamily(rel.kind) === 'causal') {
      const hedge = materialForbidsCausalClaim({
        ...base,
        unitCautions: artifact.units.flatMap((u) => u.cautions),
        unitExplanation: artifact.units.map((u) => u.explanation).join('\n'),
      });
      if (
        hedge &&
        matchPlannedRelation({ ...rel, kind: 'contributes' }, edges)
      ) {
        return true;
      }
    }
    return false;
  });

  if (kept.length === planned.length) return artifact;
  return {
    ...artifact,
    blueprint: {
      ...artifact.blueprint,
      plan: {
        ...artifact.blueprint.plan,
        relationsToPreserve: kept,
      },
    },
  };
}

export function assertCompileRelationInvariants(
  artifact: UnderstandingArtifact,
  map: ActionMapData
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const budget = understandingDepthBudget(artifact.depth);
  const idSet = new Set(artifact.units.map((u) => u.id));
  let relationCount = 0;
  const edgeKeys = new Set<string>();
  const base = blueprintCausalContext(artifact);

  for (const u of artifact.units) {
    for (const r of u.relations) {
      relationCount += 1;
      if (!idSet.has(r.toUnitId)) errors.push(`orphan toUnitId ${r.toUnitId}`);
      const key = `${u.id}|${r.toUnitId}|${r.kind}`;
      if (edgeKeys.has(key)) errors.push(`duplicate relation ${key}`);
      edgeKeys.add(key);

      if (relationFamily(r.kind) === 'causal') {
        const forbid = materialForbidsCausalClaim({
          ...base,
          unitCautions: u.cautions,
          unitExplanation: u.explanation,
        });
        if (forbid) {
          errors.push(`causal claim forbidden for ${u.id}→${r.toUnitId}`);
        }
      }
    }
  }
  if (relationCount > budget.maxRelations) {
    errors.push(`relations ${relationCount} exceed maxRelations ${budget.maxRelations}`);
  }

  const planned = plannedRelationsRepresented(artifact);
  if (planned.ok === false) {
    errors.push(...planned.missing.map((m) => `planned relation missing: ${m}`));
  }

  const irHasRelations = artifact.units.some((u) => u.relations.length > 0);
  if (irHasRelations) {
    const hasComparison = (map.steps ?? []).some((s) =>
      (s.content ?? []).some((b) => b.type === 'comparison')
    );
    const hasConnectionCallout = /"label":"conexión"|"label":"conexion"/i.test(
      JSON.stringify(map.steps ?? [])
    );
    if (!hasComparison && !hasConnectionCallout) {
      errors.push('compiled map dropped visible relations');
    }
  }

  // Visible + IR must share the same relation kinds (no silent UI-only hide).
  const irKinds = artifact.units
    .flatMap((u) => u.relations.map((r) => r.kind.toLowerCase()))
    .sort()
    .join('|');
  const visibleBlob = JSON.stringify(map.steps ?? []).toLowerCase();
  for (const u of artifact.units) {
    for (const r of u.relations) {
      const target = artifact.units.find((x) => x.id === r.toUnitId);
      if (!target) continue;
      const label = relationLabel(r.kind).toLowerCase();
      if (!visibleBlob.includes(u.title.toLowerCase().slice(0, 12))) continue;
      if (relationFamily(r.kind) === 'causal' && /correlaci/.test(visibleBlob)) {
        // correlation wording in UI while IR still causal is a mismatch
        if (irKinds.includes('causes')) {
          errors.push('visible/IR causal semantics mismatch');
        }
      }
      void label;
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export type CompileUnderstandingResult =
  | { ok: true; map: ActionMapData }
  | { ok: false; error: string };

function resolveProvenanceFields(options: CompileUnderstandingOptions): {
  sourceKind: SourceKind;
  sourceLabel: string;
  sourceUrl?: string;
} {
  const p = options.provenance;
  if (p) {
    // Never reuse model/canonical body text as URL.
    const url =
      p.canonicalUrl &&
      /^https?:\/\//i.test(p.canonicalUrl) &&
      !/\n|\[\[chunk/i.test(p.canonicalUrl)
        ? p.canonicalUrl
        : undefined;
    return {
      sourceKind: p.originalKind,
      sourceLabel: (p.label || p.title || options.sourceLabel || 'Fuente').trim(),
      sourceUrl: url,
    };
  }
  return {
    sourceKind: options.sourceKind ?? 'text',
    sourceLabel: options.sourceLabel?.trim() || 'Fuente',
    sourceUrl:
      options.sourceUrl &&
      /^https?:\/\//i.test(options.sourceUrl) &&
      !/\n|\[\[chunk/i.test(options.sourceUrl)
        ? options.sourceUrl
        : undefined,
  };
}

/**
 * Compile a validated complete artifact into ActionMapData.
 * Does not silently fabricate missing structure.
 * Attaches the already-validated IR after normalize (does not re-authorize via rehydrate).
 */
export function compileUnderstandingToMap(
  artifact: UnderstandingArtifact,
  options: CompileUnderstandingOptions = {}
): CompileUnderstandingResult {
  if (artifact.status !== 'complete' || !artifact.closure || artifact.units.length < 1) {
    return { ok: false, error: 'artifact not complete for compile' };
  }

  const guarded = applyCausalGuards(artifact);
  const includeRelations = options.includeRelations !== false;
  const bp = guarded.blueprint;
  const title =
    bp.plan.thesisOrPurpose !== 'unknown'
      ? bp.plan.thesisOrPurpose.slice(0, 80)
      : bp.essential.nuclearIdea.slice(0, 80);

  const steps = guarded.units.map((u) =>
    unitToStep(u, guarded.units, { includeRelations })
  );
  const layer0 = essentialToLayer0(guarded);

  const limitations = [
    ...bp.classification.uncertainties,
    ...bp.essential.limitsOrConditions,
    ...guarded.closure!.comprehensionLimits,
    ...(bp.classification.scopeKnown !== 'complete'
      ? ['Alcance de la fuente incompleto o desconocido.']
      : []),
  ];

  const { sourceKind, sourceLabel, sourceUrl } = resolveProvenanceFields(options);

  // Omit understanding during normalize — attach validated IR afterwards.
  const raw: ActionMapData = {
    title,
    intent: 'understand',
    mapVersion: 1,
    generationMode: 'classic',
    layer0,
    coreIdea: bp.essential.nuclearIdea,
    coreSupport: bp.essential.layer0Synthesis,
    deliveryMessage: softDeliveryFromUnderstanding(
      bp.essential.nuclearIdea,
      sourceKind,
      sourceLabel,
      guarded.units.map((u) => u.title)
    ),
    tldr: essentialToTldr(guarded),
    knowledgeSections: knowledgeFromUnits(guarded.units),
    steps,
    completionCard: {
      title: 'Lo que debes recordar',
      summary: guarded.closure!.finalSynthesis,
      takeaways: guarded.closure!.mainLearnings.slice(0, 5),
      promptQuestion: guarded.closure!.reviewPrompt,
    },
    coverage: {
      summary:
        bp.classification.scopeKnown === 'complete'
          ? 'Comprensión según el material disponible.'
          : 'Comprensión parcial según el material disponible.',
      notes: [
        ...bp.essential.doesNotClaim.slice(0, 4).map((d) => ({
          label: 'No afirma',
          detail: d,
          tone: 'warning' as const,
        })),
        ...limitations.slice(0, 3).map((d) => ({
          label: 'Límite',
          detail: d,
          tone: 'warning' as const,
        })),
      ],
    },
    sourceMetadata: {
      kind: sourceKind,
      label: sourceLabel,
      url: sourceUrl,
      title: options.provenance?.title,
      language: bp.classification.language,
      detected: [bp.classification.genre, bp.classification.discourseStructure],
      limitations: limitations.slice(0, 6),
    },
    modelUsed: guarded.modelVersion,
  };

  const normalized = normalizeMapData(raw);
  if (!normalized) {
    return { ok: false, error: 'normalizeMapData rejected compiled map' };
  }
  normalized.layer0 = ensureLayer0(normalized);

  // Never fabricate citedChunks here — attachCitations alone adds exact ingest chunks.
  // Pending segmentRefs stay on the IR; without an independent manifest on rehydrate, IR is omitted.

  // Fresh validated artifact — attach without treating as external rehydrate input.
  normalized.understanding = {
    schemaVersion: guarded.schemaVersion,
    promptVersion: guarded.promptVersion,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    modelVersion: guarded.modelVersion,
    intent: 'understand' as const,
    status: guarded.status,
    depth: guarded.depth,
    sourceId: guarded.sourceId,
    sourceVersionId: guarded.sourceVersionId,
    contentHash: guarded.contentHash,
    blueprint: guarded.blueprint,
    units: guarded.units,
    closure: guarded.closure,
  };

  let invariants = assertCompileRelationInvariants(guarded, normalized);
  if (invariants.ok === false) {
    const softened = softenUnrepresentedPlannedRelations(guarded);
    if (softened !== guarded) {
      invariants = assertCompileRelationInvariants(softened, normalized);
      if (invariants.ok) {
        normalized.understanding = {
          ...normalized.understanding,
          blueprint: softened.blueprint,
        };
        return { ok: true, map: normalized };
      }
    }
    return { ok: false, error: invariants.errors.join('; ') };
  }

  return { ok: true, map: normalized };
}

/** Build a partial map from essential-only progress (NDJSON early open). */
export function compileEssentialPartial(
  artifact: Pick<UnderstandingArtifact, 'blueprint' | 'modelVersion'>
): ActionMapData {
  const bp = artifact.blueprint;
  const layer0 = {
    what: bp.essential.layer0Synthesis,
    why: bp.essential.layer0Why,
    actions: bp.essential.layer0Actions.map((label, i) => ({
      id: `action-${i + 1}`,
      label,
    })),
  };
  return {
    title: bp.essential.nuclearIdea.slice(0, 80),
    intent: 'understand',
    layer0,
    coreIdea: bp.essential.nuclearIdea,
    coreSupport: bp.essential.layer0Synthesis,
    deliveryMessage: softDeliveryFromUnderstanding(
      bp.essential.nuclearIdea,
      'text',
      '',
      bp.essential.essentialIdeas.map((idea) => idea.title)
    ),
    tldr: normalizeTldrItems(bp.essential.essentialIdeas).slice(0, TLDR_DEFAULT_COUNT),
    steps: [],
    modelUsed: artifact.modelVersion,
  };
}
