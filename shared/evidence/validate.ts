/**
 * Strict validators for S05 evidence artifacts.
 */

import type {
  AbstentionReasonCode,
  CheckCode,
  ClaimCriticality,
  ClaimPresentationStatus,
  ClaimType,
  ContentClaim,
  EvidenceAssessment,
  EvidenceArtifact,
  EvidenceCoverage,
  EvidenceLinkV1,
  EntailmentDecision,
  SourceCoverageHonest,
} from './types';
import type { EpistemicStatus, EvidenceRelation, VerifierStatus } from './types';
import { buildEvidenceCoverage } from './coverage';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_SUPPORTED_SCHEMA_VERSIONS,
  EVIDENCE_SUPPORTED_VERIFIER_VERSIONS,
  EVIDENCE_VERIFIER_VERSION,
} from './versions';
import { validateClaimSurfaceBindings } from './validateSurfaces';

export type ValidateOk<T> = { ok: true; value: T };
export type ValidateFail = { ok: false; errors: string[] };
export type ValidateResult<T> = ValidateOk<T> | ValidateFail;

const CLAIM_TYPES = new Set<ClaimType>([
  'thesis',
  'factual',
  'numeric',
  'causal',
  'comparative',
  'definition',
  'recommendation',
  'interpretation',
  'limitation',
  'example',
]);
const CRITICALITIES = new Set<ClaimCriticality>(['critical', 'important', 'auxiliary']);
const PRESENTATIONS = new Set<ClaimPresentationStatus>([
  'verified',
  'qualified',
  'contradicted',
  'degraded',
  'insufficient',
  'inference',
  'pending',
]);
const EPISTEMIC = new Set<EpistemicStatus>([
  'direct_source',
  'faithful_paraphrase',
  'inference',
  'source_recommendation',
  'nucleo_adaptation',
  'insufficient_information',
]);
const RELATIONS = new Set<EvidenceRelation>(['supports', 'contradicts', 'qualifies', 'illustrates']);
const VERIFIER = new Set<VerifierStatus>(['pending', 'verified', 'rejected', 'uncertain']);
const ENTAIL = new Set<EntailmentDecision>(['supports', 'contradicts', 'qualifies', 'insufficient']);

const ABSTENTION = new Set([
  'NO_ANCHOR',
  'NO_ENTAILMENT',
  'NUMERIC_MISMATCH',
  'NAME_MISMATCH',
  'DATE_MISMATCH',
  'UNIT_MISMATCH',
  'SIGN_MISMATCH',
  'NEGATION_INVERTED',
  'MODALITY_UPGRADED',
  'CAUSALITY_UPGRADED',
  'QUALIFIER_DROPPED',
  'CONTRADICTORY_CHUNKS',
  'INSUFFICIENT_CONTEXT',
  'HALLUCINATED_CHUNK',
  'CROSS_VERSION_CHUNK',
  'PROVIDER_ERROR',
  'PARTIAL_SOURCE',
  'INJECTION_IGNORED',
  'INFERENCE_NOT_SOURCE',
]);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function asCodeArray<T extends string>(raw: unknown, allowed: Set<string>): T[] | null {
  if (!Array.isArray(raw)) return null;
  const out: T[] = [];
  for (const item of raw) {
    if (!isNonEmptyString(item) || !allowed.has(item)) return null;
    out.push(item.trim() as T);
  }
  return out;
}

