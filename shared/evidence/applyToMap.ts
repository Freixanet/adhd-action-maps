/**
 * Attach verified/degraded evidence onto ActionMapData via structural bindings.
 * Primary mechanism: claim.surfaces (slot/index/id) — not claim.text search/replace.
 * Never invents citedChunks. Never injects free-form verifier notes beyond presentationText.
 */

import type {
  ActionMapData,
  CoverageNote,
  SourceReference,
  StepContentBlock,
} from '../contracts';
import type { ContentClaim, EvidenceArtifact, ClaimSurfaceBinding } from './types';
import { EVIDENCE_UI_LABELS } from './policy';
import { splitAtomicSentences } from './extractClaims';
import { safeParseClaimSurfaceBindings } from './validateSurfaces';

function isEpistemicStrip(claim: ContentClaim): boolean {
  return (
    claim.presentationStatus === 'contradicted' ||
    claim.presentationStatus === 'degraded' ||
    claim.presentationStatus === 'insufficient'
  );
}

const RELATION_LABELS: Record<string, string> = {
  causes: 'causa / contribuye a',
  contributes: 'contribuye a',
};

function relationLabel(kind: string): string {
  const key = kind.trim().toLowerCase();
  return RELATION_LABELS[key] ?? kind.trim();
}

function claimLabel(claim: ContentClaim): string {
  switch (claim.presentationStatus) {
    case 'verified':
      return EVIDENCE_UI_LABELS.verified;
    case 'qualified':
      return EVIDENCE_UI_LABELS.qualified;
    case 'contradicted':
      return EVIDENCE_UI_LABELS.contradicted;
    case 'degraded':
      return EVIDENCE_UI_LABELS.degraded;
    case 'inference':
      return EVIDENCE_UI_LABELS.inference;
    case 'insufficient':
      return EVIDENCE_UI_LABELS.insufficient;
    default:
      return EVIDENCE_UI_LABELS.pending;
  }
}

function needsSurfaceRewrite(claim: ContentClaim): boolean {
  return (
    claim.presentationStatus === 'contradicted' ||
    claim.presentationStatus === 'degraded' ||
    claim.presentationStatus === 'insufficient' ||
    claim.presentationStatus === 'qualified' ||
    claim.presentationStatus === 'inference'
  );
}

function surfaceText(claim: ContentClaim): string {
  if (
    claim.presentationStatus === 'inference' ||
    claim.epistemicStatus === 'nucleo_adaptation' ||
    claim.epistemicStatus === 'inference'
  ) {
    const base = claim.presentationText ?? claim.text;
    if (/inferencia de Núcleo|adaptación de Núcleo/i.test(base)) return base;
    if (claim.epistemicStatus === 'nucleo_adaptation') {
      return `${base} (adaptación de Núcleo)`;
    }
    return `${base} (inferencia de Núcleo)`;
  }
  return claim.presentationText ?? claim.text;
}

function setSentence(text: string, index: number, next: string): string {
  const parts = splitAtomicSentences(text);
  if (!parts.length) return next;
  if (index < 0 || index >= parts.length) return text;
  // Rebuild from original by replacing the indexed atomic sentence once.
  let cursor = 0;
  let rebuilt = text;
  for (let i = 0; i <= index; i++) {
    const part = parts[i]!;
    const at = rebuilt.indexOf(part, cursor);
    if (at < 0) return text;
    if (i === index) {
      return rebuilt.slice(0, at) + next + rebuilt.slice(at + part.length);
    }
    cursor = at + part.length;
  }
  return text;
}

function updateReferencesForClaim(
  refs: SourceReference[] | undefined,
  claim: ContentClaim,
  linksByClaim: Map<string, string[]>
): SourceReference[] | undefined {
  if (!refs?.length) return refs;
  const chunkIds = linksByClaim.get(claim.id) ?? [];
  if (!chunkIds.length && claim.presentationStatus === 'verified') return refs;
  return refs.map((ref) => {
    if (!ref.chunkId || !chunkIds.includes(ref.chunkId)) return ref;
    return { ...ref, note: claimLabel(claim) };
  });
}

