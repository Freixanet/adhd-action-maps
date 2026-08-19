/**
 * S06 RLS A/B — full adversarial matrix via productive RPCs.
 * Requires local Supabase: RUN_S02_RLS=1.
 *
 * Without Docker/local stack the suite is not registered (0 skipped).
 */

import { describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  persistApplicationExecutionWithUserJwt,
  persistApplicationReviewWithUserJwt,
  persistApplicationWithUserJwt,
  replanApplicationWithUserJwt,
} from './application/persistApplication';
import { applicationPlanDigest } from './application/planDigest';
import { toImmutableApplicationArtifact } from './application/immutableCore';
import { startApplicationAction } from './application/startAction';
import { attachApplicationReview, buildApplicationReview } from './application/review';
import { syncApplicationCloudState } from './application/syncApplicationCloud';
import type { ApplicationArtifactV1, ApplicationReviewV1 } from './application/types';
import {
  APPLICATION_COMPILER_VERSION,
  APPLICATION_MODEL_ROUTE,
  APPLICATION_POLICY_VERSION,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
} from './application/versions';

const enabled = process.env.RUN_S02_RLS === '1';
const url = process.env.S02_SUPABASE_URL?.trim();
const anon = process.env.S02_SUPABASE_ANON_KEY?.trim();
const emailA = (process.env.S06_USER_A_EMAIL ?? 's06-a@example.com').trim();
const passA = (process.env.S06_USER_A_PASSWORD ?? 'password-a-s06').trim();
const emailB = (process.env.S06_USER_B_EMAIL ?? 's06-b@example.com').trim();
const passB = (process.env.S06_USER_B_PASSWORD ?? 'password-b-s06').trim();

function adminKey(): string {
  const candidates = [
    process.env.S02_SUPABASE_SERVICE_ROLE_KEY?.trim(),
    process.env.S02_SUPABASE_ADMIN_KEY?.trim(),
  ].filter((k): k is string => Boolean(k));
  // Prefer JWT service_role for PostgREST table access; sb_secret is Auth-oriented.
  const jwt = candidates.find((k) => k.startsWith('eyJ'));
  if (jwt) return jwt;
  if (candidates[0]) return candidates[0];
  throw new Error('missing admin key');
}

