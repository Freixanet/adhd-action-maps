/**
 * S05 Evidence Engine — extract → retrieve → batched entailment → exact-chunk checks → policy.
 */

import type { ActionMapData } from '../contracts';
import type { IngestResult, SourceChunk } from '../types/chunk';
import type { UnderstandingArtifact } from '../understanding/types';
import { applyEvidenceToMap } from './applyToMap';
import { runBatchedEntailment, type BatchedClaimInput } from './batchEntailment';
import { getEvidenceCache, setEvidenceCache, evidenceCacheKey } from './cache';
import { buildEvidenceCoverage, buildSourceCoverage } from './coverage';
import {
  runDeterministicChecks,
  type DeterministicCheckResult,
} from './deterministicChecks';
import type { EvidenceJsonGenerator } from './entailment';
import { extractClaimsFromUnderstanding } from './extractClaims';
import { applyEvidencePolicy } from './policy';
import { retrieveCandidates } from './retrieveCandidates';
import type {
  ContentClaim,
  EvidenceArtifact,
  EvidenceAssessment,
  EvidenceLinkV1,
} from './types';
import { validateEvidenceArtifact } from './validate';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_MODEL_ROUTE,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from './versions';

/** @deprecated Prefer batched entailment; kept for telemetry/tests. */
export const EVIDENCE_ENTAILMENT_CONCURRENCY = 3;
export const EVIDENCE_HEARTBEAT_MS = 10_000;

export type RunEvidenceEngineArgs = {
  artifact: UnderstandingArtifact;
  map: ActionMapData;
  ingest: IngestResult | null;
  contentHash: string;
  ownerId?: string;
  pastedComplete?: boolean;
  webFetchSucceeded?: boolean;
  partialExtraction?: boolean;
  depth?: string;
  generateJson: EvidenceJsonGenerator;
  isCancelled?: () => boolean;
  onHeartbeat?: (info: { processed: number; total: number }) => void;
};

export type RunEvidenceEngineResult =
  | { ok: true; evidence: EvidenceArtifact; map: ActionMapData; cacheHit: boolean }
  | { ok: false; code: string; message: string };

type ClaimWork =
  | {
      kind: 'resolved';
      claim: ContentClaim;
      link: EvidenceLinkV1 | null;
      assessment: EvidenceAssessment;
    }
  | {
      kind: 'entail';
      claim: ContentClaim;
      candidates: ReturnType<typeof retrieveCandidates>;
    };

function allowedChunks(
  ingest: IngestResult | null,
  map: ActionMapData
): { ids: Set<string>; chunks: SourceChunk[]; byId: Map<string, SourceChunk> } {
  const fromIngest = ingest?.chunks ?? [];
  const fromCited = map.citedChunks ?? [];
  const chunks = fromIngest.length ? fromIngest : fromCited;
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const ids = new Set(chunks.map((c) => c.id));
  return { ids, chunks, byId };
}

function pendingRefsForClaim(
  claim: ContentClaim,
  understanding: UnderstandingArtifact
): string[] {
  if (!claim.unitId) {
    return understanding.units.flatMap((u) => u.segmentRefs.map((r) => r.chunkId));
  }
  const unit = understanding.units.find((u) => u.id === claim.unitId);
  return unit?.segmentRefs.map((r) => r.chunkId) ?? [];
}

function emptyDeterministicFail(
  codes: DeterministicCheckResult['abstentionCodes']
): DeterministicCheckResult {
  return {
    ok: false,
    checkCodes: [],
    abstentionCodes: codes,
    numericOk: null,
    nameOk: null,
    dateOk: null,
    unitOk: null,
    negationOk: null,
    modalityOk: null,
    causalityOk: null,
  };
}