function applyBinding(
  map: ActionMapData,
  claim: ContentClaim,
  binding: ClaimSurfaceBinding,
  next: string
): void {
  switch (binding.kind) {
    case 'title':
      // A title is navigation/UI, not a factual conclusion. Evidence may
      // qualify the underlying core idea, but must never turn the map title
      // into "La fuente no permite determinarlo…".
      break;
    case 'coreIdea':
      map.coreIdea = next;
      break;
    case 'coreSupport':
      map.coreSupport = next;
      break;
    case 'layer0.what':
      if (map.layer0) map.layer0 = { ...map.layer0, what: next };
      break;
    case 'layer0.why':
      if (map.layer0) map.layer0 = { ...map.layer0, why: next };
      break;
    case 'layer0.action':
      if (map.layer0?.actions[binding.index]) {
        const actions = map.layer0.actions.map((a, i) =>
          i === binding.index ? { ...a, label: next } : a
        );
        map.layer0 = { ...map.layer0, actions };
      }
      break;
    case 'tldr':
      if (map.tldr?.[binding.index]) {
        map.tldr = map.tldr.map((item, i) =>
          i === binding.index
            ? {
                title: next.slice(0, 48).trim() || item.title,
                desc: next,
              }
            : item
        );
      }
      break;
    case 'step.prose': {
      const step = map.steps?.find((s) => s.id === binding.unitId);
      if (!step?.content) break;
      step.content = step.content.map((block) => {
        if (block.type !== 'prose' || typeof block.text !== 'string') return block;
        return {
          ...block,
          text: setSentence(block.text, binding.sentenceIndex, next),
        };
      });
      break;
    }
    case 'step.caution':
    case 'step.example': {
      const step = map.steps?.find((s) => s.id === binding.unitId);
      if (!step?.content) break;
      const wantLabel = binding.kind === 'step.caution' ? 'Precaución' : 'Ejemplo';
      let seen = 0;
      step.content = step.content.map((block) => {
        if (block.type !== 'callout') return block;
        const label = 'label' in block ? String(block.label ?? '') : '';
        if (label !== wantLabel) return block;
        if (seen++ !== binding.index) return block;
        return { ...block, text: next };
      });
      break;
    }
    case 'step.relation.callout':
    case 'step.relation.comparison':
      // Handled in applyRelationDecisionsBatch — no sequential index mutation here.
      break;
    case 'step.relation': {
      // Legacy: rewrite matching Conexión callout + strip/transform comparison by marker.
      const step = map.steps?.find((s) => s.id === binding.unitId);
      if (!step?.content) break;
      const labelEs = relationLabel(binding.relKind);
      const marker = `» ${labelEs} «`;
      const rawMarker = `» ${binding.relKind} «`;
      const strip = isEpistemicStrip(claim);
      step.content = step.content.flatMap((block): StepContentBlock[] => {
        if (block.type === 'callout') {
          const label = 'label' in block ? String(block.label ?? '') : '';
          if (label !== 'Conexión') return [block];
          if (block.relationId) {
            // Prefer id-based path in batch; skip legacy text match when id present.
            return [block];
          }
          const text = typeof block.text === 'string' ? block.text : '';
          if (!text.includes(marker) && !text.includes(rawMarker)) return [block];
          if (strip) return [];
          return [{ ...block, text: next }];
        }
        if (block.type === 'comparison' && Array.isArray(block.rows)) {
          if (block.rows.some((r) => r.relationId)) return [block];
          const rows = block.rows.filter((row) => {
            const hit =
              row.label === labelEs ||
              row.label === binding.relKind ||
              row.values?.some((v) => String(v).includes(binding.toUnitId));
            if (!hit) return true;
            return !strip;
          });
          if (strip && rows.length !== block.rows.length) {
            if (!rows.length) return [];
            return [{ ...block, rows }];
          }
          if (!strip) {
            const nextRows = block.rows.map((row) => {
              const hit =
                row.label === labelEs ||
                row.label === binding.relKind ||
                (typeof row.label === 'string' &&
                  row.label.toLowerCase().includes(binding.relKind.toLowerCase()));
              if (!hit) return row;
              return { ...row, label: next.slice(0, 64), values: row.values.map(() => next) };
            });
            return [{ ...block, rows: nextRows }];
          }
        }
        return [block];
      });
      break;
    }
    case 'knowledge': {
      if (!map.knowledgeSections?.length) break;
      const step = map.steps?.find((s) => s.id === binding.unitId);
      const sectionIdx = map.knowledgeSections.findIndex(
        (k) => k.title === step?.title || map.steps?.find((s) => s.id === binding.unitId)?.title === k.title
      );
      // Prefer unit order: knowledge sections are units.slice(0,6) in compile order.
      const unitOrderIdx = map.steps?.findIndex((s) => s.id === binding.unitId) ?? -1;
      const idx = unitOrderIdx >= 0 && unitOrderIdx < (map.knowledgeSections?.length ?? 0)
        ? unitOrderIdx
        : sectionIdx;
      if (idx < 0 || !map.knowledgeSections[idx]) break;
      const current = map.knowledgeSections[idx]!;
      // Truncated summaries: rewrite from sentence index against the live step prose when possible.
      const proseBlock = step?.content?.find((b) => b.type === 'prose');
      const proseText =
        proseBlock && proseBlock.type === 'prose' && typeof proseBlock.text === 'string'
          ? proseBlock.text
          : null;
      const full = proseText
        ? proseText
        : setSentence(current.summary, binding.sentenceIndex, next);
      map.knowledgeSections = map.knowledgeSections.map((k, i) =>
        i === idx ? { ...k, summary: full.slice(0, 220) } : k
      );
      break;
    }
    case 'closure.summary':
      if (map.completionCard) {
        map.completionCard = {
          ...map.completionCard,
          summary: setSentence(map.completionCard.summary, binding.sentenceIndex, next),
        };
      }
      break;
    case 'closure.takeaway':
      if (map.completionCard?.takeaways) {
        map.completionCard = {
          ...map.completionCard,
          takeaways: map.completionCard.takeaways.map((t, i) =>
            i === binding.index ? next : t
          ),
        };
      }
      break;
    case 'coverage.limit':
      // Limits stay as coverage notes — presentation handled via coverage rebuild below.
      break;
    default:
      break;
  }
}