export function validateContentClaim(raw: unknown): ValidateResult<ContentClaim> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['claim missing'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(o.id)) errors.push('claim.id required');
  if (!isNonEmptyString(o.text)) errors.push('claim.text required');
  if (!CLAIM_TYPES.has(o.claimType as ClaimType)) errors.push('claim.claimType invalid');
  if (!CRITICALITIES.has(o.criticality as ClaimCriticality)) errors.push('claim.criticality invalid');
  if (!EPISTEMIC.has(o.epistemicStatus as EpistemicStatus)) errors.push('claim.epistemicStatus invalid');
  if (!PRESENTATIONS.has(o.presentationStatus as ClaimPresentationStatus)) {
    errors.push('claim.presentationStatus invalid');
  }
  if (!isNonEmptyString(o.slotKey)) errors.push('claim.slotKey required');
  if (!Array.isArray(o.evidenceLinkIds) || !o.evidenceLinkIds.every(isNonEmptyString)) {
    errors.push('claim.evidenceLinkIds must be string[]');
  }
  const abstentionCodes = asCodeArray<AbstentionReasonCode>(o.abstentionCodes ?? [], ABSTENTION);
  if (!abstentionCodes) errors.push('claim.abstentionCodes invalid');
  let surfaces: ContentClaim['surfaces'];
  if (o.surfaces !== undefined && o.surfaces !== null) {
    const surf = validateClaimSurfaceBindings(o.surfaces);
    if (surf.ok === false) {
      errors.push(...surf.errors);
    } else {
      surfaces = surf.value.length ? surf.value : undefined;
    }
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: String(o.id).trim(),
      unitId: isNonEmptyString(o.unitId) ? o.unitId.trim() : undefined,
      text: String(o.text).trim(),
      claimType: o.claimType as ClaimType,
      criticality: o.criticality as ClaimCriticality,
      epistemicStatus: o.epistemicStatus as EpistemicStatus,
      presentationStatus: o.presentationStatus as ClaimPresentationStatus,
      evidenceLinkIds: (o.evidenceLinkIds as string[]).map((s) => s.trim()),
      abstentionCodes: abstentionCodes!,
      slotKey: String(o.slotKey).trim(),
      presentationText: isNonEmptyString(o.presentationText)
        ? o.presentationText.trim()
        : undefined,
      surfaces,
    },
  };
}

export function validateEvidenceLinkV1(
  raw: unknown,
  allowedChunkIds?: Set<string>
): ValidateResult<EvidenceLinkV1> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['link missing'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(o.id)) errors.push('link.id required');
  if (!isNonEmptyString(o.contentNodeId)) errors.push('link.contentNodeId required');
  if (!isNonEmptyString(o.segmentId)) errors.push('link.segmentId required');
  if (!isNonEmptyString(o.chunkId)) errors.push('link.chunkId required');
  if (!RELATIONS.has(o.relation as EvidenceRelation)) errors.push('link.relation invalid');
  if (!VERIFIER.has(o.verifierStatus as VerifierStatus)) errors.push('link.verifierStatus invalid');
  if (!EPISTEMIC.has(o.epistemicStatus as EpistemicStatus)) errors.push('link.epistemicStatus invalid');
  if (o.confidence !== null) errors.push('link.confidence must be null (uncalibrated)');
  if (!isNonEmptyString(o.verifierVersion)) errors.push('link.verifierVersion required');
  if (allowedChunkIds && isNonEmptyString(o.chunkId) && !allowedChunkIds.has(o.chunkId.trim())) {
    errors.push(`hallucinated chunkId: ${o.chunkId}`);
  }
  if (!Array.isArray(o.checkCodes)) errors.push('link.checkCodes must be array');
  if (!Array.isArray(o.abstentionCodes)) errors.push('link.abstentionCodes must be array');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: String(o.id).trim(),
      contentNodeId: String(o.contentNodeId).trim(),
      segmentId: String(o.segmentId).trim(),
      chunkId: String(o.chunkId).trim(),
      relation: o.relation as EvidenceRelation,
      verifierStatus: o.verifierStatus as VerifierStatus,
      epistemicStatus: o.epistemicStatus as EpistemicStatus,
      confidence: null,
      verifierVersion: String(o.verifierVersion).trim(),
      checkCodes: (o.checkCodes as CheckCode[]).map(String) as CheckCode[],
      abstentionCodes: (o.abstentionCodes as AbstentionReasonCode[]).map(String) as AbstentionReasonCode[],
    },
  };
}

