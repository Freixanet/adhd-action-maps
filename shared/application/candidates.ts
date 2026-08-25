/**
 * Deterministic candidate extraction from S05 evidence.
 * S06 selects/adapts — it does not re-decide what is true.
 */

import type { EvidenceArtifact } from '../evidence/types';
import {
  buildApplicationIdentitySeed,
  stableCandidateId,
} from './ids';
import { claimToCandidateFields, classifyAdaptationRisk } from './policy';
import type {
  ApplicationCandidateV1,
  ApplicationContextV1,
  EffortLevel,
  RelevanceLevel,
  ReversibilityLevel,
} from './types';

function relevanceFor(
  criticality: string,
  usable: boolean
): RelevanceLevel {
  if (!usable) return 'low';
  if (criticality === 'critical') return 'high';
  if (criticality === 'important') return 'medium';
  return 'low';
}

function effortHeuristic(text: string): EffortLevel {
  if (/\b(semana|mes|programa|h[aá]bito\s+diario)\b/i.test(text)) return 'high';
  if (/\b(hoy|ahora|5\s*min|diez\s*minutos|una\s*vez)\b/i.test(text)) return 'low';
  return 'medium';
}

function reversibilityHeuristic(risk: string, text: string): ReversibilityLevel {
  if (risk.startsWith('high_')) return 'low';
  if (/\b(permanente|irreversible|compromiso\s+largo)\b/i.test(text)) return 'low';
  if (/\b(prueba|ensayo|hoy|una\s*vez|reversible)\b/i.test(text)) return 'high';
  return 'medium';
}

export function extractApplicationCandidates(args: {
  evidence: EvidenceArtifact;
  contentHash: string;
  depth: string;
  contextCanonicalHash: string;
  sourceVersionId?: string;
  context?: ApplicationContextV1;
}): ApplicationCandidateV1[] {
  const seed = buildApplicationIdentitySeed({
    contentHash: args.contentHash,
    sourceVersionId: args.sourceVersionId,
    depth: args.depth,
    contextCanonicalHash: args.contextCanonicalHash,
  });

  const constraint = (args.context?.constraint ?? '').toLowerCase();
  const out: ApplicationCandidateV1[] = [];
  let index = 0;

  for (const claim of args.evidence.claims) {
    if (claim.claimType !== 'recommendation' && claim.claimType !== 'factual' &&
        claim.claimType !== 'causal' && claim.claimType !== 'interpretation' &&
        claim.claimType !== 'thesis') {
      // Still allow recommendations + actionable theses/facts.
      if (claim.criticality === 'auxiliary') continue;
    }

    const fields = claimToCandidateFields(claim);
    const risk = classifyAdaptationRisk([claim.text, ...(claim.abstentionCodes ?? [])]);
    const risksOrLimits: string[] = [];
    if (!fields.usable) risksOrLimits.push(fields.reason);
    if (fields.asInferenceOnly) {
      risksOrLimits.push('Etiquetada como inferencia de Núcleo.');
    }
    if (claim.presentationStatus === 'qualified') {
      risksOrLimits.push('Conservar el matiz de la fuente.');
    }
    if (risk !== 'low') risksOrLimits.push(`Riesgo de adaptación: ${risk}`);

    // Constraint invalidates candidate when clearly incompatible.
    let relevance = relevanceFor(claim.criticality, fields.usable);
    if (constraint && fields.usable) {
      if (
        /\bsin\s+tiempo\b/i.test(constraint) &&
        /\bdiario|cada\s+d[ií]a|hora\s+completa\b/i.test(claim.text)
      ) {
        relevance = 'low';
        risksOrLimits.push('La restricción de tiempo reduce la relevancia.');
      }
    }

    const label =
      claim.text.length > 72 ? `${claim.text.slice(0, 69).trim()}…` : claim.text;

    out.push({
      id: stableCandidateId(seed, claim.id, index),
      claimId: claim.id,
      sourceVersionId: args.sourceVersionId,
      evidenceLinkIds: [...claim.evidenceLinkIds],
      epistemicStatus: claim.presentationStatus,
      relevance,
      relevanceReason: fields.reason,
      effort: effortHeuristic(claim.text),
      reversibility: reversibilityHeuristic(risk, claim.text),
      risksOrLimits,
      label,
      claimText: claim.text,
    });
    index += 1;
  }

  // Prefer usable, high relevance, high reversibility, low effort.
  return out.sort((a, b) => {
    const score = (c: ApplicationCandidateV1) => {
      const u =
        c.epistemicStatus === 'verified'
          ? 30
          : c.epistemicStatus === 'qualified'
            ? 24
            : c.epistemicStatus === 'inference'
              ? 12
              : 0;
      const r = c.relevance === 'high' ? 9 : c.relevance === 'medium' ? 5 : 1;
      const rev = c.reversibility === 'high' ? 6 : c.reversibility === 'medium' ? 3 : 0;
      const e = c.effort === 'low' ? 4 : c.effort === 'medium' ? 2 : 0;
      return u + r + rev + e;
    };
    return score(b) - score(a);
  });
}

export function selectPrimaryCandidate(
  candidates: ApplicationCandidateV1[]
): ApplicationCandidateV1 | null {
  return (
    candidates.find(
      (c) =>
        (c.epistemicStatus === 'verified' ||
          c.epistemicStatus === 'qualified' ||
          c.epistemicStatus === 'inference') &&
        c.relevance !== 'low'
    ) ?? null
  );
}