/**
 * Apply evidence artifact to map using structural bindings.
 */
export function applyEvidenceToMap(
  map: ActionMapData,
  evidence: EvidenceArtifact
): ActionMapData {
  const linksByClaim = new Map<string, string[]>();
  for (const link of evidence.links) {
    const list = linksByClaim.get(link.contentNodeId) ?? [];
    list.push(link.chunkId);
    linksByClaim.set(link.contentNodeId, list);
  }

  const claims = evidence.claims;
  const criticalClaims = claims.filter((c) => c.criticality === 'critical');

  const notes: CoverageNote[] = evidence.evidenceCoverage.summaryLines.map((line) => ({
    label: 'Evidencia',
    detail: line,
    tone: /no determinable|contradicción|degradad/i.test(line) ? 'warning' : 'neutral',
  }));

  for (const lim of evidence.sourceCoverage.limitations) {
    notes.push({
      label: 'Cobertura',
      detail: lim.detail,
      tone: 'warning',
    });
  }

  // Deep-clone mutable surfaces we rewrite.
  const next: ActionMapData = {
    ...map,
    layer0: map.layer0 ? { ...map.layer0, actions: map.layer0.actions.map((a) => ({ ...a })) } : map.layer0,
    tldr: (map.tldr ?? []).map((t) => ({ ...t })),
    knowledgeSections: map.knowledgeSections?.map((k) => ({ ...k })),
    completionCard: map.completionCard
      ? {
          ...map.completionCard,
          takeaways: map.completionCard.takeaways ? [...map.completionCard.takeaways] : undefined,
        }
      : map.completionCard,
    steps: map.steps?.map((s) => ({
      ...s,
      content: s.content?.map((b) => ({ ...b })),
      references: s.references ? [...s.references] : undefined,
    })),
    evidence,
    coverage: {
      summary:
        evidence.evidenceCoverage.summaryLines.join(' · ') ||
        map.coverage?.summary ||
        'Comprensión según el material disponible.',
      notes: [...notes, ...(map.coverage?.notes ?? [])].slice(0, 12),
    },
  };

  // One decision → many bindings; never re-verify duplicates.
  // Relation surfaces are applied in one batch per unit against the original snapshot
  // keyed by relationId — never sequential index deletion.
  type RelDecision = { strip: boolean; text: string };
  const relationDecisions = new Map<string, RelDecision>(); // key: `${unitId}\0${relationId}`

  const applied = new Set<string>();
  for (const claim of claims) {
    if (!needsSurfaceRewrite(claim)) continue;
    if (applied.has(claim.id)) continue;
    applied.add(claim.id);
    const text = surfaceText(claim);
    const bindings = claim.surfaces?.length
      ? safeParseClaimSurfaceBindings(claim.surfaces)
      : fallbackBindingsFromSlot(claim);
    for (const binding of bindings) {
      if (
        binding.kind === 'step.relation.callout' ||
        binding.kind === 'step.relation.comparison'
      ) {
        const key = `${binding.unitId}\0${binding.relationId}`;
        relationDecisions.set(key, {
          strip: isEpistemicStrip(claim),
          text,
        });
        continue;
      }
      try {
        applyBinding(next, claim, binding, text);
      } catch {
        // Fail-closed soft: skip bad binding; do not abort the map apply.
      }
    }
  }

  if (next.steps?.length && relationDecisions.size) {
    next.steps = next.steps.map((step) => {
      if (!step.content?.length) return step;
      const content = applyRelationDecisionsToContent(step.content, step.id, relationDecisions);
      return { ...step, content };
    });
  }

  if (next.steps?.length) {
    next.steps = next.steps.map((step) => {
      const unitClaims = criticalClaims.filter((c) => c.unitId === step.id);
      let references = step.references;
      for (const claim of unitClaims) {
        references = updateReferencesForClaim(references, claim, linksByClaim);
      }
      const content = step.content?.map((block) => {
        if (!('references' in block) || !block.references) return block;
        let blockRefs = block.references as SourceReference[];
        for (const claim of unitClaims) {
          blockRefs = updateReferencesForClaim(blockRefs, claim, linksByClaim) ?? blockRefs;
        }
        return { ...block, references: blockRefs };
      });
      return { ...step, references, content };
    });
  }

  if (next.references?.length) {
    let refs = next.references;
    for (const claim of criticalClaims) {
      refs = updateReferencesForClaim(refs, claim, linksByClaim) ?? refs;
    }
    next.references = refs;
  }

  return next;
}

