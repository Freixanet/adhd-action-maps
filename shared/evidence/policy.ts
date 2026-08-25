/**
 * Decision policy: verified / qualified / contradicted / insufficient / inference.
 * Never show rejected claims as supported. Never label external world-truth.
 *
 * Deterministic checks are relation-aware:
 * - supports/qualifies: mismatch blocks verification
 * - contradicts: mismatch can reinforce contradiction; never converts to support
 */

import { stableEvidenceLinkId } from './claimIds';
import type { DeterministicCheckResult } from './deterministicChecks';
import type {
  AbstentionReasonCode,
  CheckCode,
  ContentClaim,
  EntailmentDecision,
  EvidenceAssessment,
  EvidenceLinkV1,
  EpistemicStatus,
} from './types';
import {
  EVIDENCE_MODEL_ROUTE,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from './versions';

export type EntailmentResult = {
  decision: EntailmentDecision;
  chunkIds: string[];
  qualifierNote?: string;
  modelVersion: string;
  checkCodes: CheckCode[];
  error?: boolean;
};

export type PolicyInput = {
  claim: ContentClaim;
  /** Chunks used in the final decision (exact selected), or candidate ids on provider error. */
  candidatesUsed: string[];
  /** True when retrieve returned candidates (even if none selected after error). */
  hadCandidates?: boolean;
  deterministic: DeterministicCheckResult;
  entailment: EntailmentResult | null;
  forceInference?: boolean;
  selectedEvidenceText?: string;
};

export type PolicyOutput = {
  claim: ContentClaim;
  link: EvidenceLinkV1 | null;
  assessment: EvidenceAssessment;
};

export function groundedQualifierNote(
  note: string | undefined,
  selectedEvidenceText: string
): string | undefined {
  if (!note) return undefined;
  const trimmed = note.trim();
  if (trimmed.length < 4 || trimmed.length > 100) return undefined;
  if (/verdadero|hecho|system:|ignore|verifica/i.test(trimmed)) return undefined;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ');
  const needle = norm(trimmed);
  const hay = norm(selectedEvidenceText);
  const probe = needle.slice(0, Math.min(needle.length, Math.max(24, Math.floor(needle.length * 0.6))));
  if (!probe || !hay.includes(probe)) return undefined;
  return trimmed;
}

function uiPresentationText(
  claim: ContentClaim,
  status: ContentClaim['presentationStatus'],
  qualifierNote?: string
): string | undefined {
  if (status === 'qualified') {
    return qualifierNote
      ? `${claim.text} — matiz de la fuente: ${qualifierNote}`
      : `${claim.text} — la fuente lo matiza.`;
  }
  if (status === 'insufficient') {
    if (claim.claimType === 'causal') {
      return `El fragmento disponible no permite afirmar: ${claim.text}`;
    }
    return `La fuente no permite determinarlo: ${claim.text}`;
  }
  if (status === 'contradicted') {
    return `La fuente contiene posiciones incompatibles sobre: ${claim.text}`;
  }
  if (status === 'degraded') {
    return `Afirmación degradada respecto a la fuente: ${claim.text}`;
  }
  if (status === 'inference') {
    return claim.text;
  }
  return undefined;
}

export function applyEvidencePolicy(input: PolicyInput): PolicyOutput {
  const {
    claim,
    deterministic,
    entailment,
    candidatesUsed,
    forceInference,
    selectedEvidenceText,
    hadCandidates,
  } = input;
  const abstentionCodes: AbstentionReasonCode[] = [...deterministic.abstentionCodes];
  const checkCodes: CheckCode[] = [...deterministic.checkCodes];

  if (
    forceInference ||
    claim.epistemicStatus === 'inference' ||
    claim.epistemicStatus === 'nucleo_adaptation'
  ) {
    const updated: ContentClaim = {
      ...claim,
      presentationStatus: 'inference',
      epistemicStatus:
        claim.epistemicStatus === 'nucleo_adaptation' ? 'nucleo_adaptation' : 'inference',
      abstentionCodes: ['INFERENCE_NOT_SOURCE'],
      presentationText: uiPresentationText(claim, 'inference'),
    };
    return {
      claim: updated,
      link: null,
      assessment: {
        claimId: claim.id,
        allowedChunkIdsUsed: candidatesUsed,
        entailment: null,
        contradiction: false,
        qualifierPreservation: null,
        negationPreservation: deterministic.negationOk,
        numericOk: deterministic.numericOk,
        nameOk: deterministic.nameOk,
        dateOk: deterministic.dateOk,
        unitOk: deterministic.unitOk,
        relation: null,
        verifierStatus: 'uncertain',
        epistemicStatus: updated.epistemicStatus,
        abstentionCodes: ['INFERENCE_NOT_SOURCE'],
        checkCodes,
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
        promptVersion: EVIDENCE_PROMPT_VERSION,
        verifierVersion: EVIDENCE_VERIFIER_VERSION,
        modelVersion: entailment?.modelVersion ?? 'n/a',
        modelRoute: EVIDENCE_MODEL_ROUTE,
      },
    };
  }

  // Provider error with candidates present → never invent NO_ANCHOR.
  if (entailment?.error) {
    abstentionCodes.push('PROVIDER_ERROR');
    checkCodes.push('ENTAILMENT_ERROR');
    const updated: ContentClaim = {
      ...claim,
      presentationStatus: 'insufficient',
      epistemicStatus: 'insufficient_information',
      abstentionCodes: [...new Set(abstentionCodes)],
      presentationText: uiPresentationText(claim, 'insufficient'),
    };
    return {
      claim: updated,
      link: null,
      assessment: baseAssessment(
        claim,
        candidatesUsed,
        null,
        deterministic,
        checkCodes,
        abstentionCodes,
        'uncertain',
        'insufficient_information',
        entailment
      ),
    };
  }

  if (!candidatesUsed.length && !hadCandidates) {
    abstentionCodes.push('NO_ANCHOR');
    const updated: ContentClaim = {
      ...claim,
      presentationStatus: 'insufficient',
      epistemicStatus: 'insufficient_information',
      abstentionCodes: [...new Set(abstentionCodes)],
      presentationText: uiPresentationText(claim, 'insufficient'),
    };
    return {
      claim: updated,
      link: null,
      assessment: baseAssessment(
        claim,
        candidatesUsed,
        null,
        deterministic,
        checkCodes,
        abstentionCodes,
        'uncertain',
        'insufficient_information',
        entailment
      ),
    };
  }

  // Valid contradicts decision → rejected EvidenceLink to exact chunk, even when
  // deterministic mismatches (negation/number) — those reinforce contradiction.
  if (entailment?.decision === 'contradicts') {
    abstentionCodes.push('CONTRADICTORY_CHUNKS');
    checkCodes.push('ENTAILMENT_CONTRADICTS');
    if (!deterministic.ok) {
      checkCodes.push(...deterministic.checkCodes.filter((c) => c.endsWith('_FAIL')));
    }
    const chunkId = entailment.chunkIds[0] ?? candidatesUsed[0];
    if (!chunkId) {
      const updated: ContentClaim = {
        ...claim,
        presentationStatus: 'contradicted',
        epistemicStatus: 'insufficient_information',
        abstentionCodes: [...new Set(abstentionCodes)],
        presentationText: uiPresentationText(claim, 'contradicted'),
      };
      return {
        claim: updated,
        link: null,
        assessment: baseAssessment(
          claim,
          candidatesUsed,
          'contradicts',
          deterministic,
          checkCodes,
          abstentionCodes,
          'rejected',
          'insufficient_information',
          entailment
        ),
      };
    }
    const link = makeLink(
      claim,
      chunkId,
      'contradicts',
      'rejected',
      'insufficient_information',
      checkCodes,
      abstentionCodes
    );
    const updated: ContentClaim = {
      ...claim,
      presentationStatus: 'contradicted',
      epistemicStatus: 'insufficient_information',
      evidenceLinkIds: [link.id],
      abstentionCodes: [...new Set(abstentionCodes)],
      presentationText: uiPresentationText(claim, 'contradicted'),
    };
    return {
      claim: updated,
      link,
      assessment: baseAssessment(
        claim,
        candidatesUsed.length ? candidatesUsed : [chunkId],
        'contradicts',
        deterministic,
        checkCodes,
        abstentionCodes,
        'rejected',
        'insufficient_information',
        entailment
      ),
    };
  }

  // supports / qualifies: deterministic mismatch blocks verification.
  if (!deterministic.ok) {
    const status =
      deterministic.abstentionCodes.includes('NEGATION_INVERTED') ||
      deterministic.abstentionCodes.includes('CAUSALITY_UPGRADED') ||
      deterministic.abstentionCodes.includes('MODALITY_UPGRADED')
        ? 'degraded'
        : 'insufficient';
    const updated: ContentClaim = {
      ...claim,
      presentationStatus: status,
      epistemicStatus: 'insufficient_information',
      abstentionCodes: [...new Set(abstentionCodes)],
      presentationText: uiPresentationText(claim, status),
    };
    return {
      claim: updated,
      link: null,
      assessment: baseAssessment(
        claim,
        candidatesUsed,
        entailment?.decision ?? null,
        deterministic,
        checkCodes,
        abstentionCodes,
        'rejected',
        'insufficient_information',
        entailment
      ),
    };
  }

  if (!entailment) {
    abstentionCodes.push(hadCandidates ? 'NO_ENTAILMENT' : 'NO_ANCHOR');
    const updated: ContentClaim = {
      ...claim,
      presentationStatus: 'insufficient',
      epistemicStatus: 'insufficient_information',
      abstentionCodes: [...new Set(abstentionCodes)],
      presentationText: uiPresentationText(claim, 'insufficient'),
    };
    return {
      claim: updated,
      link: null,
      assessment: baseAssessment(
        claim,
        candidatesUsed,
        null,
        deterministic,
        checkCodes,
        abstentionCodes,
        'uncertain',
        'insufficient_information',
        entailment
      ),
    };
  }

  checkCodes.push(
    entailment.decision === 'supports'
      ? 'ENTAILMENT_SUPPORTS'
      : entailment.decision === 'qualifies'
        ? 'ENTAILMENT_QUALIFIES'
        : 'ENTAILMENT_INSUFFICIENT'
  );

  if (entailment.decision === 'insufficient' || !candidatesUsed.length) {
    abstentionCodes.push(candidatesUsed.length ? 'NO_ENTAILMENT' : hadCandidates ? 'NO_ENTAILMENT' : 'NO_ANCHOR');
    const updated: ContentClaim = {
      ...claim,
      presentationStatus: 'insufficient',
      epistemicStatus: 'insufficient_information',
      abstentionCodes: [...new Set(abstentionCodes)],
      presentationText: uiPresentationText(claim, 'insufficient'),
    };
    return {
      claim: updated,
      link: null,
      assessment: baseAssessment(
        claim,
        candidatesUsed,
        'insufficient',
        deterministic,
        checkCodes,
        abstentionCodes,
        'uncertain',
        'insufficient_information',
        entailment
      ),
    };
  }

  if (entailment.decision === 'qualifies') {
    const chunkId = entailment.chunkIds[0] ?? candidatesUsed[0]!;
    const link = makeLink(
      claim,
      chunkId,
      'qualifies',
      'verified',
      'faithful_paraphrase',
      checkCodes,
      []
    );
    const grounded = groundedQualifierNote(
      entailment.qualifierNote,
      selectedEvidenceText ?? ''
    );
    const updated: ContentClaim = {
      ...claim,
      presentationStatus: 'qualified',
      epistemicStatus: 'faithful_paraphrase',
      evidenceLinkIds: [link.id],
      abstentionCodes: [],
      presentationText: uiPresentationText(claim, 'qualified', grounded),
    };
    return {
      claim: updated,
      link,
      assessment: baseAssessment(
        claim,
        candidatesUsed,
        'qualifies',
        deterministic,
        checkCodes,
        [],
        'verified',
        'faithful_paraphrase',
        entailment
      ),
    };
  }

  // supports
  const chunkId = entailment.chunkIds[0] ?? candidatesUsed[0]!;
  const epistemic: EpistemicStatus =
    claim.claimType === 'recommendation' ? 'source_recommendation' : 'faithful_paraphrase';
  const link = makeLink(claim, chunkId, 'supports', 'verified', epistemic, checkCodes, []);
  const updated: ContentClaim = {
    ...claim,
    presentationStatus: 'verified',
    epistemicStatus: epistemic,
    evidenceLinkIds: [link.id],
    abstentionCodes: [],
  };
  return {
    claim: updated,
    link,
    assessment: baseAssessment(
      claim,
      candidatesUsed,
      'supports',
      deterministic,
      checkCodes,
      [],
      'verified',
      epistemic,
      entailment
    ),
  };
}

function makeLink(
  claim: ContentClaim,
  chunkId: string,
  relation: EvidenceLinkV1['relation'],
  verifierStatus: EvidenceLinkV1['verifierStatus'],
  epistemicStatus: EpistemicStatus,
  checkCodes: CheckCode[],
  abstentionCodes: AbstentionReasonCode[]
): EvidenceLinkV1 {
  return {
    id: stableEvidenceLinkId(claim.id, chunkId, relation),
    contentNodeId: claim.id,
    segmentId: chunkId,
    chunkId,
    relation,
    verifierStatus,
    epistemicStatus,
    confidence: null,
    verifierVersion: EVIDENCE_VERIFIER_VERSION,
    checkCodes,
    abstentionCodes,
  };
}

function baseAssessment(
  claim: ContentClaim,
  candidatesUsed: string[],
  entailment: EntailmentDecision | null,
  deterministic: DeterministicCheckResult,
  checkCodes: CheckCode[],
  abstentionCodes: AbstentionReasonCode[],
  verifierStatus: EvidenceAssessment['verifierStatus'],
  epistemicStatus: EpistemicStatus,
  entailmentResult: EntailmentResult | null
): EvidenceAssessment {
  return {
    claimId: claim.id,
    allowedChunkIdsUsed: candidatesUsed,
    entailment,
    contradiction: entailment === 'contradicts',
    qualifierPreservation: entailment === 'qualifies' ? true : null,
    negationPreservation: deterministic.negationOk,
    numericOk: deterministic.numericOk,
    nameOk: deterministic.nameOk,
    dateOk: deterministic.dateOk,
    unitOk: deterministic.unitOk,
    relation:
      entailment === 'supports' ||
      entailment === 'contradicts' ||
      entailment === 'qualifies'
        ? entailment
        : null,
    verifierStatus,
    epistemicStatus,
    abstentionCodes: [...new Set(abstentionCodes)],
    checkCodes,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    promptVersion: EVIDENCE_PROMPT_VERSION,
    verifierVersion: EVIDENCE_VERIFIER_VERSION,
    modelVersion: entailmentResult?.modelVersion ?? 'n/a',
    modelRoute: EVIDENCE_MODEL_ROUTE,
  };
}

export const EVIDENCE_UI_LABELS = {
  verified: 'Respaldado por esta fuente',
  qualified: 'La fuente lo matiza',
  contradicted: 'La fuente contradice o es incompatible',
  degraded: 'Afirmación degradada',
  insufficient: 'La fuente no permite determinarlo',
  inference: 'Inferencia de Núcleo',
  pending: 'Pendiente de verificación',
  direct_source: 'Fuente directa',
  faithful_paraphrase: 'Paráfrasis respaldada',
} as const;