export function validateEvidenceAssessment(raw: unknown): ValidateResult<EvidenceAssessment> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['assessment missing'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(o.claimId)) errors.push('assessment.claimId required');
  if (!Array.isArray(o.allowedChunkIdsUsed)) errors.push('assessment.allowedChunkIdsUsed required');
  if (o.entailment !== null && !ENTAIL.has(o.entailment as EntailmentDecision)) {
    errors.push('assessment.entailment invalid');
  }
  if (typeof o.contradiction !== 'boolean') errors.push('assessment.contradiction required');
  if (!VERIFIER.has(o.verifierStatus as VerifierStatus)) errors.push('assessment.verifierStatus invalid');
  if (!EPISTEMIC.has(o.epistemicStatus as EpistemicStatus)) {
    errors.push('assessment.epistemicStatus invalid');
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      claimId: String(o.claimId).trim(),
      allowedChunkIdsUsed: (o.allowedChunkIdsUsed as unknown[]).map(String),
      entailment: o.entailment as EntailmentDecision | null,
      contradiction: Boolean(o.contradiction),
      qualifierPreservation:
        o.qualifierPreservation === null || typeof o.qualifierPreservation === 'boolean'
          ? (o.qualifierPreservation as boolean | null)
          : null,
      negationPreservation:
        o.negationPreservation === null || typeof o.negationPreservation === 'boolean'
          ? (o.negationPreservation as boolean | null)
          : null,
      numericOk:
        o.numericOk === null || typeof o.numericOk === 'boolean' ? (o.numericOk as boolean | null) : null,
      nameOk: o.nameOk === null || typeof o.nameOk === 'boolean' ? (o.nameOk as boolean | null) : null,
      dateOk: o.dateOk === null || typeof o.dateOk === 'boolean' ? (o.dateOk as boolean | null) : null,
      unitOk: o.unitOk === null || typeof o.unitOk === 'boolean' ? (o.unitOk as boolean | null) : null,
      relation: RELATIONS.has(o.relation as EvidenceRelation)
        ? (o.relation as EvidenceRelation)
        : null,
      verifierStatus: o.verifierStatus as VerifierStatus,
      epistemicStatus: o.epistemicStatus as EpistemicStatus,
      abstentionCodes: Array.isArray(o.abstentionCodes)
        ? (o.abstentionCodes as AbstentionReasonCode[])
        : [],
      checkCodes: Array.isArray(o.checkCodes) ? (o.checkCodes as CheckCode[]) : [],
      schemaVersion: String(o.schemaVersion ?? EVIDENCE_SCHEMA_VERSION),
      promptVersion: String(o.promptVersion ?? EVIDENCE_PROMPT_VERSION),
      verifierVersion: String(o.verifierVersion ?? EVIDENCE_VERIFIER_VERSION),
      modelVersion: String(o.modelVersion ?? 'unknown'),
      modelRoute: String(o.modelRoute ?? ''),
    },
  };
}

export function validateEvidenceCoverage(raw: unknown): ValidateResult<EvidenceCoverage> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['coverage missing'] };
  const o = raw as Record<string, unknown>;
  const nums = [
    'criticalTotal',
    'verified',
    'qualified',
    'contradicted',
    'degraded',
    'uncertain',
    'unanchored',
    'inference',
  ] as const;
  for (const k of nums) {
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k] as number)) {
      return { ok: false, errors: [`coverage.${k} required`] };
    }
    if (!Number.isInteger(o[k] as number) || (o[k] as number) < 0) {
      return { ok: false, errors: [`coverage.${k} must be non-negative integer`] };
    }
  }
  if (!Array.isArray(o.summaryLines) || !o.summaryLines.every(isNonEmptyString)) {
    return { ok: false, errors: ['coverage.summaryLines required'] };
  }
  return {
    ok: true,
    value: {
      criticalTotal: o.criticalTotal as number,
      verified: o.verified as number,
      qualified: o.qualified as number,
      contradicted: o.contradicted as number,
      degraded: o.degraded as number,
      uncertain: o.uncertain as number,
      unanchored: o.unanchored as number,
      inference: o.inference as number,
      summaryLines: (o.summaryLines as string[]).map((s) => s.trim()),
    },
  };
}

export function validateSourceCoverageHonest(raw: unknown): ValidateResult<SourceCoverageHonest> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['sourceCoverage missing'] };
  const o = raw as Record<string, unknown>;
  if (o.isComplete !== true && o.isComplete !== false && o.isComplete !== null) {
    return { ok: false, errors: ['sourceCoverage.isComplete must be boolean|null'] };
  }
  if (!Array.isArray(o.limitations)) {
    return { ok: false, errors: ['sourceCoverage.limitations required'] };
  }
  return {
    ok: true,
    value: {
      textual: typeof o.textual === 'number' ? o.textual : null,
      extractionConfidence:
        typeof o.extractionConfidence === 'number' ? o.extractionConfidence : null,
      isComplete: o.isComplete as boolean | null,
      limitations: o.limitations as SourceCoverageHonest['limitations'],
    },
  };
}

/**
 * Fail-closed: every critical claim must leave pending.
 */
