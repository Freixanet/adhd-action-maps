/**
 * S06 reopen — mobile/state flow proofs (no skipped tests).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { configureStorage, type SyncKeyValueStorage } from './storage';
import {
  APPLICATION_SYNC_PENDING_MESSAGE,
  clearPendingApplicationSyncForUser,
  flushPendingApplicationSync,
  loadPendingApplicationSync,
  upsertPendingApplicationSync,
} from './pendingApplicationSync';
import {
  APPLICATION_REVIEW_SYNC_PENDING_MESSAGE,
  clearPendingApplicationReviewSyncForUser,
  flushPendingApplicationReviewSync,
  loadPendingApplicationReviewSync,
  upsertPendingApplicationReviewSync,
} from './pendingApplicationReviewSync';
import {
  applicationPlanDigest,
  attachApplicationReview,
  buildApplicationReview,
  buildDeterministicPlan,
  extractApplicationCandidates,
  replanApplicationFromEvidence,
  startApplicationAction,
  canonicalContextHash,
  evidenceArtifactDigest,
} from './application';
import type { ApplicationArtifactV1, ApplicationContextV1 } from './application/types';
import type { ActionMapData } from './contracts';
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
      verified: claims.length,
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

const baseMap: ActionMapData = {
  title: 'Mapa',
  coreIdea: 'idea',
  coreSupport: 's',
  tldr: [],
  steps: [],
};

const ctx: ApplicationContextV1 = {
  goal: 'terminar un párrafo',
  situation: 'escritorio',
  constraint: 'sin correo',
  horizon: 'esta tarde',
};

function buildArt(): ApplicationArtifactV1 {
  const evidence = evidenceFromClaims([
    claim({
      id: 'flow1',
      text: 'Escribe un párrafo sin abrir el correo.',
      presentationStatus: 'verified',
    }),
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

describe('S06 reopen I — flow contracts', () => {
  it('1) four context fields round-trip into replan identity', async () => {
    const evidence = evidenceFromClaims([
      claim({
        id: 'c4',
        text: 'Escribe el primer párrafo.',
        presentationStatus: 'verified',
      }),
    ]);
    const first = buildArt();
    const nextCtx: ApplicationContextV1 = {
      goal: 'cerrar sección 2',
      situation: 'biblioteca',
      constraint: '45 minutos',
      horizon: 'mañana 10:00',
    };
    const replanned = await replanApplicationFromEvidence({
      previous: first,
      baseMap,
      evidence,
      context: nextCtx,
    });
    expect(replanned.ok).toBe(true);
    if (!replanned.ok) return;
    expect(replanned.artifact.context.goal).toBe(nextCtx.goal);
    expect(replanned.artifact.context.situation).toBe(nextCtx.situation);
    expect(replanned.artifact.context.constraint).toBe(nextCtx.constraint);
    expect(replanned.artifact.context.horizon).toBe(nextCtx.horizon);
    expect(replanned.artifact.contextCanonicalHash).not.toBe(first.contextCanonicalHash);
  });

  it('4) Empezar acción → in_progress + startedAt', () => {
    const art = buildArt();
    const started = startApplicationAction(art, '2026-07-29T15:00:00.000Z');
    expect(started?.plan.status).toBe('in_progress');
    expect(started?.plan.startedAt).toBe('2026-07-29T15:00:00.000Z');
  });

  it('5) review attaches and survives rehydrate shape', () => {
    const art = buildArt();
    const review = buildApplicationReview({
      artifact: art,
      outcome: 'partial',
      wantsAdjust: true,
      wantsRepeat: false,
      reviewedAt: '2026-07-29T16:00:00.000Z',
    });
    const next = attachApplicationReview(art, review);
    expect(next?.review?.outcome).toBe('partial');
    expect(applicationPlanDigest(next!)).toBe(applicationPlanDigest(art));
  });

  it('7–8) cloud fail leaves pending; retry without Gemini clears it', async () => {
    const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const art = buildArt();
    upsertPendingApplicationSync(userA, { mapId: 'map-a' });
    expect(loadPendingApplicationSync(userA)).toHaveLength(1);
    expect(loadPendingApplicationSync(userB)).toHaveLength(0);

    let calls = 0;
    const failOnce = async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false as const,
          status: 503,
          error: 'down',
          code: 'APPLICATION_PERSIST_FAILED',
        };
      }
      return { ok: true as const, status: 'complete' as const };
    };

    const first = await flushPendingApplicationSync(
      userA,
      { accessToken: 't', supabaseUrl: 'http://localhost', supabaseAnonKey: 'k' },
      { getApplicationForMap: () => art, persist: failOnce }
    );
    expect(first.failed).toContain('map-a');
    expect(loadPendingApplicationSync(userA)).toHaveLength(1);
    expect(APPLICATION_SYNC_PENDING_MESSAGE.length).toBeGreaterThan(10);

    const second = await flushPendingApplicationSync(
      userA,
      { accessToken: 't', supabaseUrl: 'http://localhost', supabaseAnonKey: 'k' },
      { getApplicationForMap: () => art, persist: failOnce }
    );
    expect(second.flushed).toContain('map-a');
    expect(loadPendingApplicationSync(userA)).toHaveLength(0);

    // A→B: B must not flush A's pending
    upsertPendingApplicationSync(userA, { mapId: 'map-a2' });
    const asB = await flushPendingApplicationSync(
      userB,
      { accessToken: 't', supabaseUrl: 'http://localhost', supabaseAnonKey: 'k' },
      {
        getApplicationForMap: () => art,
        persist: async () => ({ ok: true, status: 'complete' }),
      }
    );
    expect(asB.flushed).toHaveLength(0);
    expect(loadPendingApplicationSync(userA)).toHaveLength(1);
  });

  it('review pending is separate from plan pending', async () => {
    const user = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const art = buildArt();
    const review = buildApplicationReview({
      artifact: art,
      outcome: 'worked',
      wantsAdjust: false,
      wantsRepeat: true,
      reviewedAt: '2026-07-29T17:00:00.000Z',
    });
    const withReview = attachApplicationReview(art, review)!;
    upsertPendingApplicationReviewSync(user, {
      mapId: 'map-r',
      planDigest: applicationPlanDigest(withReview),
      review: withReview.review!,
    });
    expect(loadPendingApplicationReviewSync(user)).toHaveLength(1);
    expect(APPLICATION_REVIEW_SYNC_PENDING_MESSAGE.length).toBeGreaterThan(5);

    const flushed = await flushPendingApplicationReviewSync(
      user,
      { accessToken: 't', supabaseUrl: 'http://localhost', supabaseAnonKey: 'k' },
      {
        getApplicationForMap: () => withReview,
        persist: async () => ({ ok: true, status: 'complete' }),
      }
    );
    expect(flushed.flushed).toContain('map-r');
    expect(loadPendingApplicationReviewSync(user)).toHaveLength(0);
  });

  it('sign-out / delete clears pending for owner', () => {
    const user = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    upsertPendingApplicationSync(user, { mapId: 'm1' });
    upsertPendingApplicationReviewSync(user, {
      mapId: 'm1',
      planDigest: 'digest',
      review: {
        id: 'ar_x',
        outcome: 'worked',
        wantsAdjust: false,
        wantsRepeat: false,
        reviewedAt: '2026-07-29T18:00:00.000Z',
      },
    });
    clearPendingApplicationSyncForUser(user);
    clearPendingApplicationReviewSyncForUser(user);
    expect(loadPendingApplicationSync(user)).toHaveLength(0);
    expect(loadPendingApplicationReviewSync(user)).toHaveLength(0);
  });
});
