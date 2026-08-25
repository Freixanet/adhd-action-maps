/**
 * S06 productive fixes — coordination + policy tests that fail before the fix.
 * RLS/cloud cases live in s06ApplicationRls.integration.test.ts.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { configureStorage, type SyncKeyValueStorage } from './storage';
import {
  flushPendingApplicationOps,
  loadPendingApplicationOps,
  sealPendingApplicationOpsForUser,
  clearPendingApplicationOpsForUser,
  upsertPendingApplicationOp,
  pendingApplicationBannerMessage,
  reconcilePendingApplicationOpsWithHistory,
  isApplicationSyncPendingCopy,
  removeAllPendingApplicationOpsForMap,
} from './pendingApplicationOps';
import {
  applyModelDraft,
  applicationPlanDigest,
  attachApplicationReview,
  buildApplicationReview,
  buildDeterministicPlan,
  extractApplicationCandidates,
  startApplicationAction,
  syncApplicationCloudState,
  toImmutableApplicationArtifact,
  canonicalContextHash,
  evidenceArtifactDigest,
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

function buildArt(text = 'Escribe un párrafo sin abrir el correo.'): ApplicationArtifactV1 {
  const evidence = evidenceFromClaims([
    claim({ id: 'flow1', text, presentationStatus: 'verified' }),
  ]);
  const ctxHash = canonicalContextHash(ctx);
  const candidates = extractApplicationCandidates({
    evidence,
    contentHash: 'h-flow',
    depth: 'estandar',
    contextCanonicalHash: ctxHash,
    context: ctx,
  });
  return buildDeterministicPlan({
    candidates,
    evidence,
    context: ctx,
    contentHash: 'h-flow',
    depth: 'estandar',
    contextCanonicalHash: ctxHash,
    evidenceDigest: evidenceArtifactDigest(evidence),
  });
}

beforeEach(() => {
  configureStorage(memoryStorage());
});

describe('S06 productive — syncApplicationCloudState (AppSession coordination)', () => {
  it('3) persist → start → syncCloudEntry: execution RPC only; no plan pending', async () => {
    const art = buildArt();
    const digest = applicationPlanDigest(art);
    const started = startApplicationAction(art, '2026-07-29T20:00:00.000Z')!;
    const rpcs: string[] = [];
    const seenArtifacts: ApplicationArtifactV1[] = [];

    const result = await syncApplicationCloudState({
      accessToken: 't',
      supabaseUrl: 'http://localhost',
      supabaseAnonKey: 'k',
      ownerId: OWNER,
      mapId: 'map-start-sync',
      application: started,
      previousPlanDigest: digest,
      persistPlan: async (args) => {
        rpcs.push('plan');
        seenArtifacts.push(args.application);
        expect(args.application.plan.startedAt).toBeUndefined();
        expect(args.application.review).toBeNull();
        expect(applicationPlanDigest(args.application)).toBe(digest);
        return { ok: true, status: 'complete', idempotent: true, planDigest: digest };
      },
      persistExecution: async (args) => {
        rpcs.push('execution');
        expect(args.startedAt).toBe('2026-07-29T20:00:00.000Z');
        expect(args.planDigest).toBe(digest);
        return { ok: true, status: 'complete', planDigest: digest };
      },
      persistReview: async () => {
        rpcs.push('review');
        return { ok: true, status: 'complete' };
      },
      persistReplan: async () => {
        rpcs.push('replan');
        return { ok: true, status: 'complete' };
      },
    });

    expect(result.usedCorrectRpcs).toBe(true);
    expect(rpcs).toEqual(['plan', 'execution']);
    expect(loadPendingApplicationOps(OWNER)).toHaveLength(0);
    expect(seenArtifacts[0]!.plan.startedAt).toBeUndefined();
  });

  it('4) review → syncCloudEntry: review RPC; no false plan pending', async () => {
    const art = buildArt();
    const digest = applicationPlanDigest(art);
    const started = startApplicationAction(art, '2026-07-29T21:00:00.000Z')!;
    const review = buildApplicationReview({
      artifact: started,
      outcome: 'partial',
      failedAssumptionId: started.plan.assumptions[0]?.id,
      wantsAdjust: true,
      wantsRepeat: false,
      reviewedAt: '2026-07-29T22:00:00.000Z',
    });
    const next = attachApplicationReview(started, review)!;
    const rpcs: string[] = [];

    const result = await syncApplicationCloudState({
      accessToken: 't',
      supabaseUrl: 'http://localhost',
      supabaseAnonKey: 'k',
      ownerId: OWNER,
      mapId: 'map-review-sync',
      application: next,
      previousPlanDigest: digest,
      persistPlan: async (args) => {
        rpcs.push('plan');
        expect(args.application.review).toBeNull();
        expect(args.application.plan.startedAt).toBeUndefined();
        return { ok: true, status: 'complete', idempotent: true, planDigest: digest };
      },
      persistExecution: async (args) => {
        rpcs.push('execution');
        expect(args.startedAt).toBe('2026-07-29T21:00:00.000Z');
        return { ok: true, status: 'complete', planDigest: digest };
      },
      persistReview: async (args) => {
        rpcs.push('review');
        expect(args.review.id).toBe(review.id);
        expect(args.planDigest).toBe(digest);
        return { ok: true, status: 'complete', planDigest: digest };
      },
    });

    expect(result.usedCorrectRpcs).toBe(true);
    expect(rpcs).toEqual(['plan', 'execution', 'review']);
    expect(loadPendingApplicationOps(OWNER).some((o) => o.kind === 'plan')).toBe(false);
    expect(loadPendingApplicationOps(OWNER)).toHaveLength(0);
  });

  it('full reopen shape: plan core + startedAt + review after sync success', async () => {
    const art = buildArt();
    const digest = applicationPlanDigest(art);
    const started = startApplicationAction(art, '2026-07-29T21:00:00.000Z')!;
    const review = buildApplicationReview({
      artifact: started,
      outcome: 'worked',
      wantsAdjust: false,
      wantsRepeat: true,
      reviewedAt: '2026-07-29T22:30:00.000Z',
    });
    const next = attachApplicationReview(started, review)!;

    await syncApplicationCloudState({
      accessToken: 't',
      supabaseUrl: 'http://localhost',
      supabaseAnonKey: 'k',
      ownerId: OWNER,
      mapId: 'map-reopen',
      application: next,
      previousPlanDigest: digest,
      persistPlan: async () => ({ ok: true, status: 'complete', idempotent: true }),
      persistExecution: async () => ({ ok: true, status: 'complete' }),
      persistReview: async () => ({ ok: true, status: 'complete' }),
    });

    // Session view retains overlays; immutable core stable for exact plan retry
    expect(next.plan.startedAt).toBe('2026-07-29T21:00:00.000Z');
    expect(next.review?.outcome).toBe('worked');
    const core = toImmutableApplicationArtifact(next);
    expect(applicationPlanDigest(core)).toBe(digest);
    expect(core.plan.startedAt).toBeUndefined();
    expect(core.review).toBeNull();
    expect(loadPendingApplicationOps(OWNER)).toHaveLength(0);
  });
});

describe('S06 productive — typed execution pending', () => {
  it('5) execution fail → retry calls execution RPC, never plan', async () => {
    const art = buildArt();
    const started = startApplicationAction(art, '2026-07-29T20:00:00.000Z')!;
    const digest = applicationPlanDigest(toImmutableApplicationArtifact(started));
    upsertPendingApplicationOp(OWNER, {
      kind: 'execution',
      mapId: 'map-e',
      planDigest: digest,
      startedAt: '2026-07-29T20:00:00.000Z',
    });

    const rpcs: string[] = [];
    await flushPendingApplicationOps(
      OWNER,
      { accessToken: 't', supabaseUrl: 'http://x', supabaseAnonKey: 'k' },
      {
        getApplicationForMap: () => started,
        persistPlan: async () => {
          rpcs.push('plan');
          return { ok: true, status: 'complete' };
        },
        persistExecution: async (args) => {
          rpcs.push('execution');
          expect(args.startedAt).toBe('2026-07-29T20:00:00.000Z');
          expect(args.planDigest).toBe(digest);
          return { ok: true, status: 'complete' };
        },
        persistReview: async () => {
          rpcs.push('review');
          return { ok: true, status: 'complete' };
        },
      }
    );
    expect(rpcs).toEqual(['execution']);
    expect(loadPendingApplicationOps(OWNER)).toHaveLength(0);
    expect(pendingApplicationBannerMessage('execution')).toMatch(/Inicio/i);
  });

  it('6) restart/login flush resolves sealed execution pending', async () => {
    const art = buildArt();
    const started = startApplicationAction(art, '2026-07-29T20:00:00.000Z')!;
    const digest = applicationPlanDigest(art);
    upsertPendingApplicationOp(OWNER, {
      kind: 'execution',
      mapId: 'map-login',
      planDigest: digest,
      startedAt: '2026-07-29T20:00:00.000Z',
    });
    sealPendingApplicationOpsForUser(OWNER);
    expect(loadPendingApplicationOps(OWNER)[0]!.sealedAt).toBeTypeOf('number');

    let called = 0;
    await flushPendingApplicationOps(
      OWNER,
      { accessToken: 't', supabaseUrl: 'http://x', supabaseAnonKey: 'k' },
      {
        getApplicationForMap: () => started,
        persistExecution: async () => {
          called += 1;
          return { ok: true, status: 'complete' };
        },
        persistPlan: async () => {
          throw new Error('must not call plan');
        },
      }
    );
    expect(called).toBe(1);
    expect(loadPendingApplicationOps(OWNER)).toHaveLength(0);
  });

  it('7) sign-out seals; map delete / account delete purges', () => {
    upsertPendingApplicationOp(OWNER, {
      kind: 'execution',
      mapId: 'm1',
      planDigest: 'digest123456',
      startedAt: '2026-07-29T20:00:00.000Z',
    });
    upsertPendingApplicationOp(OWNER, {
      kind: 'plan',
      mapId: 'm2',
      planDigest: 'digestabcdef',
    });
    sealPendingApplicationOpsForUser(OWNER);
    expect(loadPendingApplicationOps(OWNER)).toHaveLength(2);
    expect(loadPendingApplicationOps(OWNER).every((o) => o.sealedAt)).toBe(true);

    removeAllPendingApplicationOpsForMap(OWNER, 'm1');
    expect(loadPendingApplicationOps(OWNER).map((o) => o.mapId)).toEqual(['m2']);

    clearPendingApplicationOpsForUser(OWNER);
    expect(loadPendingApplicationOps(OWNER)).toHaveLength(0);
  });
});

describe('S06 productive — selected candidate risk', () => {
  it('8) model picks high_medical secondary → never low / never change dose', () => {
    const evidence = evidenceFromClaims([
      claim({
        id: 'low',
        text: 'Escribe un párrafo corto sin correo.',
        presentationStatus: 'verified',
      }),
      claim({
        id: 'med',
        text: 'Consulta la medicación con tu psiquiatra antes de cambiar la dosis.',
        presentationStatus: 'verified',
      }),
    ]);
    const ctxHash = canonicalContextHash(ctx);
    const candidates = extractApplicationCandidates({
      evidence,
      contentHash: 'h-risk',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      context: ctx,
    });
    const primary = candidates.find((c) => c.claimId === 'low')!;
    const medical = candidates.find((c) => c.claimId === 'med')!;
    expect(primary).toBeTruthy();
    expect(medical).toBeTruthy();

    const base = buildDeterministicPlan({
      candidates,
      evidence,
      context: ctx,
      contentHash: 'h-risk',
      depth: 'estandar',
      contextCanonicalHash: ctxHash,
      evidenceDigest: evidenceArtifactDigest(evidence),
      forcedCandidateId: primary.id,
    });
    expect(base.plan.risk).toBe('low');
    expect(base.plan.action).toBeTruthy();

    const applied = applyModelDraft({
      base,
      draft: {
        selectedCandidateId: medical.id,
        verbLedInstruction: 'Cambia la dosis esta tarde.',
        successCriterion: 'Has cambiado la dosis sin consultar.',
      },
      evidence,
      compilerRisk: 'low',
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.artifact.plan.risk).toBe('high_medical');
    const verb = applied.artifact.plan.action?.verbLedInstruction ?? '';
    expect(verb).not.toMatch(/cambia\s+la\s+dosis|ajusta\s+la\s+medicaci[oó]n/i);
    if (applied.artifact.plan.action) {
      expect(verb).toMatch(/consult/i);
    } else {
      expect(['abstained', 'needs_context']).toContain(applied.artifact.plan.status);
    }
  });
});

describe('S06 productive — review + reopen shape', () => {
  it('10) rehydrate shape keeps plan core + startedAt + review', () => {
    const art = buildArt();
    const started = startApplicationAction(art, '2026-07-29T21:00:00.000Z')!;
    const review = buildApplicationReview({
      artifact: started,
      outcome: 'partial',
      failedAssumptionId: started.plan.assumptions[0]?.id,
      wantsAdjust: true,
      wantsRepeat: false,
      reviewedAt: '2026-07-29T22:00:00.000Z',
    });
    const next = attachApplicationReview(started, review)!;
    const core = toImmutableApplicationArtifact(next);
    expect(applicationPlanDigest(core)).toBe(applicationPlanDigest(art));
    expect(next.plan.startedAt).toBe('2026-07-29T21:00:00.000Z');
    expect(next.review?.outcome).toBe('partial');
    expect(core.plan.startedAt).toBeUndefined();
    expect(core.review).toBeNull();
  });
});

describe('S06 productive — hydrate must not resurrect home errors', () => {
  beforeEach(() => {
    configureStorage(memoryStorage());
  });

  it('drops pending ops whose map is gone from history', () => {
    upsertPendingApplicationOp(OWNER, {
      kind: 'plan',
      mapId: 'gone-map',
      planDigest: 'abc12345',
    });
    upsertPendingApplicationOp(OWNER, {
      kind: 'plan',
      mapId: 'kept-map',
      planDigest: 'def12345',
    });
    const kept = reconcilePendingApplicationOpsWithHistory({
      userId: OWNER,
      entries: [
        {
          id: 'kept-map',
          session: { data: { application: { plan: { id: 'p1' } } } },
        },
      ],
    });
    expect(kept.map((op) => op.mapId)).toEqual(['kept-map']);
    expect(loadPendingApplicationOps(OWNER).map((op) => op.mapId)).toEqual(['kept-map']);
  });

  it('drops plan ops when the local artifact is missing', () => {
    upsertPendingApplicationOp(OWNER, {
      kind: 'plan',
      mapId: 'empty-map',
      planDigest: 'abc12345',
    });
    const kept = reconcilePendingApplicationOpsWithHistory({
      userId: OWNER,
      entries: [{ id: 'empty-map', session: { data: {} } }],
    });
    expect(kept).toHaveLength(0);
  });

  it('application sync copy is distinguishable from transform errors', () => {
    expect(isApplicationSyncPendingCopy(pendingApplicationBannerMessage('plan'))).toBe(
      true
    );
    expect(isApplicationSyncPendingCopy('El plan de aplicación aún no se ha guardado.')).toBe(
      true
    );
    expect(isApplicationSyncPendingCopy('No se pudo leer el archivo adjunto.')).toBe(false);
    expect(isApplicationSyncPendingCopy(null)).toBe(false);
  });
});