export function assertCriticalClaimsResolved(artifact: EvidenceArtifact): ValidateResult<true> {
  const critical = artifact.claims.filter((c) => c.criticality === 'critical');
  const pending = critical.filter((c) => c.presentationStatus === 'pending');
  if (pending.length) {
    return {
      ok: false,
      errors: pending.map((c) => `critical claim still pending: ${c.id}`),
    };
  }
  if (artifact.evidenceCoverage.criticalTotal !== critical.length) {
    return {
      ok: false,
      errors: [
        `coverage.criticalTotal ${artifact.evidenceCoverage.criticalTotal} != ${critical.length}`,
      ],
    };
  }
  return { ok: true, value: true };
}

function assertGraphIntegrity(artifact: EvidenceArtifact): string[] {
  const errors: string[] = [];
  const claimIds = new Set<string>();
  for (const c of artifact.claims) {
    if (claimIds.has(c.id)) errors.push(`duplicate claim id: ${c.id}`);
    claimIds.add(c.id);
  }

  const linkIds = new Set<string>();
  const linksById = new Map<string, EvidenceLinkV1>();
  for (const l of artifact.links) {
    if (linkIds.has(l.id)) errors.push(`duplicate link id: ${l.id}`);
    linkIds.add(l.id);
    linksById.set(l.id, l);
    if (!claimIds.has(l.contentNodeId)) {
      errors.push(`link ${l.id} points at missing claim ${l.contentNodeId}`);
    }
  }

  for (const c of artifact.claims) {
    for (const lid of c.evidenceLinkIds) {
      const link = linksById.get(lid);
      if (!link) {
        errors.push(`claim ${c.id} references missing link ${lid}`);
        continue;
      }
      if (link.contentNodeId !== c.id) {
        errors.push(`claim ${c.id} link ${lid} bound to other claim`);
      }
    }

    // Incompatible statuses: verified links on insufficient/contradicted claims
    if (
      (c.presentationStatus === 'insufficient' || c.presentationStatus === 'contradicted') &&
      c.evidenceLinkIds.some((id) => linksById.get(id)?.verifierStatus === 'verified')
    ) {
      errors.push(`claim ${c.id} ${c.presentationStatus} cannot keep verified links`);
    }
    if (c.presentationStatus === 'verified' || c.presentationStatus === 'qualified') {
      const hasSupport = c.evidenceLinkIds.some((id) => {
        const l = linksById.get(id);
        return l && (l.relation === 'supports' || l.relation === 'qualifies') && l.verifierStatus === 'verified';
      });
      if (!hasSupport) {
        errors.push(`claim ${c.id} ${c.presentationStatus} lacks verified support/qualify link`);
      }
    }
  }

  const assessed = new Set<string>();
  for (const a of artifact.assessments) {
    if (assessed.has(a.claimId)) errors.push(`duplicate assessment for ${a.claimId}`);
    assessed.add(a.claimId);
    if (!claimIds.has(a.claimId)) {
      errors.push(`assessment for missing claim ${a.claimId}`);
    }
    const claim = artifact.claims.find((c) => c.id === a.claimId);
    if (!claim) continue;
    if (
      a.verifierStatus === 'verified' &&
      (claim.presentationStatus === 'insufficient' || claim.presentationStatus === 'contradicted')
    ) {
      errors.push(`assessment verified incompatible with claim ${claim.id}`);
    }
  }

  for (const c of artifact.claims) {
    if (!assessed.has(c.id)) errors.push(`missing assessment for claim ${c.id}`);
  }

  const derived = buildEvidenceCoverage(artifact.claims);
  const cov = artifact.evidenceCoverage;
  for (const key of [
    'criticalTotal',
    'verified',
    'qualified',
    'contradicted',
    'degraded',
    'uncertain',
    'unanchored',
    'inference',
  ] as const) {
    if (cov[key] !== derived[key]) {
      errors.push(`coverage.${key} ${cov[key]} != derived ${derived[key]}`);
    }
  }

  if (
    !EVIDENCE_SUPPORTED_SCHEMA_VERSIONS.has(artifact.schemaVersion) ||
    !EVIDENCE_SUPPORTED_VERIFIER_VERSIONS.has(artifact.verifierVersion)
  ) {
    errors.push('unsupported evidence versions');
  }
  if (artifact.promptVersion && artifact.promptVersion !== EVIDENCE_PROMPT_VERSION) {
    errors.push(`unsupported promptVersion: ${artifact.promptVersion}`);
  }
  if (artifact.compilerVersion && artifact.compilerVersion !== EVIDENCE_COMPILER_VERSION) {
    errors.push(`unsupported compilerVersion: ${artifact.compilerVersion}`);
  }

  return errors;
}