function adminClient(): SupabaseClient {
  return createClient(url!, adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function ensureUsers(): Promise<void> {
  const admin = adminClient();
  for (const [email, pass] of [
    [emailA, passA],
    [emailB, passB],
  ] as const) {
    await admin.auth.admin
      .createUser({
        email,
        password: pass,
        email_confirm: true,
      })
      .catch(() => undefined);
  }
}

function minimalArtifact(stamp: string): ApplicationArtifactV1 {
  return {
    schemaVersion: APPLICATION_SCHEMA_VERSION,
    promptVersion: APPLICATION_PROMPT_VERSION,
    compilerVersion: APPLICATION_COMPILER_VERSION,
    policyVersion: APPLICATION_POLICY_VERSION,
    modelVersion: 'test',
    modelRoute: APPLICATION_MODEL_ROUTE,
    status: 'complete',
    contentHash: `hash-s06-${stamp}`,
    depth: 'estandar',
    contextCanonicalHash: `ctx-${stamp}`,
    context: { goal: 'cerrar un borrador' },
    candidates: [],
    plan: {
      id: `ap_${stamp}`,
      status: 'ready',
      selectedCandidateId: null,
      sourceBasis: 'La fuente recomienda un bloque corto de escritura.',
      inference: 'Núcleo traslada la idea a tu tarde.',
      adaptation: 'Prueba 12 minutos sin correo.',
      assumptions: [],
      action: {
        id: `aa_${stamp}`,
        verbLedInstruction: 'Prueba un bloque de 12 minutos sin correo.',
        whenOrTrigger: 'esta tarde',
        durationOrScope: '12 minutos',
        obstacle: 'interrupciones',
        mitigation: 'silencia notificaciones',
        successCriterion: 'Tener un párrafo nuevo guardado.',
        stopOrChangeCriterion: 'Para si aparece una reunión urgente.',
      },
      reviewTrigger: 'Al terminar el bloque',
      reviewQuestions: ['¿Qué escribiste?'],
      risk: 'low',
      sourceChunkIds: [],
    },
    review: null,
    createdAt: new Date().toISOString(),
  };
}

function reviewPayload(id: string, outcome: ApplicationReviewV1['outcome'] = 'worked'): ApplicationReviewV1 {
  return {
    id,
    outcome,
    privateNote: 'nota privada',
    wantsAdjust: false,
    wantsRepeat: false,
    reviewedAt: '2026-07-29T15:00:00.000Z',
  };
}

async function insertMap(
  client: SupabaseClient,
  ownerId: string,
  mapId: string,
  title: string
): Promise<void> {
  const { error } = await client.from('maps').insert({
    id: mapId,
    owner_id: ownerId,
    title,
    source_type: 'text',
    session: {
      data: { title, coreIdea: 'x', coreSupport: 'y', tldr: [], steps: [] },
      currentStep: 0,
    },
  });
  expect(error).toBeNull();
}

async function tokenOf(client: SupabaseClient): Promise<string> {
  return (await client.auth.getSession()).data.session!.access_token;
}

describe('S06 RLS env gate', () => {
  it('records whether local A/B stack is available', () => {
    if (!enabled) {
      expect(enabled).toBe(false);
      return;
    }
    expect(url && anon && emailA && passA && emailB && passB).toBeTruthy();
  });
});

// Adversarial matrix not registered without Docker → 0 skipped.
if (enabled && url && anon) {
  describe('S06 RLS A/B application_plans harden', () => {
    it('A allowed CRUD/RPC; B/anon denied; forged owner; foreign parents; immutable fields', async () => {
      await ensureUsers();
      const clientA = await signIn(emailA, passA);
      const clientB = await signIn(emailB, passB);
      const anonClient = createClient(url!, anon!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const admin = adminClient();
      const userA = (await clientA.auth.getUser()).data.user!;
      const userB = (await clientB.auth.getUser()).data.user!;
      const stamp = `${Date.now()}`;
      const mapA = `map-s06-ab-${stamp}`;
      const mapB = `map-s06-b-${stamp}`;
      const mapA2 = `map-s06-a2-${stamp}`;

      await insertMap(clientA, userA.id, mapA, 'S06 A');
      await insertMap(clientB, userB.id, mapB, 'S06 B');
      await insertMap(clientA, userA.id, mapA2, 'S06 A2');

      const { data: sourceA, error: srcErr } = await clientA
        .from('sources')
        .insert({
          owner_id: userA.id,
          type: 'pasted_text',
          content_hash: `hash-s06-src-${stamp}`,
          status: 'ready',
          title: 'S06 source',
        })
        .select('id')
        .single();
      expect(srcErr).toBeNull();

      const { data: versionA, error: verErr } = await clientA
        .from('source_versions')
        .insert({
          owner_id: userA.id,
          source_id: sourceA!.id,
          version: 1,
          raw_text: 'texto',
        })
        .select('id')
        .single();
      expect(verErr).toBeNull();

      const { data: sourceB } = await clientB
        .from('sources')
        .insert({
          owner_id: userB.id,
          type: 'pasted_text',
          content_hash: `hash-s06-src-b-${stamp}`,
          status: 'ready',
          title: 'B source',
        })
        .select('id')
        .single();
      const { data: versionB } = await clientB
        .from('source_versions')
        .insert({
          owner_id: userB.id,
          source_id: sourceB!.id,
          version: 1,
          raw_text: 'texto b',
        })
        .select('id')
        .single();

      const artifact = minimalArtifact(stamp);
      const tokenA = await tokenOf(clientA);
      const tokenB = await tokenOf(clientB);

      const first = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapA,
        sourceId: sourceA!.id,
        sourceVersionId: versionA!.id,
        application: artifact,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.idempotent).toBeFalsy();
      const digest = first.planDigest!;

      const { data: plansA } = await clientA
        .from('application_plans')
        .select('id,plan_digest,immutable_artifact,artifact,source_id,source_version_id')
        .eq('map_id', mapA);
      expect(plansA ?? []).toHaveLength(1);
      expect(plansA![0]!.plan_digest).toBe(digest);
      expect(plansA![0]!.immutable_artifact).toEqual(artifact);
      expect(plansA![0]!.artifact).toEqual(artifact);

      const { data: stepsA } = await clientA
        .from('application_steps')
        .select('step_key')
        .eq('map_id', mapA);
      expect((stepsA ?? []).map((s) => s.step_key).sort()).toEqual([
        'action',
        'adaptation',
        'inference',
        'source_basis',
      ]);

      // B cannot read A's plans/steps/reviews/ops
      for (const table of [
        'application_plans',
        'application_steps',
        'application_reviews',
        'application_persist_ops',
      ] as const) {
        const { data } = await clientB.from(table).select('id').eq('map_id', mapA);
        expect(data ?? []).toHaveLength(0);
      }

      // anon denied
      for (const table of [
        'application_plans',
        'application_steps',
        'application_reviews',
        'application_persist_ops',
      ] as const) {
        const { data } = await anonClient.from(table).select('id').eq('map_id', mapA);
        expect(data ?? []).toHaveLength(0);
      }

      // Direct mutations revoked for authenticated
      const planRowId = plansA![0]!.id as string;
      const { error: directIns } = await clientA.from('application_plans').insert({
        owner_id: userA.id,
        map_id: mapA2,
        plan_id: 'direct',
        status: 'ready',
        plan_digest: 'deadbeefdeadbeef',
        schema_version: APPLICATION_SCHEMA_VERSION,
        prompt_version: APPLICATION_PROMPT_VERSION,
        compiler_version: APPLICATION_COMPILER_VERSION,
        policy_version: APPLICATION_POLICY_VERSION,
        model_route: APPLICATION_MODEL_ROUTE,
        context_canonical_hash: 'ctx',
        artifact: artifact,
        immutable_artifact: artifact,
      });
      expect(directIns).toBeTruthy();

      const { error: directUpd } = await clientA
        .from('application_plans')
        .update({ status: 'abandoned' })
        .eq('id', planRowId);
      expect(directUpd).toBeTruthy();

      const { error: directDel } = await clientA
        .from('application_plans')
        .delete()
        .eq('id', planRowId);
      expect(directDel).toBeTruthy();

      // B adopt A's map denied
      const adopt = await persistApplicationWithUserJwt({
        accessToken: tokenB,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userB.id,
        mapId: mapA,
        application: artifact,
      });
      expect(adopt.ok).toBe(false);

      // Forged owner via B RPC on A's map
      const forged = await persistApplicationWithUserJwt({
        accessToken: tokenB,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapA,
        application: artifact,
      });
      expect(forged.ok).toBe(false);

      // Foreign source/version (B's) on empty A map — trigger/RPC fail-closed
      const foreignSrc = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapA2,
        sourceId: sourceB!.id,
        sourceVersionId: versionB!.id,
        application: minimalArtifact(`${stamp}-fx`),
      });
      expect(foreignSrc.ok).toBe(false);

      // source_version belongs to owner even when source_id omitted (B version on A map)
      const versionOnly = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapA2,
        sourceVersionId: versionB!.id,
        application: minimalArtifact(`${stamp}-vo`),
      });
      expect(versionOnly.ok).toBe(false);

      // Same-owner second plan row for cross-plan child inserts
      const { data: planA2, error: planA2Err } = await admin
        .from('application_plans')
        .insert({
          owner_id: userA.id,
          map_id: mapA2,
          plan_id: `ap_admin_${stamp}`,
          status: 'ready',
          plan_digest: `digest_admin_${stamp}`.padEnd(16, '0'),
          schema_version: APPLICATION_SCHEMA_VERSION,
          prompt_version: APPLICATION_PROMPT_VERSION,
          compiler_version: APPLICATION_COMPILER_VERSION,
          policy_version: APPLICATION_POLICY_VERSION,
          model_route: APPLICATION_MODEL_ROUTE,
          context_canonical_hash: `ctx-admin-${stamp}`,
          artifact: minimalArtifact(`${stamp}-admin`),
          immutable_artifact: minimalArtifact(`${stamp}-admin`),
        })
        .select('id')
        .single();
      expect(planA2Err).toBeNull();
      expect(planA2?.id).toBeTruthy();

      // Cross-plan step: plan on mapA referenced from mapA2 — trigger fail-closed
      const { error: crossStep } = await admin.from('application_steps').insert({
        owner_id: userA.id,
        map_id: mapA2,
        plan_row_id: planRowId,
        step_key: 'cross',
        title: 'x',
        body: 'y',
        sort_order: 99,
      });
      expect(crossStep).toBeTruthy();

      const { error: crossReview } = await admin.from('application_reviews').insert({
        owner_id: userA.id,
        map_id: mapA2,
        plan_row_id: planRowId,
        review_id: `rev_cross_${stamp}`,
        outcome: 'worked',
      });
      expect(crossReview).toBeTruthy();

      // Immutable fields via admin UPDATE (triggers — authenticated has no UPDATE grant)
      const { error: immOwner } = await admin
        .from('application_plans')
        .update({ owner_id: userB.id })
        .eq('id', planRowId);
      expect(immOwner).toBeTruthy();

      const { error: immMap } = await admin
        .from('application_plans')
        .update({ map_id: mapA2 })
        .eq('id', planRowId);
      expect(immMap).toBeTruthy();

      const { error: immPlan } = await admin
        .from('application_plans')
        .update({ plan_id: 'mutated' })
        .eq('id', planRowId);
      expect(immPlan).toBeTruthy();

      const { error: immSrc } = await admin
        .from('application_plans')
        .update({ source_id: sourceB!.id })
        .eq('id', planRowId);
      expect(immSrc).toBeTruthy();

      const { error: immVer } = await admin
        .from('application_plans')
        .update({ source_version_id: versionB!.id })
        .eq('id', planRowId);
      expect(immVer).toBeTruthy();

      const { error: immArt } = await admin
        .from('application_plans')
        .update({
          immutable_artifact: { ...artifact, contentHash: 'mutated' },
        })
        .eq('id', planRowId);
      expect(immArt).toBeTruthy();

      const { data: stepRow } = await clientA
        .from('application_steps')
        .select('id')
        .eq('map_id', mapA)
        .eq('step_key', 'action')
        .single();
      const { error: immStepKey } = await admin
        .from('application_steps')
        .update({ step_key: 'mutated' })
        .eq('id', stepRow!.id);
      expect(immStepKey).toBeTruthy();

      await clientA.from('maps').delete().eq('id', mapA);
      await clientA.from('maps').delete().eq('id', mapA2);
      await clientB.from('maps').delete().eq('id', mapB);
      await clientA.from('source_versions').delete().eq('id', versionA!.id);
      await clientB.from('source_versions').delete().eq('id', versionB!.id);
      await clientA.from('sources').delete().eq('id', sourceA!.id);
      await clientB.from('sources').delete().eq('id', sourceB!.id);
    }, 90_000);

    it('cardinality: extra/missing/modified steps → conflict; first-persist intruder → conflict', async () => {
      await ensureUsers();
      const clientA = await signIn(emailA, passA);
      const admin = adminClient();
      const userA = (await clientA.auth.getUser()).data.user!;
      const tokenA = await tokenOf(clientA);
      const stamp = `${Date.now()}`;

      const mapId = `map-s06-card-${stamp}`;
      await insertMap(clientA, userA.id, mapId, 'card');
      const artifact = minimalArtifact(`card-${stamp}`);
      const digest = applicationPlanDigest(artifact);

      const first = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
      });
      expect(first.ok).toBe(true);

      const { data: plan } = await clientA
        .from('application_plans')
        .select('id')
        .eq('map_id', mapId)
        .single();

      // Extra row
      const { error: extraIns } = await admin.from('application_steps').insert({
        owner_id: userA.id,
        map_id: mapId,
        plan_row_id: plan!.id,
        step_key: 'intruder',
        title: 'extra',
        body: 'x',
        sort_order: 99,
      });
      expect(extraIns).toBeNull();
      const extra = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
      });
      expect(extra).toEqual(
        expect.objectContaining({ ok: false, code: 'APPLICATION_IDEMPOTENCY_CONFLICT' })
      );
      await admin.from('application_steps').delete().eq('step_key', 'intruder').eq('map_id', mapId);

      // Missing row
      await admin.from('application_steps').delete().eq('map_id', mapId).eq('step_key', 'action');
      const missing = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
      });
      expect(missing).toEqual(
        expect.objectContaining({ ok: false, code: 'APPLICATION_IDEMPOTENCY_CONFLICT' })
      );
      await admin.from('application_steps').insert({
        owner_id: userA.id,
        map_id: mapId,
        plan_row_id: plan!.id,
        step_key: 'action',
        title: 'Próxima acción',
        body: artifact.plan.action!.verbLedInstruction,
        sort_order: 3,
      });

      // Modified body
      await admin
        .from('application_steps')
        .update({ body: 'cuerpo alterado' })
        .eq('map_id', mapId)
        .eq('step_key', 'adaptation');
      const modified = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
      });
      expect(modified).toEqual(
        expect.objectContaining({ ok: false, code: 'APPLICATION_IDEMPOTENCY_CONFLICT' })
      );
      await admin
        .from('application_steps')
        .update({ body: artifact.plan.adaptation })
        .eq('map_id', mapId)
        .eq('step_key', 'adaptation');

      // Exact retry after repair
      const retry = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
      });
      expect(retry.ok).toBe(true);
      if (retry.ok) expect(retry.idempotent).toBe(true);

      // First-persist intruder on fresh map
      const mapFp = `map-s06-fp-${stamp}`;
      await insertMap(clientA, userA.id, mapFp, 'fp');
      const artFp = minimalArtifact(`fp-${stamp}`);
      await admin.from('application_plans').insert({
        owner_id: userA.id,
        map_id: mapFp,
        plan_id: 'intruder_plan',
        status: 'ready',
        plan_digest: 'ffffffffffffffff',
        schema_version: APPLICATION_SCHEMA_VERSION,
        prompt_version: APPLICATION_PROMPT_VERSION,
        compiler_version: APPLICATION_COMPILER_VERSION,
        policy_version: APPLICATION_POLICY_VERSION,
        model_route: APPLICATION_MODEL_ROUTE,
        context_canonical_hash: 'ctx-fp-intruder',
        artifact: { hostile: true },
        immutable_artifact: { hostile: true },
      });
      const fp = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapFp,
        application: artFp,
      });
      expect(fp).toEqual(
        expect.objectContaining({ ok: false, code: 'APPLICATION_IDEMPOTENCY_CONFLICT' })
      );

      await clientA.from('maps').delete().eq('id', mapId);
      await clientA.from('maps').delete().eq('id', mapFp);
      void digest;
    }, 90_000);

    it('review exact/conflict; plan retry after review; execution; concurrency; pending B; cascades', async () => {
      await ensureUsers();
      const clientA = await signIn(emailA, passA);
      const clientB = await signIn(emailB, passB);
      const userA = (await clientA.auth.getUser()).data.user!;
      const userB = (await clientB.auth.getUser()).data.user!;
      const tokenA = await tokenOf(clientA);
      const tokenB = await tokenOf(clientB);
      const stamp = `${Date.now()}`;
      const mapId = `map-s06-rev-${stamp}`;
      await insertMap(clientA, userA.id, mapId, 'rev');

      const artifact = minimalArtifact(`rev-${stamp}`);
      const persisted = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
      });
      expect(persisted.ok).toBe(true);
      if (!persisted.ok) return;
      const digest = persisted.planDigest!;

      const review = reviewPayload(`rev_${stamp}`, 'worked');
      const revArgs = {
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
        planDigest: digest,
        review,
      };

      const rev1 = await persistApplicationReviewWithUserJwt(revArgs);
      expect(rev1.ok).toBe(true);
      if (rev1.ok) expect(rev1.idempotent).toBeFalsy();

      const revExact = await persistApplicationReviewWithUserJwt(revArgs);
      expect(revExact.ok).toBe(true);
      if (revExact.ok) expect(revExact.idempotent).toBe(true);

      const revConflict = await persistApplicationReviewWithUserJwt({
        ...revArgs,
        review: { ...review, outcome: 'partial' },
      });
      expect(revConflict).toEqual(
        expect.objectContaining({
          ok: false,
          code: 'APPLICATION_REVIEW_IDEMPOTENCY_CONFLICT',
        })
      );

      // Immutable separation: plan retry after review still succeeds
      const { data: afterReview } = await clientA
        .from('application_plans')
        .select('immutable_artifact,artifact,status')
        .eq('map_id', mapId)
        .single();
      expect(afterReview?.immutable_artifact).toEqual(artifact);
      expect(afterReview?.artifact).toEqual(artifact);
      expect(afterReview?.status).toBe('completed');

      const planRetry = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
      });
      expect(planRetry.ok).toBe(true);
      if (planRetry.ok) expect(planRetry.idempotent).toBe(true);

      // Execution start (separate map — review already completed status)
      const mapEx = `map-s06-ex-${stamp}`;
      await insertMap(clientA, userA.id, mapEx, 'ex');
      const artEx = minimalArtifact(`ex-${stamp}`);
      const exPersist = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapEx,
        application: artEx,
      });
      expect(exPersist.ok).toBe(true);
      if (!exPersist.ok) return;
      const startedAt = '2026-07-29T16:00:00.000Z';
      const ex1 = await persistApplicationExecutionWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapEx,
        application: artEx,
        planDigest: exPersist.planDigest!,
        startedAt,
      });
      expect(ex1.ok).toBe(true);
      const ex2 = await persistApplicationExecutionWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapEx,
        application: artEx,
        planDigest: exPersist.planDigest!,
        startedAt,
      });
      expect(ex2.ok).toBe(true);
      if (ex2.ok) expect(ex2.idempotent).toBe(true);
      const exConflict = await persistApplicationExecutionWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapEx,
        application: artEx,
        planDigest: exPersist.planDigest!,
        startedAt: '2026-07-29T17:00:00.000Z',
      });
      expect(exConflict).toEqual(
        expect.objectContaining({
          ok: false,
          code: 'APPLICATION_EXECUTION_IDEMPOTENCY_CONFLICT',
        })
      );

      // Plan/plan concurrency — same digest
      const mapConc = `map-s06-conc-${stamp}`;
      await insertMap(clientA, userA.id, mapConc, 'conc');
      const artConc = minimalArtifact(`conc-${stamp}`);
      const concArgs = {
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapConc,
        application: artConc,
      };
      const [c1, c2] = await Promise.all([
        persistApplicationWithUserJwt(concArgs),
        persistApplicationWithUserJwt(concArgs),
      ]);
      expect(c1.ok && c2.ok).toBe(true);
      const writeCount = [c1, c2].filter((r) => r.ok && !r.idempotent).length;
      const idemCount = [c1, c2].filter((r) => r.ok && r.idempotent).length;
      expect(writeCount + idemCount).toBe(2);
      expect(writeCount).toBeLessThanOrEqual(1);

      // Different digests → one complete + conflict
      const mapDiff = `map-s06-diff-${stamp}`;
      await insertMap(clientA, userA.id, mapDiff, 'diff');
      const artD1 = minimalArtifact(`diff-a-${stamp}`);
      const artD2 = {
        ...minimalArtifact(`diff-b-${stamp}`),
        plan: {
          ...minimalArtifact(`diff-b-${stamp}`).plan,
          adaptation: 'Adaptación distinta concurrente.',
        },
      };
      const [d1, d2] = await Promise.all([
        persistApplicationWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url!,
          supabaseAnonKey: anon!,
          ownerId: userA.id,
          mapId: mapDiff,
          application: artD1,
        }),
        persistApplicationWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url!,
          supabaseAnonKey: anon!,
          ownerId: userA.id,
          mapId: mapDiff,
          application: artD2,
        }),
      ]);
      const okDiff = [d1, d2].filter((r) => r.ok);
      const conflictDiff = [d1, d2].filter(
        (r): r is Extract<typeof r, { ok: false }> =>
          r.ok === false && r.code === 'APPLICATION_IDEMPOTENCY_CONFLICT'
      );
      expect(okDiff).toHaveLength(1);
      expect(conflictDiff).toHaveLength(1);

      // Review/review concurrency — exact same payload
      const mapRevC = `map-s06-revc-${stamp}`;
      await insertMap(clientA, userA.id, mapRevC, 'revc');
      const artRevC = minimalArtifact(`revc-${stamp}`);
      const pRevC = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapRevC,
        application: artRevC,
      });
      expect(pRevC.ok).toBe(true);
      if (!pRevC.ok) return;
      const revC = reviewPayload(`revc_${stamp}`, 'worked');
      const [r1, r2] = await Promise.all([
        persistApplicationReviewWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url!,
          supabaseAnonKey: anon!,
          ownerId: userA.id,
          mapId: mapRevC,
          application: artRevC,
          planDigest: pRevC.planDigest!,
          review: revC,
        }),
        persistApplicationReviewWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url!,
          supabaseAnonKey: anon!,
          ownerId: userA.id,
          mapId: mapRevC,
          application: artRevC,
          planDigest: pRevC.planDigest!,
          review: revC,
        }),
      ]);
      expect(r1.ok && r2.ok).toBe(true);
      const { data: reviewsC } = await clientA
        .from('application_reviews')
        .select('id')
        .eq('map_id', mapRevC);
      expect(reviewsC ?? []).toHaveLength(1);

      // Pending A under session B — RPC with B token on A's map denied
      const pendingB = await persistApplicationWithUserJwt({
        accessToken: tokenB,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
        isCurrent: () => false,
      });
      expect(pendingB).toEqual(
        expect.objectContaining({ ok: false, code: 'APPLICATION_AUTH_STALE' })
      );
      const pendingBRpc = await persistApplicationWithUserJwt({
        accessToken: tokenB,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId,
        application: artifact,
      });
      expect(pendingBRpc.ok).toBe(false);

      // Map delete cascades application rows
      const { data: beforeCascade } = await clientA
        .from('application_plans')
        .select('id')
        .eq('map_id', mapId);
      expect((beforeCascade ?? []).length).toBeGreaterThan(0);
      await clientA.from('maps').delete().eq('id', mapId);
      const { data: afterCascade } = await clientA
        .from('application_plans')
        .select('id')
        .eq('map_id', mapId);
      expect(afterCascade ?? []).toHaveLength(0);
      const { data: stepsGone } = await clientA
        .from('application_steps')
        .select('id')
        .eq('map_id', mapId);
      expect(stepsGone ?? []).toHaveLength(0);
      const { data: reviewsGone } = await clientA
        .from('application_reviews')
        .select('id')
        .eq('map_id', mapId);
      expect(reviewsGone ?? []).toHaveLength(0);

      // Account cleanup cascades via owner_id → auth.users ON DELETE CASCADE
      // (deleteAccountFully also purges Storage; Auth delete alone proves DB cascade).
      const admin = adminClient();
      const throwEmail = `s06-throw-${stamp}@example.com`;
      const throwPass = 'password-throw-s06';
      const created = await admin.auth.admin.createUser({
        email: throwEmail,
        password: throwPass,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      const throwUser = created.data.user!;
      const throwClient = await signIn(throwEmail, throwPass);
      const throwMap = `map-s06-throw-${stamp}`;
      await insertMap(throwClient, throwUser.id, throwMap, 'throw');
      const throwArt = minimalArtifact(`throw-${stamp}`);
      const throwPersist = await persistApplicationWithUserJwt({
        accessToken: await tokenOf(throwClient),
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: throwUser.id,
        mapId: throwMap,
        application: throwArt,
      });
      expect(throwPersist.ok).toBe(true);

      const { data: beforeAcct } = await admin
        .from('application_plans')
        .select('id')
        .eq('owner_id', throwUser.id);
      expect((beforeAcct ?? []).length).toBeGreaterThan(0);

      const delUser = await admin.auth.admin.deleteUser(throwUser.id);
      expect(delUser.error).toBeNull();

      const { data: plansAfterAcct } = await admin
        .from('application_plans')
        .select('id')
        .eq('owner_id', throwUser.id);
      expect(plansAfterAcct ?? []).toHaveLength(0);
      const { data: mapsAfterAcct } = await admin
        .from('maps')
        .select('id')
        .eq('id', throwMap);
      expect(mapsAfterAcct ?? []).toHaveLength(0);

      // Cleanup remaining A maps
      for (const id of [mapEx, mapConc, mapDiff, mapRevC]) {
        await clientA.from('maps').delete().eq('id', id);
      }
      void userB;
    }, 120_000);
  });

  describe('S06 RLS replan + failedAssumption + sync coordination', () => {
    it('1–2) P1→P2 replan; concurrent P2/P3 without mix; foreign failedAssumption rejected', async () => {
      await ensureUsers();
      const clientA = await signIn(emailA, passA);
      const userA = (await clientA.auth.getUser()).data.user!;
      const tokenA = await tokenOf(clientA);
      const stamp = `${Date.now()}-replan`;

      // 1) Persist P1 → replan P2 on same map
      const mapReplan = `map-s06-replan-${stamp}`;
      await insertMap(clientA, userA.id, mapReplan, 'replan');
      const p1 = minimalArtifact(`p1-${stamp}`);
      const persistP1 = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapReplan,
        application: p1,
      });
      expect(persistP1.ok).toBe(true);
      if (!persistP1.ok) return;
      const digestP1 = persistP1.planDigest!;

      const p2 = {
        ...minimalArtifact(`p2-${stamp}`),
        contextCanonicalHash: `ctx-p2-${stamp}`,
        plan: {
          ...minimalArtifact(`p2-${stamp}`).plan,
          adaptation: 'Bloque de 15 minutos sin correo ni chat.',
        },
      };
      const digestP2 = applicationPlanDigest(toImmutableApplicationArtifact(p2));
      expect(digestP2).not.toBe(digestP1);

      // Old path (persist_application_plan) must still conflict on digest change
      const oldPath = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapReplan,
        application: p2,
      });
      expect(oldPath).toEqual(
        expect.objectContaining({ ok: false, code: 'APPLICATION_IDEMPOTENCY_CONFLICT' })
      );

      const replanOk = await replanApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapReplan,
        application: p2,
        previousDigest: digestP1,
      });
      expect(replanOk.ok).toBe(true);
      if (replanOk.ok) {
        expect(replanOk.replaced).toBe(true);
        expect(replanOk.planDigest).toBe(digestP2);
      }

      // Exact replan retry idempotent
      const replanRetry = await replanApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapReplan,
        application: p2,
        previousDigest: digestP1,
      });
      expect(replanRetry.ok).toBe(true);
      if (replanRetry.ok) expect(replanRetry.idempotent).toBe(true);

      // Same digest + different payload → conflict
      const p2Conflict = {
        ...p2,
        plan: { ...p2.plan, adaptation: 'Texto distinto con mismo digest forzado.' },
      };
      // Force same digest by calling RPC with digestP2 but different artifact via raw client
      const { error: conflictErr } = await clientA.rpc('replan_application_plan', {
        p_map_id: mapReplan,
        p_source_id: null,
        p_source_version_id: null,
        p_plan_digest: digestP2,
        p_content_hash: p2Conflict.contentHash,
        p_context_canonical_hash: p2Conflict.contextCanonicalHash,
        p_schema_version: p2Conflict.schemaVersion,
        p_prompt_version: p2Conflict.promptVersion,
        p_compiler_version: p2Conflict.compilerVersion,
        p_policy_version: p2Conflict.policyVersion,
        p_model_route: p2Conflict.modelRoute,
        p_artifact: p2Conflict,
        p_previous_digest: digestP2,
        p_confirm_replace: false,
      });
      expect(conflictErr?.message ?? '').toMatch(/IDEMPOTENCY_CONFLICT/i);

      // CAS: replace with previous_digest = null must conflict when active plan exists
      const pNull = {
        ...minimalArtifact(`p-null-${stamp}`),
        contextCanonicalHash: `ctx-null-${stamp}`,
      };
      const nullPrev = await replanApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapReplan,
        application: pNull,
        previousDigest: undefined,
        confirmReplace: true,
      });
      expect(nullPrev).toEqual(
        expect.objectContaining({ ok: false, code: 'APPLICATION_IDEMPOTENCY_CONFLICT' })
      );

      const { data: activePlans } = await clientA
        .from('application_plans')
        .select('plan_digest')
        .eq('map_id', mapReplan);
      expect(activePlans).toHaveLength(1);
      expect(activePlans![0]!.plan_digest).toBe(digestP2);

      // Started plan requires confirmation
      const mapConfirm = `map-s06-confirm-${stamp}`;
      await insertMap(clientA, userA.id, mapConfirm, 'confirm');
      const pc1 = minimalArtifact(`pc1-${stamp}`);
      const persistPc1 = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapConfirm,
        application: pc1,
      });
      expect(persistPc1.ok).toBe(true);
      if (!persistPc1.ok) return;
      const startedAt = '2026-07-29T18:00:00.000Z';
      const execPc = await persistApplicationExecutionWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapConfirm,
        application: pc1,
        planDigest: persistPc1.planDigest!,
        startedAt,
      });
      expect(execPc.ok).toBe(true);
      const pc2 = {
        ...minimalArtifact(`pc2-${stamp}`),
        contextCanonicalHash: `ctx-pc2-${stamp}`,
      };
      const needsConfirm = await replanApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapConfirm,
        application: pc2,
        previousDigest: persistPc1.planDigest!,
        confirmReplace: false,
      });
      expect(needsConfirm).toEqual(
        expect.objectContaining({
          ok: false,
          code: 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION',
          started: true,
        })
      );
      const confirmed = await replanApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapConfirm,
        application: pc2,
        previousDigest: persistPc1.planDigest!,
        confirmReplace: true,
      });
      expect(confirmed.ok).toBe(true);

      // 2) Concurrent P2/P3 after P1 — exactly one winner
      const mapConc = `map-s06-p2p3-${stamp}`;
      await insertMap(clientA, userA.id, mapConc, 'p2p3');
      const base = minimalArtifact(`base-${stamp}`);
      const persistBase = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapConc,
        application: base,
      });
      expect(persistBase.ok).toBe(true);
      if (!persistBase.ok) return;
      const artP2 = {
        ...minimalArtifact(`conc-p2-${stamp}`),
        contextCanonicalHash: `ctx-conc-p2-${stamp}`,
      };
      const artP3 = {
        ...minimalArtifact(`conc-p3-${stamp}`),
        contextCanonicalHash: `ctx-conc-p3-${stamp}`,
      };
      const [rP2, rP3] = await Promise.all([
        replanApplicationWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url!,
          supabaseAnonKey: anon!,
          ownerId: userA.id,
          mapId: mapConc,
          application: artP2,
          previousDigest: persistBase.planDigest!,
        }),
        replanApplicationWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url!,
          supabaseAnonKey: anon!,
          ownerId: userA.id,
          mapId: mapConc,
          application: artP3,
          previousDigest: persistBase.planDigest!,
        }),
      ]);
      const winners = [rP2, rP3].filter((r) => r.ok);
      const losers = [rP2, rP3].filter(
        (r): r is Extract<typeof r, { ok: false }> =>
          r.ok === false && r.code === 'APPLICATION_IDEMPOTENCY_CONFLICT'
      );
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      const { data: concPlans } = await clientA
        .from('application_plans')
        .select('plan_digest')
        .eq('map_id', mapConc);
      expect(concPlans).toHaveLength(1);
      const winnerDigest = winners[0]!.ok ? winners[0]!.planDigest : undefined;
      expect(concPlans![0]!.plan_digest).toBe(winnerDigest);

      // 9) foreign failedAssumptionId rejected
      const mapFail = `map-s06-failassump-${stamp}`;
      await insertMap(clientA, userA.id, mapFail, 'failassump');
      const artFail = {
        ...minimalArtifact(`fail-${stamp}`),
        plan: {
          ...minimalArtifact(`fail-${stamp}`).plan,
          assumptions: [
            {
              id: `aas_real_${stamp}`.slice(0, 40),
              text: 'Supuesto real del plan.',
              editable: true,
              source: 'user' as const,
            },
          ],
        },
      };
      const persistFail = await persistApplicationWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapFail,
        application: artFail,
      });
      expect(persistFail.ok).toBe(true);
      if (!persistFail.ok) return;
      const foreignReview: ApplicationReviewV1 = {
        id: `rev_foreign_${stamp}`.slice(0, 40),
        outcome: 'partial',
        failedAssumptionId: 'aas_not_in_this_plan',
        wantsAdjust: true,
        wantsRepeat: false,
        reviewedAt: '2026-07-29T19:00:00.000Z',
      };
      const foreignResult = await persistApplicationReviewWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapFail,
        application: artFail,
        planDigest: persistFail.planDigest!,
        review: foreignReview,
      });
      expect(foreignResult.ok).toBe(false);
      expect(foreignResult.ok === false && foreignResult.error).toMatch(
        /failedAssumptionId|assumptions/i
      );

      const validReview: ApplicationReviewV1 = {
        id: `rev_ok_${stamp}`.slice(0, 40),
        outcome: 'partial',
        failedAssumptionId: artFail.plan.assumptions[0]!.id,
        wantsAdjust: true,
        wantsRepeat: false,
        reviewedAt: '2026-07-29T19:05:00.000Z',
      };
      const validResult = await persistApplicationReviewWithUserJwt({
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapFail,
        application: artFail,
        planDigest: persistFail.planDigest!,
        review: validReview,
      });
      expect(validResult.ok).toBe(true);

      // 10) full productive flow via syncApplicationCloudState against real RPCs
      const mapFlow = `map-s06-flow-${stamp}`;
      await insertMap(clientA, userA.id, mapFlow, 'flow');
      const artFlow = {
        ...minimalArtifact(`flow-${stamp}`),
        plan: {
          ...minimalArtifact(`flow-${stamp}`).plan,
          assumptions: [
            {
              id: `aas_flow_${stamp}`.slice(0, 40),
              text: 'Objetivo de la tarde.',
              editable: true,
              source: 'user' as const,
            },
          ],
        },
      };
      const authCommon = {
        accessToken: tokenA,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: userA.id,
        mapId: mapFlow,
      };
      const sync1 = await syncApplicationCloudState({
        ...authCommon,
        application: artFlow,
        previousPlanDigest: null,
      });
      expect(sync1.plan?.ok).toBe(true);
      const digestFlow = sync1.plan && sync1.plan.ok ? sync1.plan.planDigest! : '';
      expect(digestFlow.length).toBeGreaterThan(7);

      const startedFlow = startApplicationAction(artFlow, '2026-07-29T20:10:00.000Z')!;
      const sync2 = await syncApplicationCloudState({
        ...authCommon,
        application: startedFlow,
        previousPlanDigest: digestFlow,
      });
      expect(sync2.plan?.ok).toBe(true);
      expect(sync2.execution?.ok).toBe(true);

      const reviewFlow = buildApplicationReview({
        artifact: startedFlow,
        outcome: 'partial',
        failedAssumptionId: startedFlow.plan.assumptions[0]?.id,
        wantsAdjust: true,
        wantsRepeat: false,
        reviewedAt: '2026-07-29T20:40:00.000Z',
      });
      const reviewedFlow = attachApplicationReview(startedFlow, reviewFlow)!;
      const sync3 = await syncApplicationCloudState({
        ...authCommon,
        application: reviewedFlow,
        previousPlanDigest: digestFlow,
      });
      expect(sync3.plan?.ok).toBe(true);
      expect(sync3.execution?.ok).toBe(true);
      expect(sync3.review?.ok).toBe(true);

      const { data: flowPlan } = await clientA
        .from('application_plans')
        .select('plan_digest, started_at, status')
        .eq('map_id', mapFlow)
        .single();
      expect(flowPlan?.plan_digest).toBe(digestFlow);
      expect(flowPlan?.started_at).toBeTruthy();
      const { data: flowReviews } = await clientA
        .from('application_reviews')
        .select('review_id, failed_assumption_id')
        .eq('map_id', mapFlow);
      expect(flowReviews).toHaveLength(1);
      expect(flowReviews![0]!.failed_assumption_id).toBe(
        startedFlow.plan.assumptions[0]?.id
      );

      // Exact plan retry still works after start+review
      const retryPlan = await persistApplicationWithUserJwt({
        ...authCommon,
        application: toImmutableApplicationArtifact(reviewedFlow),
      });
      expect(retryPlan.ok).toBe(true);
      if (retryPlan.ok) expect(retryPlan.idempotent).toBe(true);

      for (const id of [mapReplan, mapConfirm, mapConc, mapFail, mapFlow]) {
        await clientA.from('maps').delete().eq('id', id);
      }
    }, 120_000);
  });
}