/**
 * Apply all relation decisions for a unit against the original content snapshot.
 * Identity is relationId on rows/callouts — not array indices.
 */
function applyRelationDecisionsToContent(
  content: StepContentBlock[],
  unitId: string,
  decisions: Map<string, { strip: boolean; text: string }>
): StepContentBlock[] {
  return content.flatMap((block): StepContentBlock[] => {
    if (block.type === 'callout') {
      const label = 'label' in block ? String(block.label ?? '') : '';
      if (label !== 'Conexión' || !block.relationId) return [block];
      const d = decisions.get(`${unitId}\0${block.relationId}`);
      if (!d) return [block];
      if (d.strip) return [];
      return [{ ...block, text: d.text }];
    }
    if (block.type === 'comparison' && Array.isArray(block.rows)) {
      const rows = block.rows.flatMap((row) => {
        if (!row.relationId) return [row];
        const d = decisions.get(`${unitId}\0${row.relationId}`);
        if (!d) return [row];
        if (d.strip) return [];
        return [
          {
            ...row,
            label: d.text.slice(0, 64),
            values: row.values.map(() => d.text),
          },
        ];
      });
      if (!rows.length) return [];
      return [{ ...block, rows }];
    }
    return [block];
  });
}

/** Fallback when legacy claims lack surfaces[] — still structural via slotKey. */
function fallbackBindingsFromSlot(claim: ContentClaim): ClaimSurfaceBinding[] {
  const key = claim.slotKey;
  if (key === 'nuclear') return [{ kind: 'coreIdea' }];
  if (key === 'layer0:synthesis') return [{ kind: 'coreSupport' }, { kind: 'layer0.what' }];
  if (key === 'layer0:why') return [{ kind: 'layer0.why' }];
  const action = /^layer0:action:(\d+)$/.exec(key);
  if (action) return [{ kind: 'layer0.action', index: Number(action[1]) }];
  const essential = /^essential:(\d+)$/.exec(key);
  if (essential) return [{ kind: 'tldr', index: Number(essential[1]) }];
  const exp = /^unit:(\d+):exp:(\d+)$/.exec(key);
  if (exp && claim.unitId) {
    return [
      { kind: 'step.prose', unitId: claim.unitId, sentenceIndex: Number(exp[2]) },
      { kind: 'knowledge', unitId: claim.unitId, sentenceIndex: Number(exp[2]) },
    ];
  }
  const caution = /^unit:\d+:caution:(\d+)$/.exec(key);
  if (caution && claim.unitId) {
    return [{ kind: 'step.caution', unitId: claim.unitId, index: Number(caution[1]) }];
  }
  const example = /^unit:\d+:example:(\d+)$/.exec(key);
  if (example && claim.unitId) {
    return [{ kind: 'step.example', unitId: claim.unitId, index: Number(example[1]) }];
  }
  const rel = /^unit:\d+:rel:([^:]+):(.+)$/.exec(key);
  if (rel && claim.unitId) {
    return [
      {
        kind: 'step.relation',
        unitId: claim.unitId,
        toUnitId: rel[1]!,
        relKind: rel[2]!,
      },
    ];
  }
  const synth = /^closure:synth:(\d+)$/.exec(key);
  if (synth) return [{ kind: 'closure.summary', sentenceIndex: Number(synth[1]) }];
  const learn = /^closure:learn:(\d+)$/.exec(key);
  if (learn) return [{ kind: 'closure.takeaway', index: Number(learn[1]) }];
  return [];
}

/** Collect visible conclusion strings for tests. */
export function collectVisibleConclusionTexts(map: ActionMapData): string[] {
  const out: string[] = [
    map.title,
    map.coreIdea,
    map.coreSupport,
    map.layer0?.what ?? '',
    map.layer0?.why ?? '',
    ...(map.layer0?.actions.map((a) => a.label) ?? []),
    ...(map.tldr?.flatMap((t) => [t.title, t.desc]) ?? []),
    ...(map.knowledgeSections?.flatMap((k) => [k.title, k.summary]) ?? []),
    map.completionCard?.summary ?? '',
    ...(map.completionCard?.takeaways ?? []),
  ];
  for (const step of map.steps ?? []) {
    out.push(step.title, step.shortNav, step.selfCheck ?? '');
    for (const block of step.content ?? []) {
      if ('text' in block && typeof block.text === 'string') out.push(block.text);
      if ('title' in block && typeof (block as { title?: string }).title === 'string') {
        out.push((block as { title: string }).title);
      }
      if (block.type === 'comparison' && Array.isArray(block.rows)) {
        for (const row of block.rows) {
          out.push(row.label, ...row.values.map(String));
        }
      }
    }
  }
  return out.filter(Boolean);
}