export function validateEvidenceArtifact(
  raw: unknown,
  opts?: { allowedChunkIds?: Set<string>; strictVersions?: boolean }
): ValidateResult<EvidenceArtifact> {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['artifact missing'] };
  const o = raw as Record<string, unknown>;
  const strict = opts?.strictVersions !== false;
  const errors: string[] = [];
  if (!isNonEmptyString(o.schemaVersion)) errors.push('schemaVersion required');
  else if (strict && !EVIDENCE_SUPPORTED_SCHEMA_VERSIONS.has(o.schemaVersion)) {
    errors.push(`unsupported schemaVersion: ${o.schemaVersion}`);
  }
  if (!isNonEmptyString(o.verifierVersion)) errors.push('verifierVersion required');
  else if (strict && !EVIDENCE_SUPPORTED_VERIFIER_VERSIONS.has(o.verifierVersion)) {
    errors.push(`unsupported verifierVersion: ${o.verifierVersion}`);
  }
  if (strict && isNonEmptyString(o.promptVersion) && o.promptVersion !== EVIDENCE_PROMPT_VERSION) {
    errors.push(`unsupported promptVersion: ${o.promptVersion}`);
  }
  if (
    strict &&
    isNonEmptyString(o.compilerVersion) &&
    o.compilerVersion !== EVIDENCE_COMPILER_VERSION
  ) {
    errors.push(`unsupported compilerVersion: ${o.compilerVersion}`);
  }
  if (errors.length) return { ok: false, errors };

  if (!Array.isArray(o.claims) || !Array.isArray(o.links) || !Array.isArray(o.assessments)) {
    return { ok: false, errors: ['claims/links/assessments required'] };
  }

  // Links require an independent allowed set when present.
  if (
    o.links.length > 0 &&
    (!opts?.allowedChunkIds || opts.allowedChunkIds.size === 0)
  ) {
    return { ok: false, errors: ['evidence links require independent chunk manifest'] };
  }

  const claims: ContentClaim[] = [];
  for (const c of o.claims) {
    const r = validateContentClaim(c);
    if (r.ok === false) return { ok: false, errors: r.errors };
    claims.push(r.value);
  }
  const links: EvidenceLinkV1[] = [];
  for (const l of o.links) {
    const r = validateEvidenceLinkV1(l, opts?.allowedChunkIds);
    if (r.ok === false) return { ok: false, errors: r.errors };
    links.push(r.value);
  }
  const assessments: EvidenceAssessment[] = [];
  for (const a of o.assessments) {
    const r = validateEvidenceAssessment(a);
    if (r.ok === false) return { ok: false, errors: r.errors };
    assessments.push(r.value);
  }
  const cov = validateEvidenceCoverage(o.evidenceCoverage);
  if (cov.ok === false) return { ok: false, errors: cov.errors };
  const src = validateSourceCoverageHonest(o.sourceCoverage);
  if (src.ok === false) return { ok: false, errors: src.errors };

  const artifact: EvidenceArtifact = {
    schemaVersion: String(o.schemaVersion),
    promptVersion: String(o.promptVersion ?? EVIDENCE_PROMPT_VERSION),
    verifierVersion: String(o.verifierVersion),
    compilerVersion: String(o.compilerVersion ?? EVIDENCE_COMPILER_VERSION),
    modelVersion: String(o.modelVersion ?? 'unknown'),
    modelRoute: String(o.modelRoute ?? ''),
    status: o.status === 'complete' || o.status === 'partial' || o.status === 'failed'
      ? o.status
      : 'failed',
    claims,
    links,
    assessments,
    evidenceCoverage: cov.value,
    sourceCoverage: src.value,
  };

  const graphErrors = assertGraphIntegrity(artifact);
  if (graphErrors.length) return { ok: false, errors: graphErrors };

  if (artifact.status === 'complete') {
    const resolved = assertCriticalClaimsResolved(artifact);
    if (resolved.ok === false) return { ok: false, errors: resolved.errors };
  }

  return { ok: true, value: artifact };
}
