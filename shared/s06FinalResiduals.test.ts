/**
 * S06 final residuals — replan confirmation coordinator, CAS pending, high-risk action.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { configureStorage, type SyncKeyValueStorage } from './storage';
import {
  flushPendingApplicationOps,
  loadPendingApplicationOps,
  upsertPendingApplicationOp,
  resolveReplanArtifactForFlush,
  markReplanSuperseded,
  sealPendingApplicationOpsForUser,
} from './pendingApplicationOps';
import {
  applyModelDraft,
  applicationPlanDigest,
  attemptCloudReplan,
  buildDeterministicPlan,
  buildStagedReplan,
  consolidateGuestReplan,
  extractApplicationCandidates,
  setActivePlanDigest,
  getActivePlanDigest,
  toImmutableApplicationArtifact,
  canonicalContextHash,
  evidenceArtifactDigest,
  isDangerousHighRiskInstruction,
  safeConsultInstructionForRisk,
} from './application';
import type { ApplicationArtifactV1, ApplicationContextV1 } from './application/types';
import type { ContentClaim, EvidenceArtifact } from './evidence/types';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_MODEL_ROUTE,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from './evidence/versions';
import {
  APPLICATION_COMPILER_VERSION,
  APPLICATION_MODEL_ROUTE,
  APPLICATION_POLICY_VERSION,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
} from './application/versions';

function memoryStorage(): SyncKeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

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

function evidenceFromClaims(claims: ContentClaim[]): EvidenceArtifact {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    promptVersion: EVIDENCE_PROMPT_VERSION,
    verifierVersion: EVIDENCE_VERIFIER_VERSION,
    compilerVersion: EVIDENCE_COMPILER_VERSION,
    modelVersion: 'test',
    modelRoute: EVIDENCE_MODEL_ROUTE,
    status: 'complete',
    claims,
    links: claims.flatMap((c) =>
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
      qualified: 0,
      contradicted: 0,
      degraded: 0,
      uncertain: 0,
      unanchored: 0,
      inference: 0,
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

const ctx: ApplicationContextV1 = {
  goal: 'terminar un párrafo',
  situation: 'escritorio',
  constraint: 'sin correo',
  horizon: 'esta tarde',
};

const OWNER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function minimalArt(stamp: string): ApplicationArtifactV1 {
  return {
    schemaVersion: APPLICATION_SCHEMA_VERSION,
    promptVersion: APPLICATION_PROMPT_VERSION,
    compilerVersion: APPLICATION_COMPILER_VERSION,
    policyVersion: APPLICATION_POLICY_VERSION,
    modelVersion: 'test',
    modelRoute: APPLICATION_MODEL_ROUTE,
    status: 'complete',
    contentHash: `hash-${stamp}`,
    depth: 'estandar',
    contextCanonicalHash: `ctx-${stamp}`,
    context: { goal: 'cerrar' },
    candidates: [],
    plan: {
      id: `ap_${stamp}`,
      status: 'ready',
      selectedCandidateId: null,
      sourceBasis: 'Fuente.',
      inference: 'Inferencia.',
      adaptation: 'Adaptación.',
      assumptions: [],
      action: {
        id: `aa_${stamp}`,
        verbLedInstruction: 'Escribe un párrafo corto.',
        whenOrTrigger: 'hoy',
        durationOrScope: '10 min',
        obstacle: 'ruido',
        mitigation: 'silencio',
        successCriterion: 'Un párrafo guardado.',
        stopOrChangeCriterion: 'Para si hay reunión.',
      },
      reviewTrigger: 'Al terminar',
      reviewQuestions: ['¿Listo?'],
      risk: 'low',
      sourceChunkIds: [],
    },
    review: null,
    createdAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  configureStorage(memoryStorage());
});

describe('S06 residual — replan confirmation coordinator', () => {
  it('stages P2 without consolidating when started plan requires confirmation', async () => {
    const p1 = {
      ...minimalArt('p1'),
      plan: { ...minimalArt('p1').plan, startedAt: '2026-07-29T18:00:00.000Z', status: 'in_progress' as const },
    };
    const p2 = minimalArt('p2');
    setActivePlanDigest(OWNER, 'map-1', applicationPlanDigest(toImmutableApplicationArtifact(p1)));

    const staged = buildStagedReplan({
      mapId: 'map-1',
      previousArtifact: p1,
      proposedArtifact: p2,
      userId: OWNER,
    });
    expect('error' in staged).toBe(false);
    if ('error' in staged) return;

    // Active remains P1 until confirm — coordinator does not mutate session.
    expect(staged.previousDigest).toBe(
      applicationPlanDigest(toImmutableApplicationArtifact(p1))
    );
    expect(staged.proposedDigest).not.toBe(staged.previousDigest);

    const result = await attemptCloudReplan({
      staged,
      auth: { accessToken: 't', supabaseUrl: 'http://x', supabaseAnonKey: 'k' },
      ownerId: OWNER,
      confirmReplace: false,
      persistReplan: async () => {
        throw new Error('must not call RPC before local confirmation gate');
      },
    });
    expect(result.status).toBe('requires_confirmation');
    if (result.status !== 'requires_confirmation') return;
    expect(result.staged.proposedDigest).toBe(staged.proposedDigest);

    // Cancel path: guest keep P1
    expect(consolidateGuestReplan(staged).status).toBe('consolidated');
  });

  it('confirm with confirmReplace true consolidates via RPC', async () => {
    const p1 = {
      ...minimalArt('c1'),
      plan: { ...minimalArt('c1').plan, startedAt: '2026-07-29T18:00:00.000Z' },
    };
    const p2 = minimalArt('c2');
    setActivePlanDigest(OWNER, 'map-c', applicationPlanDigest(toImmutableApplicationArtifact(p1)));
    const staged = buildStagedReplan({
      mapId: 'map-c',
      previousArtifact: p1,
      proposedArtifact: p2,
      userId: OWNER,
    });
    if ('error' in staged) throw new Error(staged.error);

    const confirmed = await attemptCloudReplan({
      staged,
      auth: { accessToken: 't', supabaseUrl: 'http://x', supabaseAnonKey: 'k' },
      ownerId: OWNER,
      confirmReplace: true,
      persistReplan: async (args) => {
        expect(args.confirmReplace).toBe(true);
        expect(args.previousDigest).toBe(staged.previousDigest);
        expect(applicationPlanDigest(args.application)).toBe(staged.proposedDigest);
        return {
          ok: true,
          status: 'complete',
          replaced: true,
          planDigest: staged.proposedDigest,
        };
      },
    });
    expect(confirmed.status).toBe('consolidated');
    if (confirmed.status !== 'consolidated') return;
    expect(getActivePlanDigest(OWNER, 'map-c')).toBe(staged.proposedDigest);
  });

  it('A→B during confirm aborts without consolidating', async () => {
    const p1 = minimalArt('ab1');
    const p2 = minimalArt('ab2');
    setActivePlanDigest(OWNER, 'map-ab', applicationPlanDigest(p1));
    const staged = buildStagedReplan({
      mapId: 'map-ab',
      previousArtifact: p1,
      proposedArtifact: p2,
      userId: OWNER,
    });
    if ('error' in staged) throw new Error(staged.error);
    let current = true;
    const aborted = await attemptCloudReplan({
      staged,
      auth: { accessToken: 't', supabaseUrl: 'http://x', supabaseAnonKey: 'k' },
      ownerId: OWNER,
      confirmReplace: true,
      isCurrent: () => current,
      persistReplan: async () => {
        current = false; // owner switched mid-flight
        return { ok: true, status: 'complete', planDigest: staged.proposedDigest };
      },
    });
    expect(aborted.status).toBe('aborted');
  });
});

describe('S06 residual — CAS + exact replan pending', () => {
  it('1) restart with P2 pending and P1 active cloud keeps CAS previousDigest', async () => {
    const p1 = minimalArt('cas1');
    const p2 = minimalArt('cas2');
    const d1 = applicationPlanDigest(p1);
    const d2 = applicationPlanDigest(toImmutableApplicationArtifact(p2));
    setActivePlanDigest(OWNER, 'map-cas', d1);
    upsertPendingApplicationOp(OWNER, {
      kind: 'replan',
      mapId: 'map-cas',
      planDigest: d2,
      previousDigest: d1,
      confirmReplace: false,
      immutableArtifact: toImmutableApplicationArtifact(p2),
    });
    sealPendingApplicationOpsForUser(OWNER);

    const afterRestart = loadPendingApplicationOps(OWNER);
    expect(afterRestart).toHaveLength(1);
    expect(afterRestart[0]!.previousDigest).toBe(d1);
    expect(afterRestart[0]!.planDigest).toBe(d2);
    expect(getActivePlanDigest(OWNER, 'map-cas')).toBe(d1);

    await flushPendingApplicationOps(
      OWNER,
      { accessToken: 't', supabaseUrl: 'http://x', supabaseAnonKey: 'k' },
      {
        getApplicationForMap: () => p1, // local still P1
        persistReplan: async (args) => {
          expect(args.previousDigest).toBe(d1);
          expect(applicationPlanDigest(args.application)).toBe(d2);
          return { ok: true, status: 'complete', replaced: true, planDigest: d2 };
        },
        persistPlan: async () => {
          throw new Error('must not call plan');
        },
      }
    );
    expect(getActivePlanDigest(OWNER, 'map-cas')).toBe(d2);
    expect(loadPendingApplicationOps(OWNER)).toHaveLength(0);
  });

  it('2–3) other device P1→P3 before retry: P2 conflicts and never overwrites P3', async () => {
    const p1 = minimalArt('x1');
    const p2 = minimalArt('x2');
    const p3 = minimalArt('x3');
    const d1 = applicationPlanDigest(p1);
    const d2 = applicationPlanDigest(toImmutableApplicationArtifact(p2));
    const d3 = applicationPlanDigest(toImmutableApplicationArtifact(p3));
    setActivePlanDigest(OWNER, 'map-x', d1);
    upsertPendingApplicationOp(OWNER, {
      kind: 'replan',
      mapId: 'map-x',
      planDigest: d2,
      previousDigest: d1,
      immutableArtifact: toImmutableApplicationArtifact(p2),
    });

    // Cloud already at P3 (active digest store updated by other device hydrate)
    setActivePlanDigest(OWNER, 'map-x', d3);

    const flush = await flushPendingApplicationOps(
      OWNER,
      { accessToken: 't', supabaseUrl: 'http://x', supabaseAnonKey: 'k' },
      {
        getApplicationForMap: () => p3,
        persistReplan: async (args) => {
          expect(args.previousDigest).toBe(d1); // exact original CAS
          expect(applicationPlanDigest(args.application)).toBe(d2); // still P2 payload
          return {
            ok: false,
            status: 409,
            error: 'APPLICATION_IDEMPOTENCY_CONFLICT',
            code: 'APPLICATION_IDEMPOTENCY_CONFLICT',
            activePlanDigest: d3,
          };
        },
      }
    );
    expect(flush.failed.some((f) => f.kind === 'replan')).toBe(true);
    // P3 remains active in store — P2 did not win
    expect(getActivePlanDigest(OWNER, 'map-x')).toBe(d3);
  });

  it('4) pending P2 with local P3 does not persist P3 under P2 identity', () => {
    const p2 = minimalArt('y2');
    const p3 = minimalArt('y3');
    const d2 = applicationPlanDigest(toImmutableApplicationArtifact(p2));
    const d3 = applicationPlanDigest(toImmutableApplicationArtifact(p3));
    const item = {
      kind: 'replan' as const,
      mapId: 'map-y',
      planDigest: d2,
      previousDigest: 'prevdigest12',
      immutableArtifact: toImmutableApplicationArtifact(p2),
      updatedAt: Date.now(),
    };
    const resolved = resolveReplanArtifactForFlush(item, p3);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(applicationPlanDigest(resolved.artifact)).toBe(d2);
      expect(applicationPlanDigest(resolved.artifact)).not.toBe(d3);
    }

    // Without stored artifact, local P3 mismatches → reject
    const noStored = {
      kind: 'replan' as const,
      mapId: 'map-y',
      planDigest: d2,
      previousDigest: 'prevdigest12',
      updatedAt: Date.now(),
    };
    expect(resolveReplanArtifactForFlush(noStored, p3)).toEqual({
      ok: false,
      reason: 'digest_mismatch',
    });
    markReplanSuperseded(OWNER, 'map-y', d2, d3);
  });

  it('5) confirmation accepted after restart keeps CAS', async () => {
    const p1 = {
      ...minimalArt('z1'),
      plan: { ...minimalArt('z1').plan, startedAt: '2026-07-29T10:00:00.000Z' },
    };
    const p2 = minimalArt('z2');
    const d1 = applicationPlanDigest(toImmutableApplicationArtifact(p1));
    const d2 = applicationPlanDigest(toImmutableApplicationArtifact(p2));
    setActivePlanDigest(OWNER, 'map-z', d1);
    upsertPendingApplicationOp(OWNER, {
      kind: 'replan',
      mapId: 'map-z',
      planDigest: d2,
      previousDigest: d1,
      confirmReplace: true,
      awaitingConfirmation: false,
      immutableArtifact: toImmutableApplicationArtifact(p2),
    });
    sealPendingApplicationOpsForUser(OWNER);

    await flushPendingApplicationOps(
      OWNER,
      { accessToken: 't', supabaseUrl: 'http://x', supabaseAnonKey: 'k' },
      {
        getApplicationForMap: () => p1,
        persistReplan: async (args) => {
          expect(args.confirmReplace).toBe(true);
          expect(args.previousDigest).toBe(d1);
          expect(applicationPlanDigest(args.application)).toBe(d2);
          return { ok: true, status: 'complete', replaced: true, planDigest: d2 };
        },
      }
    );
    expect(getActivePlanDigest(OWNER, 'map-z')).toBe(d2);
  });

  it('awaiting_confirmation is not auto-flushed as network retry', async () => {
    const p2 = minimalArt('w2');
    const d2 = applicationPlanDigest(toImmutableApplicationArtifact(p2));
    upsertPendingApplicationOp(OWNER, {
      kind: 'replan',
      mapId: 'map-w',
      planDigest: d2,
      previousDigest: 'prevdigest99',
      awaitingConfirmation: true,
      confirmReplace: false,
      immutableArtifact: toImmutableApplicationArtifact(p2),
    });
    let called = 0;
    await flushPendingApplicationOps(
      OWNER,
      { accessToken: 't', supabaseUrl: 'http://x', supabaseAnonKey: 'k' },
      {
        getApplicationForMap: () => null,
        persistReplan: async () => {
          called += 1;
          return { ok: true, status: 'complete' };
        },
      }
    );
    expect(called).toBe(0);
    expect(loadPendingApplicationOps(OWNER)).toHaveLength(1);
  });
});

describe('S06 residual — high-risk final action policy', () => {
  function applyHighRiskPick(args: {
    lowText: string;
    highText: string;
    highClaimId: string;
    draftVerb: string;
  }) {
    const evidence = evidenceFromClaims([
      claim({ id: 'low', text: args.lowText, presentationStatus: 'verified' }),
      claim({
        id: args.highClaimId,
        text: args.highText,
        presentationStatus: 'verified',
      }),
    ]);
    const ctxHash = canonicalContextHash(ctx);
    const candidates = extractApplicationCandidates({
      evidence,
      contentHash: 'h-hr',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      context: ctx,
    });
    const primary = candidates.find((c) => c.claimId === 'low')!;
    const secondary = candidates.find((c) => c.claimId === args.highClaimId)!;
    const base = buildDeterministicPlan({
      candidates,
      evidence,
      context: ctx,
      contentHash: 'h-hr',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      evidenceDigest: evidenceArtifactDigest(evidence),
      forcedCandidateId: primary.id,
    });
    return applyModelDraft({
      base,
      draft: {
        selectedCandidateId: secondary.id,
        verbLedInstruction: args.draftVerb,
        successCriterion: 'Hecho sin consultar.',
      },
      evidence,
      compilerRisk: 'low',
    });
  }

  it('medical: never “cambia la dosis”; consult or abstain', () => {
    const applied = applyHighRiskPick({
      lowText: 'Escribe un párrafo corto sin correo.',
      highText: 'Consulta la medicación con tu psiquiatra antes de cambiar la dosis.',
      highClaimId: 'med',
      draftVerb: 'Cambia la dosis esta tarde.',
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.artifact.plan.risk).toBe('high_medical');
    const verb = applied.artifact.plan.action?.verbLedInstruction ?? '';
    expect(verb).not.toMatch(/cambia\s+la\s+dosis|ajusta\s+la\s+medicaci[oó]n/i);
    if (applied.artifact.plan.action) {
      expect(verb).toMatch(/consult/i);
      expect(isDangerousHighRiskInstruction('high_medical', verb)).toBe(false);
    } else {
      expect(['abstained', 'needs_context']).toContain(applied.artifact.plan.status);
    }
  });

  it('legal fixture: no direct signing/lawsuit instruction', () => {
    expect(isDangerousHighRiskInstruction('high_legal', 'Firma el contrato sin abogado.')).toBe(
      true
    );
    expect(safeConsultInstructionForRisk('high_legal')).toMatch(/legal/i);
    const applied = applyHighRiskPick({
      lowText: 'Escribe un párrafo corto sin correo.',
      highText: 'Antes de firmar un contrato, habla con un abogado.',
      highClaimId: 'leg',
      draftVerb: 'Firma el contrato sin abogado esta tarde.',
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.artifact.plan.risk).toBe('high_legal');
    const verb = applied.artifact.plan.action?.verbLedInstruction ?? '';
    expect(verb).not.toMatch(/firma\s+el\s+contrato/i);
  });

  it('financial fixture: no direct invest instruction', () => {
    expect(
      isDangerousHighRiskInstruction('high_financial', 'Invierte en cripto esta tarde.')
    ).toBe(true);
    const applied = applyHighRiskPick({
      lowText: 'Escribe un párrafo corto sin correo.',
      highText: 'Antes de invertir en cripto, consulta a un asesor financiero.',
      highClaimId: 'fin',
      draftVerb: 'Invierte en cripto esta tarde.',
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.artifact.plan.risk).toBe('high_financial');
    const verb = applied.artifact.plan.action?.verbLedInstruction ?? '';
    expect(verb).not.toMatch(/invert/i);
  });

  it('physical fixture: no force-through-injury instruction', () => {
    expect(
      isDangerousHighRiskInstruction('high_physical', 'Ignora el dolor y fuerza la lesión.')
    ).toBe(true);
    const applied = applyHighRiskPick({
      lowText: 'Escribe un párrafo corto sin correo.',
      highText: 'Ante dolor agudo o lesión, consulta a un profesional de salud.',
      highClaimId: 'phy',
      draftVerb: 'Ignora el dolor y fuerza la lesión hoy.',
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.artifact.plan.risk).toBe('high_physical');
    const verb = applied.artifact.plan.action?.verbLedInstruction ?? '';
    expect(verb).not.toMatch(/ignor|fuerza\s+la\s+lesi/i);
  });
});