export async function runEvidenceEngine(
  args: RunEvidenceEngineArgs
): Promise<RunEvidenceEngineResult> {
  if (args.isCancelled?.()) {
    return { ok: false, code: 'EVIDENCE_CANCELLED', message: 'Creación cancelada' };
  }

  const depth = args.depth ?? args.artifact.depth ?? 'estandar';
  const { ids: allowedIds, chunks, byId } = allowedChunks(args.ingest, args.map);
  const cacheKey =
    args.ownerId && args.contentHash
      ? evidenceCacheKey({
          ownerId: args.ownerId,
          contentHash: args.contentHash,
          sourceVersionId: args.artifact.sourceVersionId,
          depth,
          schemaVersion: EVIDENCE_SCHEMA_VERSION,
          promptVersion: EVIDENCE_PROMPT_VERSION,
          verifierVersion: EVIDENCE_VERIFIER_VERSION,
          compilerVersion: EVIDENCE_COMPILER_VERSION,
          modelRoute: EVIDENCE_MODEL_ROUTE,
        })
      : null;

  if (cacheKey) {
    const hit = getEvidenceCache(cacheKey, args.ownerId!);
    if (hit) {
      const validated = validateEvidenceArtifact(hit, { allowedChunkIds: allowedIds });
      if (validated.ok && validated.value.status === 'complete') {
        const map = applyEvidenceToMap(args.map, validated.value);
        return { ok: true, evidence: validated.value, map, cacheHit: true };
      }
    }
  }

  const claims = extractClaimsFromUnderstanding(args.artifact, {
    contentHash: args.contentHash,
    sourceVersionId: args.artifact.sourceVersionId,
  });

  const work: ClaimWork[] = claims.map((claim) => {
    const allPending = pendingRefsForClaim(claim, args.artifact);
    const pending = allPending.filter((id) => allowedIds.has(id));
    const hallucinatedPending = allPending.filter((id) => !allowedIds.has(id));

    const candidates = retrieveCandidates({
      claim,
      pendingChunkIds: pending,
      chunks,
      allowedChunkIds: allowedIds,
    });

    const forceInference =
      claim.epistemicStatus === 'inference' ||
      claim.epistemicStatus === 'nucleo_adaptation' ||
      claim.slotKey.includes(':rel:') ||
      claim.slotKey.startsWith('layer0:action:');

    if (hallucinatedPending.length) {
      const policy = applyEvidencePolicy({
        claim,
        candidatesUsed: [],
        deterministic: emptyDeterministicFail(['HALLUCINATED_CHUNK']),
        entailment: null,
        forceInference: false,
      });
      return {
        kind: 'resolved' as const,
        claim: policy.claim,
        link: policy.link,
        assessment: policy.assessment,
      };
    }

    if (forceInference) {
      const policy = applyEvidencePolicy({
        claim,
        candidatesUsed: [],
        deterministic: emptyDeterministicFail([]),
        entailment: null,
        forceInference: true,
      });
      return {
        kind: 'resolved' as const,
        claim: policy.claim,
        link: policy.link,
        assessment: policy.assessment,
      };
    }

    if (!candidates.length) {
      const policy = applyEvidencePolicy({
        claim,
        candidatesUsed: [],
        deterministic: emptyDeterministicFail(['NO_ANCHOR']),
        entailment: null,
      });
      return {
        kind: 'resolved' as const,
        claim: policy.claim,
        link: policy.link,
        assessment: policy.assessment,
      };
    }

    return { kind: 'entail' as const, claim, candidates };
  });

  const entailItems: BatchedClaimInput[] = [];
  const entailWorkIndex: number[] = [];
  for (let i = 0; i < work.length; i++) {
    const item = work[i]!;
    if (item.kind === 'entail') {
      entailItems.push({ claim: item.claim, candidates: item.candidates });
      entailWorkIndex.push(i);
    }
  }

  let lastHeartbeatAt = Date.now();
  const emitHeartbeat = (info: { processed: number; total: number }, force = false) => {
    const now = Date.now();
    if (!force && now - lastHeartbeatAt < EVIDENCE_HEARTBEAT_MS) return;
    lastHeartbeatAt = now;
    args.onHeartbeat?.(info);
  };

  emitHeartbeat({ processed: work.length - entailItems.length, total: work.length }, true);
  const heartbeatTimer = setInterval(() => {
    emitHeartbeat(
      { processed: work.length - entailItems.length, total: work.length },
      true
    );
  }, EVIDENCE_HEARTBEAT_MS);

  let modelVersion = 'n/a';

  try {
    if (args.isCancelled?.()) {
      return { ok: false, code: 'EVIDENCE_CANCELLED', message: 'Creación cancelada' };
    }

    const entailResults = await runBatchedEntailment({
      items: entailItems,
      generateJson: args.generateJson,
      isCancelled: args.isCancelled,
      onHeartbeat: (info) =>
        emitHeartbeat(
          {
            processed: work.length - entailItems.length + info.processed,
            total: work.length,
          },
          true
        ),
    });

    if (args.isCancelled?.()) {
      return { ok: false, code: 'EVIDENCE_CANCELLED', message: 'Creación cancelada' };
    }

    const outClaims: ContentClaim[] = [];
    const links: EvidenceLinkV1[] = [];
    const assessments: EvidenceAssessment[] = [];
    const entailByWorkIndex = new Map<number, (typeof entailResults)[number]>();
    entailWorkIndex.forEach((workIndex, i) => {
      entailByWorkIndex.set(workIndex, entailResults[i]!);
    });

    for (let i = 0; i < work.length; i++) {
      const item = work[i]!;
      if (item.kind === 'resolved') {
        outClaims.push(item.claim);
        if (item.link) links.push(item.link);
        assessments.push(item.assessment);
        continue;
      }

      const entailment = entailByWorkIndex.get(i);
      if (!entailment) {
        return {
          ok: false,
          code: 'EVIDENCE_INTERNAL',
          message: 'Faltó el resultado de verificación de una afirmación.',
        };
      }

      modelVersion = entailment.modelVersion;
      const selectedIds = (entailment.chunkIds ?? []).filter((id) => allowedIds.has(id));
      const selectedText = selectedIds
        .map((id) => byId.get(id)?.text ?? '')
        .filter(Boolean)
        .join('\n');

      let deterministic: DeterministicCheckResult;
      if (entailment.error) {
        deterministic = emptyDeterministicFail(['PROVIDER_ERROR']);
      } else if (entailment.decision === 'insufficient' || selectedIds.length === 0) {
        deterministic = emptyDeterministicFail(['NO_ENTAILMENT']);
      } else {
        deterministic = runDeterministicChecks(item.claim.text, selectedText);
      }

      const candidatesUsed = entailment.error
        ? item.candidates.map((c) => c.chunk.id)
        : selectedIds.length
          ? selectedIds
          : entailment.decision === 'contradicts'
            ? (entailment.chunkIds ?? []).filter((id) => allowedIds.has(id))
            : selectedIds;

      const policy = applyEvidencePolicy({
        claim: item.claim,
        candidatesUsed,
        hadCandidates: true,
        deterministic,
        selectedEvidenceText: selectedText,
        entailment: entailment.error
          ? entailment
          : selectedIds.length || entailment.decision === 'contradicts'
            ? {
                ...entailment,
                chunkIds:
                  selectedIds.length > 0
                    ? selectedIds
                    : (entailment.chunkIds ?? []).filter((id) => allowedIds.has(id)),
              }
            : { ...entailment, decision: 'insufficient', chunkIds: [] },
        forceInference: false,
      });

      outClaims.push(policy.claim);
      if (policy.link) links.push(policy.link);
      assessments.push(policy.assessment);
    }

    for (const c of outClaims) {
      if (c.criticality === 'critical' && c.presentationStatus === 'pending') {
        c.presentationStatus = 'insufficient';
        c.epistemicStatus = 'insufficient_information';
        c.abstentionCodes = [...new Set([...c.abstentionCodes, 'NO_ENTAILMENT' as const])];
        c.presentationText = `La fuente no permite determinarlo: ${c.text}`;
      }
    }

    const evidenceCoverage = buildEvidenceCoverage(outClaims);
    const sourceCoverage = buildSourceCoverage({
      ingest: args.ingest,
      pastedComplete: args.pastedComplete,
      webFetchSucceeded: args.webFetchSucceeded,
      partialExtraction:
        Boolean(args.partialExtraction) || Boolean(args.ingest?.needsVisionFallback),
    });

    const evidence: EvidenceArtifact = {
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      promptVersion: EVIDENCE_PROMPT_VERSION,
      verifierVersion: EVIDENCE_VERIFIER_VERSION,
      compilerVersion: EVIDENCE_COMPILER_VERSION,
      modelVersion,
      modelRoute: EVIDENCE_MODEL_ROUTE,
      status: 'complete',
      claims: outClaims,
      links,
      assessments,
      evidenceCoverage,
      sourceCoverage,
    };

    const validated = validateEvidenceArtifact(evidence, { allowedChunkIds: allowedIds });
    if (validated.ok === false) {
      return {
        ok: false,
        code: 'EVIDENCE_CRITICAL_PENDING',
        message: validated.errors.join('; '),
      };
    }

    const map = applyEvidenceToMap(args.map, validated.value);
    if (cacheKey && args.ownerId) {
      setEvidenceCache(cacheKey, args.ownerId, validated.value);
    }
    return { ok: true, evidence: validated.value, map, cacheHit: false };
  } finally {
    clearInterval(heartbeatTimer);
  }
}
