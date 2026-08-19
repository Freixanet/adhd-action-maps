/**
 * S06 reopen residuals — adversarial provenance, fallback quality, cache, cancel exactness.
 * These tests must fail before the corresponding fix lands.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { ActionMapData } from '../contracts';
import type { EvidenceArtifact, ContentClaim, EvidenceLinkV1 } from '../evidence/types';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_MODEL_ROUTE,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from '../evidence/versions';
import {
  applyModelDraft,
  applicationCacheKey,
  applicationPlanDigest,
  attachApplicationReview,
  buildApplicationReview,
  buildDeterministicPlan,
  clearApplicationCache,
  coerceModelPlanDraft,
  evidenceArtifactDigest,
  extractApplicationCandidates,
  isMetaSuccessPlaceholder,
  isVagueSuccessCriterion,
  replanApplicationFromEvidence,
  runApplicationEngine,
  startApplicationAction,
  canonicalContextHash,
} from './index';
import type { ApplicationContextV1 } from './types';
import {
  APPLICATION_COMPILER_VERSION,
  APPLICATION_POLICY_VERSION,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
} from './versions';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
} from '../understanding/versions';

function claim(
  partial: Partial<ContentClaim> & Pick<ContentClaim, 'id' | 'text' | 'presentationStatus'>
): ContentClaim {
  return {
    claimType: 'recommendation',
    criticality: 'critical',
    epistemicStatus: 'faithful_paraphrase',
    evidenceLinkIds: [`lnk_${partial.id}`],
    abstentionCodes: [],
    slotKey: partial.id,
    ...partial,
  };
}

function evidenceFromClaims(
  claims: ContentClaim[],
  linkOverride?: (c: ContentClaim) => EvidenceLinkV1[]
): EvidenceArtifact {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    promptVersion: EVIDENCE_PROMPT_VERSION,
    verifierVersion: EVIDENCE_VERIFIER_VERSION,
    compilerVersion: EVIDENCE_COMPILER_VERSION,
    modelVersion: 'test',
    modelRoute: EVIDENCE_MODEL_ROUTE,
    status: 'complete',
    claims,
    links: claims.flatMap(
      (c) =>
        linkOverride?.(c) ??
        c.evidenceLinkIds.map((id) => ({
          id,
          contentNodeId: c.id,
          segmentId: 'seg1',
          chunkId: `chk_${c.id}`,
          relation: 'supports' as const,
          verifierStatus: 'verified' as const,
          epistemicStatus: 'faithful_paraphrase' as const,
          confidence: null,
          verifierVersion: EVIDENCE_VERIFIER_VERSION,
          checkCodes: [],
          abstentionCodes: [],
        }))
    ),
    assessments: [],
    evidenceCoverage: {
      criticalTotal: claims.length,
      verified: claims.filter((c) => c.presentationStatus === 'verified').length,
      qualified: claims.filter((c) => c.presentationStatus === 'qualified').length,
      contradicted: claims.filter((c) => c.presentationStatus === 'contradicted').length,
      degraded: claims.filter((c) => c.presentationStatus === 'degraded').length,
      uncertain: 0,
      unanchored: 0,
      inference: claims.filter((c) => c.presentationStatus === 'inference').length,
      summaryLines: [],
    },
    sourceCoverage: {
      textual: null,
      extractionConfidence: null,
      isComplete: true,
      limitations: [],
    },
  };
}

const baseMap: ActionMapData = {
  title: 'Mapa',
  coreIdea: 'idea',
  coreSupport: 'support',
  tldr: [{ title: 'A', desc: 'B' }],
  steps: [
    {
      id: 's1',
      shortNav: 'S',
      title: 'Paso',
      time: '1',
      purpose: 'p',
      content: [{ type: 'prose', text: 'x' }],
      references: [],
    },
  ],
};

const ctxReady: ApplicationContextV1 = {
  goal: 'terminar un párrafo del informe',
  situation: 'escritorio por la tarde',
  constraint: 'sin correo',
  horizon: 'próximos 20 minutos',
};

function pins() {
  return {
    understandingSchemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    understandingPromptVersion: UNDERSTANDING_PROMPT_VERSION,
    understandingCompilerVersion: UNDERSTANDING_COMPILER_VERSION,
    evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
    evidencePromptVersion: EVIDENCE_PROMPT_VERSION,
    evidenceVerifierVersion: EVIDENCE_VERIFIER_VERSION,
    evidenceCompilerVersion: EVIDENCE_COMPILER_VERSION,
  };
}

beforeEach(() => clearApplicationCache());

describe('S06 reopen A — fail-closed provenance', () => {
  it('rejects invented candidate id', () => {
    const evidence = evidenceFromClaims([
      claim({
        id: 'c1',
        text: 'Escribe un párrafo sin revisar el correo.',
        presentationStatus: 'verified',
      }),
    ]);
    const ctxHash = canonicalContextHash(ctxReady);
    const candidates = extractApplicationCandidates({
      evidence,
      contentHash: 'h1',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      context: ctxReady,
    });
    const base = buildDeterministicPlan({
      candidates,
      evidence,
      context: ctxReady,
      contentHash: 'h1',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      evidenceDigest: evidenceArtifactDigest(evidence),
      ...pins(),
    });
    const result = applyModelDraft({
      base,
      draft: {
        selectedCandidateId: 'ac_invented',
        verbLedInstruction: 'Escribe un párrafo sin correo.',
        successCriterion: 'Hay un párrafo nuevo guardado en el documento.',
      },
      evidence,
      compilerRisk: 'low',
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.errors.join(' ')).toMatch(/allow-list/i);
  });

  it('rejects chunk from another claim', () => {
    const cA = claim({
      id: 'ca',
      text: 'Cierra pestañas antes de escribir.',
      presentationStatus: 'verified',
      evidenceLinkIds: ['lnk_ca'],
    });
    const cB = claim({
      id: 'cb',
      text: 'Bebe agua cada hora.',
      presentationStatus: 'verified',
      evidenceLinkIds: ['lnk_cb'],
    });
    const evidence = evidenceFromClaims([cA, cB]);
    const tampered = {
      ...evidence,
      links: evidence.links.map((l) =>
        l.id === 'lnk_ca' ? { ...l, chunkId: 'chk_cb', contentNodeId: 'cb' } : l
      ),
    };
    const ctxHash = canonicalContextHash(ctxReady);
    const candidates = extractApplicationCandidates({
      evidence: tampered,
      contentHash: 'h2',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      context: ctxReady,
    });
    const primary = candidates.find((c) => c.claimId === 'ca');
    expect(primary).toBeTruthy();
    const base = buildDeterministicPlan({
      candidates,
      evidence: tampered,
      context: ctxReady,
      contentHash: 'h2',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      evidenceDigest: evidenceArtifactDigest(tampered),
      ...pins(),
    });
    const result = applyModelDraft({
      base: {
        ...base,
        plan: {
          ...base.plan,
          selectedCandidateId: primary!.id,
          sourceChunkIds: ['chk_cb'],
          sourceBasis: 'MODELO INVENTA LA BASE',
        },
      },
      draft: {
        selectedCandidateId: primary!.id,
        verbLedInstruction: 'Cierra pestañas antes de escribir el párrafo.',
        successCriterion: 'Quedan solo las pestañas del documento abiertas.',
      },
      evidence: tampered,
      compilerRisk: 'low',
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errors.join(' ')).toMatch(/chunk|binding|cross/i);
    }
  });

  it('rebuilds sourceBasis from claim; ignores model sourceBasis', () => {
    const evidence = evidenceFromClaims([
      claim({
        id: 'c3',
        text: 'Trabaja 15 minutos en una sola tarea.',
        presentationStatus: 'verified',
      }),
    ]);
    const ctxHash = canonicalContextHash(ctxReady);
    const candidates = extractApplicationCandidates({
      evidence,
      contentHash: 'h3',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      context: ctxReady,
    });
    const base = buildDeterministicPlan({
      candidates,
      evidence,
      context: ctxReady,
      contentHash: 'h3',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      evidenceDigest: evidenceArtifactDigest(evidence),
      ...pins(),
    });
    const coerced = coerceModelPlanDraft({
      sourceBasis: 'EL MODELO MENTE',
      sourceChunkIds: ['chk_fake'],
      risk: 'low',
      status: 'ready',
      id: 'hacked',
      selectedCandidateId: base.plan.selectedCandidateId!,
      verbLedInstruction: 'Trabaja 15 minutos en el párrafo del informe.',
      successCriterion: 'El párrafo tiene al menos tres frases guardadas.',
    });
    expect(coerced).not.toHaveProperty('sourceBasis');
    const result = applyModelDraft({
      base: {
        ...base,
        plan: { ...base.plan, sourceBasis: 'EL MODELO MENTE', risk: 'high_medical' },
      },
      draft: coerced,
      evidence,
      compilerRisk: 'high_medical',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.plan.sourceBasis).not.toBe('EL MODELO MENTE');
    expect(result.artifact.plan.sourceBasis).toMatch(/15 minutos/i);
    expect(result.artifact.plan.risk).toBe('high_medical');
    expect(result.artifact.plan.id).toBe(base.plan.id);
  });

  it('keeps qualified caution; rejects stripping it', () => {
    const evidence = evidenceFromClaims([
      claim({
        id: 'cq',
        text: 'Puede ayudar un descanso corto, según el contexto.',
        presentationStatus: 'qualified',
      }),
    ]);
    const ctxHash = canonicalContextHash(ctxReady);
    const candidates = extractApplicationCandidates({
      evidence,
      contentHash: 'hq',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      context: ctxReady,
    });
    const base = buildDeterministicPlan({
      candidates,
      evidence,
      context: ctxReady,
      contentHash: 'hq',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      evidenceDigest: evidenceArtifactDigest(evidence),
      ...pins(),
    });
    expect(base.plan.assumptions.some((a) => /matiz|cautela/i.test(a.text))).toBe(true);
    const stripped = {
      ...base,
      plan: {
        ...base.plan,
        assumptions: base.plan.assumptions.filter((a) => !/matiz|cautela/i.test(a.text)),
      },
    };
    const result = applyModelDraft({
      base: stripped,
      draft: {
        selectedCandidateId: base.plan.selectedCandidateId!,
        verbLedInstruction: 'Prueba un descanso corto antes del párrafo.',
        successCriterion: 'Has anotado si el descanso te dejó escribir dos frases.',
      },
      evidence,
      compilerRisk: 'low',
    });
    expect(result.ok).toBe(false);
  });

  it('cannot downgrade high_* risk to low', () => {
    const evidence = evidenceFromClaims([
      claim({
        id: 'cm',
        text: 'Consulta médica antes de cambiar la medicación.',
        presentationStatus: 'verified',
      }),
    ]);
    const ctxHash = canonicalContextHash(ctxReady);
    const candidates = extractApplicationCandidates({
      evidence,
      contentHash: 'hm',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      context: ctxReady,
    });
    const base = buildDeterministicPlan({
      candidates,
      evidence,
      context: ctxReady,
      contentHash: 'hm',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      evidenceDigest: evidenceArtifactDigest(evidence),
      ...pins(),
    });
    const result = applyModelDraft({
      base: { ...base, plan: { ...base.plan, risk: 'low' } },
      draft: {
        selectedCandidateId: base.plan.selectedCandidateId!,
        verbLedInstruction: 'Anota la duda para preguntar al médico.',
        successCriterion: 'La duda está escrita en una nota para la consulta.',
      },
      evidence,
      compilerRisk: 'high_medical',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.plan.risk).toBe('high_medical');
  });

  it('rejects contradicted claim as action ground', () => {
    const evidence = evidenceFromClaims([
      claim({
        id: 'cx',
        text: 'Ignora el sueño y trabaja toda la noche.',
        presentationStatus: 'contradicted',
      }),
    ]);
    const ctxHash = canonicalContextHash(ctxReady);
    const candidates = extractApplicationCandidates({
      evidence,
      contentHash: 'hx',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      context: ctxReady,
    });
    const base = buildDeterministicPlan({
      candidates,
      evidence,
      context: ctxReady,
      contentHash: 'hx',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      evidenceDigest: evidenceArtifactDigest(evidence),
      ...pins(),
    });
    expect(['abstained', 'needs_context'].includes(base.plan.status) || !base.plan.action).toBe(
      true
    );
    if (base.plan.selectedCandidateId && base.plan.action) {
      const result = applyModelDraft({
        base,
        draft: {
          selectedCandidateId: base.plan.selectedCandidateId,
          verbLedInstruction: 'Trabaja toda la noche sin dormir.',
          successCriterion: 'Has terminado el informe a las 6am.',
        },
        evidence,
        compilerRisk: 'low',
      });
      expect(result.ok).toBe(false);
    }
  });

  it('labels inference so it is not a literal source recommendation', () => {
    const evidence = evidenceFromClaims([
      claim({
        id: 'ci',
        text: 'Quizá un temporizador externo ayude a empezar.',
        presentationStatus: 'inference',
      }),
    ]);
    const ctxHash = canonicalContextHash(ctxReady);
    const candidates = extractApplicationCandidates({
      evidence,
      contentHash: 'hi',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      context: ctxReady,
    });
    const base = buildDeterministicPlan({
      candidates,
      evidence,
      context: ctxReady,
      contentHash: 'hi',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      evidenceDigest: evidenceArtifactDigest(evidence),
      ...pins(),
    });
    if (base.plan.status === 'abstained' || base.plan.status === 'needs_context') {
      expect(base.plan.sourceBasis || base.plan.inference).toMatch(/inferencia|abstenc/i);
      return;
    }
    expect(base.plan.sourceBasis).toMatch(/inferencia/i);
    expect(base.plan.assumptions.some((a) => /inferencia/i.test(a.text))).toBe(true);
  });
});

describe('S06 reopen B — fallback quality', () => {
  it('meta success placeholders are rejected', () => {
    expect(isMetaSuccessPlaceholder('Señalar un resultado concreto (hecho, no sensación)')).toBe(
      true
    );
    expect(isVagueSuccessCriterion('Señalar un resultado concreto')).toBe(true);
    expect(
      isVagueSuccessCriterion(
        'Al terminar el bloque, dejas un registro escrito de qué parte aplicaste.'
      )
    ).toBe(false);
  });

  it('provider down yields specific claim-bound action, not meta advice', async () => {
    const texts = [
      'Escribe el primer párrafo sin abrir el correo.',
      'Cierra todas las pestañas ajenas al documento.',
      'Anota tres bullets del argumento central.',
    ];
    for (const text of texts) {
      const result = await runApplicationEngine({
        body: { type: 'text', intent: 'apply', depth: 'estandar' },
        map: baseMap,
        evidence: evidenceFromClaims([
          claim({ id: `p_${text.slice(0, 8)}`, text, presentationStatus: 'verified' }),
        ]),
        contentHash: `hash_${text}`,
        context: ctxReady,
        generateJson: async () => {
          throw new Error('provider down');
        },
        buildPlanPrompts: () => ({ system: 's', user: 'u' }),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const action = result.artifact.plan.action?.verbLedInstruction ?? '';
      expect(action).not.toMatch(/versi[oó]n m[ií]nima de la idea/i);
      expect(action.length).toBeGreaterThan(20);
      expect(isMetaSuccessPlaceholder(result.artifact.plan.action!.successCriterion)).toBe(
        false
      );
      // Action references the claim idea
      expect(action.toLowerCase()).toMatch(/párrafo|pestañas|bullets|anota|escribe|cierra/);
    }
  });
});

describe('S06 reopen F — cache invalidation', () => {
  it('different evidence digest with same contentHash does not reuse plan', async () => {
    const e1 = evidenceFromClaims([
      claim({ id: 'e1', text: 'Escribe un párrafo corto.', presentationStatus: 'verified' }),
    ]);
    const e2 = evidenceFromClaims([
      claim({
        id: 'e2',
        text: 'Escribe un esquema de tres puntos.',
        presentationStatus: 'verified',
      }),
    ]);
    expect(evidenceArtifactDigest(e1)).not.toBe(evidenceArtifactDigest(e2));

    const first = await runApplicationEngine({
      body: { type: 'text', intent: 'apply', depth: 'estandar' },
      map: baseMap,
      evidence: e1,
      contentHash: 'same-hash',
      context: ctxReady,
      ownerId: 'owner-cache',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await runApplicationEngine({
      body: { type: 'text', intent: 'apply', depth: 'estandar' },
      map: baseMap,
      evidence: e2,
      contentHash: 'same-hash',
      context: ctxReady,
      ownerId: 'owner-cache',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.cacheHit).toBe(false);
    expect(second.artifact.plan.sourceBasis).not.toBe(first.artifact.plan.sourceBasis);
  });

  it('cache key includes evidence digest and S04/S05 pins', () => {
    const a = applicationCacheKey({
      ownerId: 'o',
      contentHash: 'h',
      depth: 'estandar',
      contextCanonicalHash: 'c',
      evidenceDigest: 'd1',
      understandingSchemaVersion: UNDERSTANDING_SCHEMA_VERSION,
      understandingPromptVersion: UNDERSTANDING_PROMPT_VERSION,
      understandingCompilerVersion: UNDERSTANDING_COMPILER_VERSION,
      evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
      evidencePromptVersion: EVIDENCE_PROMPT_VERSION,
      evidenceVerifierVersion: EVIDENCE_VERIFIER_VERSION,
      evidenceCompilerVersion: EVIDENCE_COMPILER_VERSION,
    });
    const b = applicationCacheKey({
      ownerId: 'o',
      contentHash: 'h',
      depth: 'estandar',
      contextCanonicalHash: 'c',
      evidenceDigest: 'd2',
      understandingSchemaVersion: UNDERSTANDING_SCHEMA_VERSION,
      understandingPromptVersion: UNDERSTANDING_PROMPT_VERSION,
      understandingCompilerVersion: UNDERSTANDING_COMPILER_VERSION,
      evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
      evidencePromptVersion: EVIDENCE_PROMPT_VERSION,
      evidenceVerifierVersion: EVIDENCE_VERIFIER_VERSION,
      evidenceCompilerVersion: EVIDENCE_COMPILER_VERSION,
    });
    expect(a).not.toBe(b);
  });
});

describe('S06 reopen D — start + review digest stability', () => {
  it('start action sets in_progress without changing plan digest', async () => {
    const result = await runApplicationEngine({
      body: { type: 'text', intent: 'apply', depth: 'estandar' },
      map: baseMap,
      evidence: evidenceFromClaims([
        claim({
          id: 'st',
          text: 'Escribe el párrafo de apertura.',
          presentationStatus: 'verified',
        }),
      ]),
      contentHash: 'h-start',
      context: ctxReady,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const before = applicationPlanDigest(result.artifact);
    const started = startApplicationAction(result.artifact, '2026-07-29T12:00:00.000Z');
    expect(started).not.toBeNull();
    expect(started!.plan.status).toBe('in_progress');
    expect(started!.plan.startedAt).toBe('2026-07-29T12:00:00.000Z');
    expect(applicationPlanDigest(started!)).toBe(before);
  });

  it('review does not change plan digest', async () => {
    const result = await runApplicationEngine({
      body: { type: 'text', intent: 'apply', depth: 'estandar' },
      map: baseMap,
      evidence: evidenceFromClaims([
        claim({
          id: 'rv',
          text: 'Escribe el párrafo de cierre.',
          presentationStatus: 'verified',
        }),
      ]),
      contentHash: 'h-rev',
      context: ctxReady,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const before = applicationPlanDigest(result.artifact);
    const review = buildApplicationReview({
      artifact: result.artifact,
      outcome: 'worked',
      wantsAdjust: false,
      wantsRepeat: true,
      reviewedAt: '2026-07-29T13:00:00.000Z',
    });
    const next = attachApplicationReview(result.artifact, review);
    expect(next).not.toBeNull();
    expect(applicationPlanDigest(next!)).toBe(before);
  });
});

describe('S06 reopen C — replan from evidence', () => {
  it('new context yields new identity without needing new evidence engine', async () => {
    const evidence = evidenceFromClaims([
      claim({
        id: 'rp',
        text: 'Escribe un párrafo sin distracciones.',
        presentationStatus: 'verified',
      }),
    ]);
    const first = await runApplicationEngine({
      body: { type: 'text', intent: 'apply', depth: 'estandar' },
      map: baseMap,
      evidence,
      contentHash: 'h-rp',
      context: ctxReady,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const replanned = await replanApplicationFromEvidence({
      previous: first.artifact,
      baseMap,
      evidence,
      context: {
        ...ctxReady,
        goal: 'terminar la sección 2 del informe',
        horizon: 'mañana a las 10',
      },
    });
    expect(replanned.ok).toBe(true);
    if (!replanned.ok) return;
    expect(replanned.previousPreserved).toBe(false);
    expect(replanned.artifact.contextCanonicalHash).not.toBe(
      first.artifact.contextCanonicalHash
    );
    expect(replanned.artifact.plan.id).not.toBe(first.artifact.plan.id);
    expect(applicationPlanDigest(replanned.artifact)).not.toBe(
      applicationPlanDigest(first.artifact)
    );
  });
});

describe('S06 reopen I — exact cancellation outcomes', () => {
  it('cancel before candidates → APPLICATION_CANCELLED', async () => {
    const result = await runApplicationEngine({
      body: { type: 'text', intent: 'apply', depth: 'estandar' },
      map: baseMap,
      evidence: evidenceFromClaims([
        claim({ id: 'z1', text: 'Escribe un párrafo.', presentationStatus: 'verified' }),
      ]),
      contentHash: 'hz1',
      context: ctxReady,
      isCancelled: () => true,
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.code).toBe('APPLICATION_CANCELLED');
  });

  it('cancel after deterministic before model → APPLICATION_CANCELLED', async () => {
    let stage = 0;
    const result = await runApplicationEngine({
      body: { type: 'text', intent: 'apply', depth: 'estandar' },
      map: baseMap,
      evidence: evidenceFromClaims([
        claim({ id: 'z2', text: 'Escribe un párrafo.', presentationStatus: 'verified' }),
      ]),
      contentHash: 'hz2',
      context: ctxReady,
      isCancelled: () => stage >= 1,
      onStage: () => {
        stage += 1;
      },
      generateJson: async () => ({ text: '{}', model: 'm' }),
      buildPlanPrompts: () => ({ system: 's', user: 'u' }),
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.code).toBe('APPLICATION_CANCELLED');
  });
});

describe('version pins present on artifact', () => {
  it('deterministic plan carries schema pins used in reopen', async () => {
    const result = await runApplicationEngine({
      body: { type: 'text', intent: 'apply', depth: 'estandar' },
      map: baseMap,
      evidence: evidenceFromClaims([
        claim({ id: 'ver', text: 'Escribe un párrafo.', presentationStatus: 'verified' }),
      ]),
      contentHash: 'hver',
      context: ctxReady,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.schemaVersion).toBe(APPLICATION_SCHEMA_VERSION);
    expect(result.artifact.promptVersion).toBe(APPLICATION_PROMPT_VERSION);
    expect(result.artifact.compilerVersion).toBe(APPLICATION_COMPILER_VERSION);
    expect(result.artifact.policyVersion).toBe(APPLICATION_POLICY_VERSION);
    expect(result.artifact.evidenceDigest).toBeTruthy();
  });
});
