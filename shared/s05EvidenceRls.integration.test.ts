/**
 * S05 RLS A/B — content_nodes + evidence_links isolation via productive persister.
 * Requires local Supabase: RUN_S02_RLS=1 (same stack as S02/S03).
 *
 * Without Docker/local stack the A/B suite is not registered (0 skipped).
 * S05 DONE requires running this file with RUN_S02_RLS=1 and 0 skipped.
 */

import { describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { persistEvidenceWithUserJwt } from './evidence/persistEvidence';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_MODEL_ROUTE,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from './evidence/versions';
import type { EvidenceArtifact } from './evidence/types';

const enabled = process.env.RUN_S02_RLS === '1';
const url = process.env.S02_SUPABASE_URL?.trim();
const anon = process.env.S02_SUPABASE_ANON_KEY?.trim();
/** Exclusive A/B identities for S05 — do not reuse S02/S03 users. */
const emailA = (process.env.S05_USER_A_EMAIL ?? 's05-a@example.com').trim();
const passA = (process.env.S05_USER_A_PASSWORD ?? 'password-a-s05').trim();
const emailB = (process.env.S05_USER_B_EMAIL ?? 's05-b@example.com').trim();
const passB = (process.env.S05_USER_B_PASSWORD ?? 'password-b-s05').trim();

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

function minimalEvidence(claimId: string, chunkId: string): EvidenceArtifact {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    promptVersion: EVIDENCE_PROMPT_VERSION,
    verifierVersion: EVIDENCE_VERIFIER_VERSION,
    compilerVersion: EVIDENCE_COMPILER_VERSION,
    modelVersion: 'test',
    modelRoute: EVIDENCE_MODEL_ROUTE,
    status: 'complete',
    claims: [
      {
        id: claimId,
        text: 'Afirmación respaldada por la fuente.',
        claimType: 'factual',
        criticality: 'critical',
        epistemicStatus: 'faithful_paraphrase',
        presentationStatus: 'verified',
        evidenceLinkIds: [`lnk_${claimId}`],
        abstentionCodes: [],
        slotKey: 'nuclear',
      },
    ],
    links: [
      {
        id: `lnk_${claimId}`,
        contentNodeId: claimId,
        segmentId: chunkId,
        chunkId,
        relation: 'supports',
        verifierStatus: 'verified',
        epistemicStatus: 'faithful_paraphrase',
        confidence: null,
        verifierVersion: EVIDENCE_VERIFIER_VERSION,
        checkCodes: ['ENTAILMENT_SUPPORTS'],
        abstentionCodes: [],
      },
    ],
    assessments: [
      {
        claimId,
        allowedChunkIdsUsed: [chunkId],
        entailment: 'supports',
        contradiction: false,
        qualifierPreservation: null,
        negationPreservation: true,
        numericOk: null,
        nameOk: null,
        dateOk: null,
        unitOk: null,
        relation: 'supports',
        verifierStatus: 'verified',
        epistemicStatus: 'faithful_paraphrase',
        abstentionCodes: [],
        checkCodes: ['ENTAILMENT_SUPPORTS'],
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
        promptVersion: EVIDENCE_PROMPT_VERSION,
        verifierVersion: EVIDENCE_VERIFIER_VERSION,
        modelVersion: 'test',
        modelRoute: EVIDENCE_MODEL_ROUTE,
      },
    ],
    evidenceCoverage: {
      criticalTotal: 1,
      verified: 1,
      qualified: 0,
      contradicted: 0,
      degraded: 0,
      uncertain: 0,
      unanchored: 0,
      inference: 0,
      summaryLines: ['1 idea respaldada'],
    },
    sourceCoverage: {
      textual: null,
      extractionConfidence: null,
      isComplete: true,
      limitations: [],
    },
  };
}

describe('S05 RLS env gate', () => {
  it('records whether local A/B stack is available', () => {
    if (!enabled) {
      expect(enabled).toBe(false);
      return;
    }
    expect(url && anon && emailA && passA && emailB && passB).toBeTruthy();
  });
});

if (enabled) {
  describe('S05 content_nodes + evidence_links A/B (productive persist)', () => {
    it('A persists via persistEvidenceWithUserJwt; B/anon denied; cross parents rejected on INSERT+UPDATE', async () => {
      const a = await signIn(emailA!, passA!);
      const b = await signIn(emailB!, passB!);
      const anonClient = createClient(url!, anon!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: userA } = await a.auth.getUser();
      const { data: userB } = await b.auth.getUser();
      const ownerA = userA.user!.id;
      const ownerB = userB.user!.id;
      const sessionA = (await a.auth.getSession()).data.session!;
      const stamp = Date.now();

      const { data: mapA, error: mapErr } = await a
        .from('maps')
        .insert({
          id: `map-s05-${stamp}`,
          owner_id: ownerA,
          title: 'S05 evidence map',
          source_type: 'text',
          session: {
            data: {
              title: 'S05',
              coreIdea: 'x',
              coreSupport: 'y',
              tldr: [],
              steps: [],
            },
            currentStep: 0,
          },
        })
        .select('id')
        .single();
      expect(mapErr).toBeNull();
      expect(mapA?.id).toBeTruthy();

      const { data: mapB } = await b
        .from('maps')
        .insert({
          id: `map-s05-b-${stamp}`,
          owner_id: ownerB,
          title: 'B map',
          source_type: 'text',
          session: { data: { title: 'B', coreIdea: 'b', coreSupport: 'b', tldr: [], steps: [] }, currentStep: 0 },
        })
        .select('id')
        .single();
      expect(mapB?.id).toBeTruthy();

      const { data: sourceA, error: srcErr } = await a
        .from('sources')
        .insert({
          owner_id: ownerA,
          type: 'pasted_text',
          content_hash: `hash-s05-${stamp}`,
          status: 'ready',
          title: 'S05 source',
        })
        .select('id')
        .single();
      expect(srcErr).toBeNull();

      const { data: versionA, error: verErr } = await a
        .from('source_versions')
        .insert({
          owner_id: ownerA,
          source_id: sourceA!.id,
          version: 1,
          raw_text: 'Afirmación respaldada por la fuente.',
        })
        .select('id')
        .single();
      expect(verErr).toBeNull();

      const chunkId = `chunk_s05_${stamp}`;
      const { data: segA, error: segErr } = await a
        .from('source_segments')
        .insert({
          owner_id: ownerA,
          source_id: sourceA!.id,
          source_version_id: versionA!.id,
          ordinal: 0,
          kind: 'chunk',
          raw_text: 'Afirmación respaldada por la fuente.',
          normalized_text: 'Afirmación respaldada por la fuente.',
          chunk_id: chunkId,
        })
        .select('id')
        .single();
      expect(segErr).toBeNull();
      expect(segA?.id).toBeTruthy();

      const claimId = `cl_s05_${stamp}`;
      const evidence = minimalEvidence(claimId, chunkId);

      const persisted = await persistEvidenceWithUserJwt({
        accessToken: sessionA.access_token,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: ownerA,
        mapId: mapA!.id,
        sourceId: sourceA!.id,
        sourceVersionId: versionA!.id,
        evidence,
        contentHash: `hash-s05-${stamp}`,
      });
      expect(persisted.ok).toBe(true);
      if (persisted.ok) expect(persisted.status).toBe('complete');

      const { data: readA } = await a
        .from('content_nodes')
        .select('claim_id,map_id')
        .eq('map_id', mapA!.id);
      expect(readA?.some((r) => r.claim_id === claimId)).toBe(true);

      const { data: linksA } = await a
        .from('evidence_links')
        .select('chunk_id,segment_id')
        .eq('map_id', mapA!.id);
      expect(linksA?.length).toBeGreaterThan(0);
      expect(linksA?.[0]?.chunk_id).toBe(chunkId);
      expect(linksA?.[0]?.segment_id).toBe(segA!.id);

      const { data: readB, error: readBErr } = await b
        .from('content_nodes')
        .select('id')
        .eq('map_id', mapA!.id);
      expect(readBErr).toBeNull();
      expect(readB ?? []).toEqual([]);

      const { data: linksB } = await b
        .from('evidence_links')
        .select('id')
        .eq('map_id', mapA!.id);
      expect(linksB ?? []).toEqual([]);

      const { data: anonNodes, error: anonErr } = await anonClient
        .from('content_nodes')
        .select('id')
        .eq('map_id', mapA!.id);
      expect(anonNodes ?? []).toEqual([]);
      // Explicit denial preferred when PostgREST surfaces it
      void anonErr;

      const { error: anonWrite } = await anonClient.from('content_nodes').insert({
        owner_id: ownerA,
        map_id: mapA!.id,
        claim_id: 'anon_write',
        claim_text: 'x',
        claim_type: 'factual',
        criticality: 'critical',
        epistemic_status: 'inference',
        presentation_status: 'verified',
        abstention_codes: [],
        schema_version: EVIDENCE_SCHEMA_VERSION,
      });
      expect(anonWrite).toBeTruthy();

      // Cross-map INSERT (A's node on B's map) — trigger/RLS fail-closed
      const { error: crossMapErr } = await a.from('content_nodes').insert({
        owner_id: ownerA,
        map_id: mapB!.id,
        claim_id: 'cross_map',
        claim_text: 'x',
        claim_type: 'factual',
        criticality: 'critical',
        epistemic_status: 'inference',
        presentation_status: 'verified',
        abstention_codes: [],
        schema_version: EVIDENCE_SCHEMA_VERSION,
      });
      expect(crossMapErr).toBeTruthy();

      // Owner forge by B
      const { error: forgeErr } = await b.from('content_nodes').insert({
        owner_id: ownerA,
        map_id: mapA!.id,
        claim_id: 'cl_forged',
        claim_text: 'forge',
        claim_type: 'factual',
        criticality: 'critical',
        epistemic_status: 'inference',
        presentation_status: 'verified',
        abstention_codes: [],
        schema_version: EVIDENCE_SCHEMA_VERSION,
      });
      expect(forgeErr).toBeTruthy();

      // Invented chunk_id / segment (no real source_segments row)
      const { data: nodeRow } = await a
        .from('content_nodes')
        .select('id')
        .eq('map_id', mapA!.id)
        .eq('claim_id', claimId)
        .single();
      const { error: badChunkErr } = await a.from('evidence_links').insert({
        owner_id: ownerA,
        map_id: mapA!.id,
        content_node_id: nodeRow!.id,
        source_id: sourceA!.id,
        source_version_id: versionA!.id,
        segment_id: null,
        chunk_id: 'invented_chunk_xyz',
        relation: 'supports',
        verifier_status: 'verified',
        epistemic_status: 'faithful_paraphrase',
        confidence: null,
        verifier_version: EVIDENCE_VERIFIER_VERSION,
        check_codes: [],
        abstention_codes: [],
        link_key: `bad_${stamp}`,
      });
      expect(badChunkErr).toBeTruthy();

      // UPDATE: immutable owner_id / map_id
      const { error: updOwnerErr } = await a
        .from('content_nodes')
        .update({ owner_id: ownerB })
        .eq('id', nodeRow!.id);
      expect(updOwnerErr).toBeTruthy();

      const { error: updMapErr } = await a
        .from('content_nodes')
        .update({ map_id: mapB!.id })
        .eq('id', nodeRow!.id);
      expect(updMapErr).toBeTruthy();

      // Same-owner second source/version/segment — UPDATE must not retarget identity
      const { data: sourceA2 } = await a
        .from('sources')
        .insert({
          owner_id: ownerA,
          type: 'pasted_text',
          content_hash: `hash-s05-2-${stamp}`,
          status: 'ready',
          title: 'S05 source 2',
        })
        .select('id')
        .single();
      const { data: versionA2 } = await a
        .from('source_versions')
        .insert({
          owner_id: ownerA,
          source_id: sourceA2!.id,
          version: 1,
          raw_text: 'Otro texto.',
        })
        .select('id')
        .single();
      const chunk2 = `chunk_s05_2_${stamp}`;
      const { data: segA2 } = await a
        .from('source_segments')
        .insert({
          owner_id: ownerA,
          source_id: sourceA2!.id,
          source_version_id: versionA2!.id,
          ordinal: 0,
          kind: 'chunk',
          raw_text: 'Otro texto.',
          normalized_text: 'Otro texto.',
          chunk_id: chunk2,
        })
        .select('id')
        .single();

      const { error: retargetNode } = await a
        .from('content_nodes')
        .update({ source_id: sourceA2!.id, source_version_id: versionA2!.id })
        .eq('id', nodeRow!.id);
      expect(retargetNode).toBeTruthy();

      const { data: linkRow } = await a
        .from('evidence_links')
        .select('id,chunk_id,segment_id,source_version_id')
        .eq('map_id', mapA!.id)
        .limit(1)
        .single();

      const { error: retargetLink } = await a
        .from('evidence_links')
        .update({
          source_id: sourceA2!.id,
          source_version_id: versionA2!.id,
          segment_id: segA2!.id,
          chunk_id: chunk2,
        })
        .eq('id', linkRow!.id);
      expect(retargetLink).toBeTruthy();

      // Confirm identity unchanged
      const { data: linkAfter } = await a
        .from('evidence_links')
        .select('chunk_id,segment_id,source_version_id')
        .eq('id', linkRow!.id)
        .single();
      expect(linkAfter?.chunk_id).toBe(chunkId);
      expect(linkAfter?.source_version_id).toBe(versionA!.id);

      // Cross content_node on UPDATE of evidence_links
      const { error: crossNodeUpd } = await a
        .from('evidence_links')
        .update({ content_node_id: nodeRow!.id, chunk_id: 'invented_chunk_xyz' })
        .eq('id', linkRow!.id);
      expect(crossNodeUpd).toBeTruthy();

      await a.from('evidence_links').delete().eq('map_id', mapA!.id);
      await a.from('content_nodes').delete().eq('map_id', mapA!.id);
      await a.from('source_segments').delete().eq('source_version_id', versionA!.id);
      await a.from('source_segments').delete().eq('source_version_id', versionA2!.id);
      await a.from('source_versions').delete().eq('id', versionA!.id);
      await a.from('source_versions').delete().eq('id', versionA2!.id);
      await a.from('sources').delete().eq('id', sourceA!.id);
      await a.from('sources').delete().eq('id', sourceA2!.id);
      await a.from('maps').delete().eq('id', mapA!.id);
      await b.from('maps').delete().eq('id', mapB!.id);
    });

    it('exact retry idempotent; digest conflict; invalid graph atomic rollback (no failed ledger)', async () => {
      const a = await signIn(emailA!, passA!);
      const { data: userA } = await a.auth.getUser();
      const ownerA = userA.user!.id;
      const sessionA = (await a.auth.getSession()).data.session!;
      const stamp = Date.now();
      const mapId = `map-s05-idem-${stamp}`;

      const { data: mapA, error: mapErr } = await a
        .from('maps')
        .insert({
          id: mapId,
          owner_id: ownerA,
          title: 'S05 idem',
          source_type: 'text',
          session: {
            data: { title: 'S05', coreIdea: 'x', coreSupport: 'y', tldr: [], steps: [] },
            currentStep: 0,
          },
        })
        .select('id')
        .single();
      expect(mapErr).toBeNull();

      const { data: sourceA } = await a
        .from('sources')
        .insert({
          owner_id: ownerA,
          type: 'pasted_text',
          content_hash: `hash-idem-${stamp}`,
          status: 'ready',
          title: 'idem',
        })
        .select('id')
        .single();
      const { data: versionA } = await a
        .from('source_versions')
        .insert({
          owner_id: ownerA,
          source_id: sourceA!.id,
          version: 1,
          raw_text: 'Afirmación respaldada por la fuente.',
        })
        .select('id')
        .single();
      const chunkId = `chunk_idem_${stamp}`;
      await a.from('source_segments').insert({
        owner_id: ownerA,
        source_id: sourceA!.id,
        source_version_id: versionA!.id,
        ordinal: 0,
        kind: 'chunk',
        raw_text: 'Afirmación respaldada por la fuente.',
        normalized_text: 'Afirmación respaldada por la fuente.',
        chunk_id: chunkId,
      });

      const claimId = `cl_idem_${stamp}`;
      const evidence = minimalEvidence(claimId, chunkId);
      const args = {
        accessToken: sessionA.access_token,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: ownerA,
        mapId,
        sourceId: sourceA!.id,
        sourceVersionId: versionA!.id,
        evidence,
        contentHash: `hash-idem-${stamp}`,
      };

      const first = await persistEvidenceWithUserJwt(args);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.idempotent).toBe(false);
        expect(first.graphDigest).toMatch(/^[a-f0-9]{64}$/);
      }

      const retry = await persistEvidenceWithUserJwt(args);
      expect(retry.ok).toBe(true);
      if (retry.ok) expect(retry.idempotent).toBe(true);

      // Same map/contentHash/counts, different claim text → conflict (never false success)
      const conflictText = await persistEvidenceWithUserJwt({
        ...args,
        evidence: {
          ...evidence,
          claims: evidence.claims.map((c) => ({
            ...c,
            text: 'Texto distinto con el mismo conteo.',
          })),
        },
      });
      expect(conflictText.ok).toBe(false);
      expect(conflictText).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );

      const conflictStatus = await persistEvidenceWithUserJwt({
        ...args,
        evidence: {
          ...evidence,
          claims: evidence.claims.map((c) => ({
            ...c,
            presentationStatus: 'qualified' as const,
          })),
        },
      });
      expect(conflictStatus).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );

      const conflictRoute = await persistEvidenceWithUserJwt({
        ...args,
        evidence: { ...evidence, modelRoute: 's05.route.hostile' },
      });
      expect(conflictRoute).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );

      const conflictPrompt = await persistEvidenceWithUserJwt({
        ...args,
        evidence: { ...evidence, promptVersion: 'hostile.prompt' },
      });
      expect(conflictPrompt).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );

      // Separate map: invalid chunk → full rollback, no failed ledger row
      const mapBad = `map-s05-bad-${stamp}`;
      await a.from('maps').insert({
        id: mapBad,
        owner_id: ownerA,
        title: 'bad',
        source_type: 'text',
        session: {
          data: { title: 'b', coreIdea: 'x', coreSupport: 'y', tldr: [], steps: [] },
          currentStep: 0,
        },
      });
      const badEv = minimalEvidence(`cl_bad_${stamp}`, 'chunk_does_not_exist');
      const bad = await persistEvidenceWithUserJwt({
        ...args,
        mapId: mapBad,
        evidence: badEv,
      });
      expect(bad).toEqual(expect.objectContaining({ ok: false, code: 'EVIDENCE_CHUNK_UNBOUND' }));

      const { data: badNodes } = await a
        .from('content_nodes')
        .select('id')
        .eq('map_id', mapBad);
      expect(badNodes ?? []).toEqual([]);
      const { data: badLinks } = await a
        .from('evidence_links')
        .select('id')
        .eq('map_id', mapBad);
      expect(badLinks ?? []).toEqual([]);
      const { data: badOps } = await a
        .from('evidence_persist_ops')
        .select('id,status')
        .eq('map_id', mapBad);
      expect(badOps ?? []).toEqual([]);
      // Contract: atomic failure — no durable failed ledger row
      const { data: failedOps } = await a
        .from('evidence_persist_ops')
        .select('id')
        .eq('map_id', mapBad)
        .eq('status', 'failed');
      expect(failedOps ?? []).toEqual([]);

      await a.from('evidence_links').delete().eq('map_id', mapId);
      await a.from('content_nodes').delete().eq('map_id', mapId);
      await a.from('evidence_persist_ops').delete().eq('map_id', mapId);
      await a.from('source_segments').delete().eq('source_version_id', versionA!.id);
      await a.from('source_versions').delete().eq('id', versionA!.id);
      await a.from('sources').delete().eq('id', sourceA!.id);
      await a.from('maps').delete().eq('id', mapId);
      await a.from('maps').delete().eq('id', mapBad);
    });

    it('first-persist cardinality: intruder before first call → conflict; empty/adopt/retry/concurrent preserved', async () => {
      const a = await signIn(emailA!, passA!);
      const { data: userA } = await a.auth.getUser();
      const ownerA = userA.user!.id;
      const sessionA = (await a.auth.getSession()).data.session!;
      const stamp = Date.now();

      async function seed(suffix: string) {
        const mapId = `map-s05-fp-${suffix}-${stamp}`;
        await a.from('maps').insert({
          id: mapId,
          owner_id: ownerA,
          title: 'fp',
          source_type: 'text',
          session: {
            data: { title: 'f', coreIdea: 'x', coreSupport: 'y', tldr: [], steps: [] },
            currentStep: 0,
          },
        });
        const { data: sourceA } = await a
          .from('sources')
          .insert({
            owner_id: ownerA,
            type: 'pasted_text',
            content_hash: `hash-fp-${suffix}-${stamp}`,
            status: 'ready',
            title: 'fp',
          })
          .select('id')
          .single();
        const { data: versionA } = await a
          .from('source_versions')
          .insert({
            owner_id: ownerA,
            source_id: sourceA!.id,
            version: 1,
            raw_text: 'Afirmación respaldada por la fuente.',
          })
          .select('id')
          .single();
        const chunkId = `chunk_fp_${suffix}_${stamp}`;
        await a.from('source_segments').insert({
          owner_id: ownerA,
          source_id: sourceA!.id,
          source_version_id: versionA!.id,
          ordinal: 0,
          kind: 'chunk',
          raw_text: 'Afirmación respaldada por la fuente.',
          normalized_text: 'Afirmación respaldada por la fuente.',
          chunk_id: chunkId,
        });
        return {
          mapId,
          sourceId: sourceA!.id,
          sourceVersionId: versionA!.id,
          chunkId,
          args: {
            accessToken: sessionA.access_token,
            supabaseUrl: url!,
            supabaseAnonKey: anon!,
            ownerId: ownerA,
            mapId,
            sourceId: sourceA!.id,
            sourceVersionId: versionA!.id,
            contentHash: `hash-fp-${suffix}-${stamp}`,
          },
        };
      }

      async function cleanup(ctx: {
        mapId: string;
        sourceId: string;
        sourceVersionId: string;
      }) {
        await a.from('evidence_links').delete().eq('map_id', ctx.mapId);
        await a.from('content_nodes').delete().eq('map_id', ctx.mapId);
        await a.from('evidence_persist_ops').delete().eq('map_id', ctx.mapId);
        await a.from('source_segments').delete().eq('source_version_id', ctx.sourceVersionId);
        await a.from('source_versions').delete().eq('id', ctx.sourceVersionId);
        await a.from('sources').delete().eq('id', ctx.sourceId);
        await a.from('maps').delete().eq('id', ctx.mapId);
      }

      // --- Extra node BEFORE first persist → conflict, no complete op ---
      const intruder = await seed('intruder');
      const evidence = minimalEvidence(`cl_fp_${stamp}`, intruder.chunkId);
      await a.from('content_nodes').insert({
        owner_id: ownerA,
        map_id: intruder.mapId,
        source_id: intruder.sourceId,
        source_version_id: intruder.sourceVersionId,
        claim_id: `cl_intruder_${stamp}`,
        claim_text: 'intruder',
        claim_type: 'factual',
        criticality: 'auxiliary',
        epistemic_status: 'inference',
        presentation_status: 'inference',
        abstention_codes: [],
        schema_version: EVIDENCE_SCHEMA_VERSION,
        content_hash: `hash-fp-intruder-${stamp}`,
      });
      const withIntruder = await persistEvidenceWithUserJwt({
        ...intruder.args,
        evidence,
      });
      expect(withIntruder).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );
      const { data: opsIntruder } = await a
        .from('evidence_persist_ops')
        .select('id,status')
        .eq('map_id', intruder.mapId)
        .eq('status', 'complete');
      expect(opsIntruder ?? []).toEqual([]);
      await cleanup(intruder);

      // --- Extra link BEFORE first persist → conflict ---
      const linkExtra = await seed('linkx');
      const evLink = minimalEvidence(`cl_linkx_${stamp}`, linkExtra.chunkId);
      // Need a content node to attach a rogue link (FK)
      const { data: hostNode } = await a
        .from('content_nodes')
        .insert({
          owner_id: ownerA,
          map_id: linkExtra.mapId,
          source_id: linkExtra.sourceId,
          source_version_id: linkExtra.sourceVersionId,
          claim_id: evLink.claims[0]!.id,
          claim_text: evLink.claims[0]!.text,
          claim_type: 'factual',
          criticality: 'critical',
          epistemic_status: 'faithful_paraphrase',
          presentation_status: 'verified',
          abstention_codes: [],
          schema_version: EVIDENCE_SCHEMA_VERSION,
          content_hash: `hash-fp-linkx-${stamp}`,
        })
        .select('id')
        .single();
      const { data: seg } = await a
        .from('source_segments')
        .select('id')
        .eq('source_version_id', linkExtra.sourceVersionId)
        .eq('chunk_id', linkExtra.chunkId)
        .single();
      await a.from('evidence_links').insert({
        owner_id: ownerA,
        map_id: linkExtra.mapId,
        content_node_id: hostNode!.id,
        source_id: linkExtra.sourceId,
        source_version_id: linkExtra.sourceVersionId,
        segment_id: seg!.id,
        chunk_id: linkExtra.chunkId,
        relation: 'supports',
        verifier_status: 'verified',
        epistemic_status: 'faithful_paraphrase',
        confidence: null,
        verifier_version: EVIDENCE_VERIFIER_VERSION,
        check_codes: [],
        abstention_codes: [],
        link_key: `lnk_rogue_${stamp}`,
      });
      // Payload has one link with different key → counts differ / extra DB link → conflict
      const withRogueLink = await persistEvidenceWithUserJwt({
        ...linkExtra.args,
        evidence: evLink,
      });
      expect(withRogueLink).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );
      const { data: opsLink } = await a
        .from('evidence_persist_ops')
        .select('id')
        .eq('map_id', linkExtra.mapId)
        .eq('status', 'complete');
      expect(opsLink ?? []).toEqual([]);
      await cleanup(linkExtra);

      // --- Exact preexisting graph, no op → controlled adopt (idempotent), no duplication ---
      const adopt = await seed('adopt');
      const evAdopt = minimalEvidence(`cl_adopt_${stamp}`, adopt.chunkId);
      const firstWrite = await persistEvidenceWithUserJwt({
        ...adopt.args,
        evidence: evAdopt,
      });
      expect(firstWrite.ok).toBe(true);
      // Remove op only — leave nodes/links exact
      await a.from('evidence_persist_ops').delete().eq('map_id', adopt.mapId);
      const { data: nodesBefore } = await a
        .from('content_nodes')
        .select('id')
        .eq('map_id', adopt.mapId);
      const adoptRetry = await persistEvidenceWithUserJwt({
        ...adopt.args,
        evidence: evAdopt,
      });
      expect(adoptRetry.ok).toBe(true);
      if (adoptRetry.ok) expect(adoptRetry.idempotent).toBe(true);
      const { data: nodesAfter } = await a
        .from('content_nodes')
        .select('id')
        .eq('map_id', adopt.mapId);
      expect(nodesAfter?.length).toBe(nodesBefore?.length);
      await cleanup(adopt);

      // --- Partially equal preexisting → conflict ---
      const partial = await seed('partial');
      const evPartial = minimalEvidence(`cl_partial_${stamp}`, partial.chunkId);
      await a.from('content_nodes').insert({
        owner_id: ownerA,
        map_id: partial.mapId,
        source_id: partial.sourceId,
        source_version_id: partial.sourceVersionId,
        claim_id: evPartial.claims[0]!.id,
        claim_text: 'Texto distinto al payload',
        claim_type: 'factual',
        criticality: 'critical',
        epistemic_status: 'faithful_paraphrase',
        presentation_status: 'verified',
        abstention_codes: [],
        schema_version: EVIDENCE_SCHEMA_VERSION,
        content_hash: `hash-fp-partial-${stamp}`,
      });
      const partialRes = await persistEvidenceWithUserJwt({
        ...partial.args,
        evidence: evPartial,
      });
      expect(partialRes).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );
      await cleanup(partial);

      // --- Empty DB → normal first write; exact retry idempotent ---
      const empty = await seed('empty');
      const evEmpty = minimalEvidence(`cl_empty_${stamp}`, empty.chunkId);
      const emptyFirst = await persistEvidenceWithUserJwt({
        ...empty.args,
        evidence: evEmpty,
      });
      expect(emptyFirst.ok).toBe(true);
      if (emptyFirst.ok) expect(emptyFirst.idempotent).toBe(false);
      const emptyRetry = await persistEvidenceWithUserJwt({
        ...empty.args,
        evidence: evEmpty,
      });
      expect(emptyRetry.ok).toBe(true);
      if (emptyRetry.ok) expect(emptyRetry.idempotent).toBe(true);

      // Duplicate claim_id still rejected
      const dup = await persistEvidenceWithUserJwt({
        ...empty.args,
        evidence: {
          ...evEmpty,
          claims: [evEmpty.claims[0]!, { ...evEmpty.claims[0]!, slotKey: 'other' }],
        },
      });
      expect(dup).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );
      await cleanup(empty);
    });

    it('cardinality: duplicate claim_id/link rejected; delete/extra row → conflict; exact retry idempotent', async () => {
      const a = await signIn(emailA!, passA!);
      const { data: userA } = await a.auth.getUser();
      const ownerA = userA.user!.id;
      const sessionA = (await a.auth.getSession()).data.session!;
      const stamp = Date.now();
      const mapId = `map-s05-card-${stamp}`;

      await a.from('maps').insert({
        id: mapId,
        owner_id: ownerA,
        title: 'card',
        source_type: 'text',
        session: {
          data: { title: 'c', coreIdea: 'x', coreSupport: 'y', tldr: [], steps: [] },
          currentStep: 0,
        },
      });
      const { data: sourceA } = await a
        .from('sources')
        .insert({
          owner_id: ownerA,
          type: 'pasted_text',
          content_hash: `hash-card-${stamp}`,
          status: 'ready',
          title: 'card',
        })
        .select('id')
        .single();
      const { data: versionA } = await a
        .from('source_versions')
        .insert({
          owner_id: ownerA,
          source_id: sourceA!.id,
          version: 1,
          raw_text: 'Afirmación respaldada por la fuente.',
        })
        .select('id')
        .single();
      const chunkId = `chunk_card_${stamp}`;
      await a.from('source_segments').insert({
        owner_id: ownerA,
        source_id: sourceA!.id,
        source_version_id: versionA!.id,
        ordinal: 0,
        kind: 'chunk',
        raw_text: 'Afirmación respaldada por la fuente.',
        normalized_text: 'Afirmación respaldada por la fuente.',
        chunk_id: chunkId,
      });

      const claimId = `cl_card_${stamp}`;
      const evidence = minimalEvidence(claimId, chunkId);
      const baseArgs = {
        accessToken: sessionA.access_token,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: ownerA,
        mapId,
        sourceId: sourceA!.id,
        sourceVersionId: versionA!.id,
        contentHash: `hash-card-${stamp}`,
      };

      // Duplicate claim_id in payload → reject
      const dupClaim = await persistEvidenceWithUserJwt({
        ...baseArgs,
        evidence: {
          ...evidence,
          claims: [evidence.claims[0]!, { ...evidence.claims[0]!, slotKey: 'other' }],
        },
      });
      expect(dupClaim).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );

      // Duplicate link_key → reject
      const dupLink = await persistEvidenceWithUserJwt({
        ...baseArgs,
        evidence: {
          ...evidence,
          links: [evidence.links[0]!, { ...evidence.links[0]! }],
        },
      });
      expect(dupLink).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );

      const first = await persistEvidenceWithUserJwt({ ...baseArgs, evidence });
      expect(first.ok).toBe(true);

      const retry = await persistEvidenceWithUserJwt({ ...baseArgs, evidence });
      expect(retry.ok).toBe(true);
      if (retry.ok) expect(retry.idempotent).toBe(true);

      // Delete a persisted node then retry → conflict (cardinality)
      await a.from('evidence_links').delete().eq('map_id', mapId);
      await a.from('content_nodes').delete().eq('map_id', mapId);
      // Re-insert only via partial: leave ops complete but empty nodes
      const afterDelete = await persistEvidenceWithUserJwt({ ...baseArgs, evidence });
      expect(afterDelete).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );

      // Fresh map: persist then insert extra node → retry conflict
      const mapExtra = `map-s05-extra-${stamp}`;
      await a.from('maps').insert({
        id: mapExtra,
        owner_id: ownerA,
        title: 'extra',
        source_type: 'text',
        session: {
          data: { title: 'e', coreIdea: 'x', coreSupport: 'y', tldr: [], steps: [] },
          currentStep: 0,
        },
      });
      const ev2 = minimalEvidence(`cl_extra_${stamp}`, chunkId);
      const ok2 = await persistEvidenceWithUserJwt({
        ...baseArgs,
        mapId: mapExtra,
        evidence: ev2,
      });
      expect(ok2.ok).toBe(true);
      await a.from('content_nodes').insert({
        owner_id: ownerA,
        map_id: mapExtra,
        source_id: sourceA!.id,
        source_version_id: versionA!.id,
        claim_id: `cl_intruder_post_${stamp}`,
        claim_text: 'intruder',
        claim_type: 'factual',
        criticality: 'auxiliary',
        epistemic_status: 'inference',
        presentation_status: 'inference',
        abstention_codes: [],
        schema_version: EVIDENCE_SCHEMA_VERSION,
        content_hash: `hash-card-${stamp}`,
      });
      const withExtra = await persistEvidenceWithUserJwt({
        ...baseArgs,
        mapId: mapExtra,
        evidence: ev2,
      });
      expect(withExtra).toEqual(
        expect.objectContaining({ ok: false, code: 'EVIDENCE_IDEMPOTENCY_CONFLICT' })
      );

      await a.from('evidence_links').delete().eq('map_id', mapId);
      await a.from('content_nodes').delete().eq('map_id', mapId);
      await a.from('evidence_persist_ops').delete().eq('map_id', mapId);
      await a.from('evidence_links').delete().eq('map_id', mapExtra);
      await a.from('content_nodes').delete().eq('map_id', mapExtra);
      await a.from('evidence_persist_ops').delete().eq('map_id', mapExtra);
      await a.from('source_segments').delete().eq('source_version_id', versionA!.id);
      await a.from('source_versions').delete().eq('id', versionA!.id);
      await a.from('sources').delete().eq('id', sourceA!.id);
      await a.from('maps').delete().eq('id', mapId);
      await a.from('maps').delete().eq('id', mapExtra);
    });

    it('concurrent RPC: same graph → one write + idempotent; different graphs → one complete + conflict', async () => {
      const a = await signIn(emailA!, passA!);
      const { data: userA } = await a.auth.getUser();
      const ownerA = userA.user!.id;
      const sessionA = (await a.auth.getSession()).data.session!;
      const stamp = Date.now();

      async function seedMap(suffix: string) {
        const mapId = `map-s05-conc-${suffix}-${stamp}`;
        await a.from('maps').insert({
          id: mapId,
          owner_id: ownerA,
          title: 'conc',
          source_type: 'text',
          session: {
            data: { title: 'c', coreIdea: 'x', coreSupport: 'y', tldr: [], steps: [] },
            currentStep: 0,
          },
        });
        const { data: sourceA } = await a
          .from('sources')
          .insert({
            owner_id: ownerA,
            type: 'pasted_text',
            content_hash: `hash-conc-${suffix}-${stamp}`,
            status: 'ready',
            title: 'conc',
          })
          .select('id')
          .single();
        const { data: versionA } = await a
          .from('source_versions')
          .insert({
            owner_id: ownerA,
            source_id: sourceA!.id,
            version: 1,
            raw_text: 'Afirmación respaldada por la fuente.',
          })
          .select('id')
          .single();
        const chunkId = `chunk_conc_${suffix}_${stamp}`;
        await a.from('source_segments').insert({
          owner_id: ownerA,
          source_id: sourceA!.id,
          source_version_id: versionA!.id,
          ordinal: 0,
          kind: 'chunk',
          raw_text: 'Afirmación respaldada por la fuente.',
          normalized_text: 'Afirmación respaldada por la fuente.',
          chunk_id: chunkId,
        });
        return { mapId, sourceId: sourceA!.id, sourceVersionId: versionA!.id, chunkId };
      }

      const same = await seedMap('same');
      const evidence = minimalEvidence(`cl_conc_same_${stamp}`, same.chunkId);
      const args = {
        accessToken: sessionA.access_token,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: ownerA,
        mapId: same.mapId,
        sourceId: same.sourceId,
        sourceVersionId: same.sourceVersionId,
        evidence,
        contentHash: `hash-conc-same-${stamp}`,
      };
      const [r1, r2] = await Promise.all([
        persistEvidenceWithUserJwt(args),
        persistEvidenceWithUserJwt(args),
      ]);
      expect(r1.ok && r2.ok).toBe(true);
      const idemCount = [r1, r2].filter((r) => r.ok && r.idempotent).length;
      const writeCount = [r1, r2].filter((r) => r.ok && !r.idempotent).length;
      expect(writeCount + idemCount).toBe(2);
      expect(writeCount).toBeLessThanOrEqual(1);
      // At least one path completed; if both raced to write, lock serializes so one is idempotent.
      expect(idemCount >= 1 || writeCount === 1).toBe(true);

      const { data: opsSame } = await a
        .from('evidence_persist_ops')
        .select('graph_digest,status')
        .eq('map_id', same.mapId)
        .eq('status', 'complete');
      const digests = new Set((opsSame ?? []).map((o) => o.graph_digest));
      expect(digests.size).toBe(1);

      const diff = await seedMap('diff');
      const evA = minimalEvidence(`cl_conc_a_${stamp}`, diff.chunkId);
      const evB = {
        ...minimalEvidence(`cl_conc_b_${stamp}`, diff.chunkId),
        claims: [
          {
            ...minimalEvidence(`cl_conc_b_${stamp}`, diff.chunkId).claims[0]!,
            text: 'Texto distinto concurrente.',
          },
        ],
      };
      const baseDiff = {
        accessToken: sessionA.access_token,
        supabaseUrl: url!,
        supabaseAnonKey: anon!,
        ownerId: ownerA,
        mapId: diff.mapId,
        sourceId: diff.sourceId,
        sourceVersionId: diff.sourceVersionId,
        contentHash: `hash-conc-diff-${stamp}`,
      };
      const [d1, d2] = await Promise.all([
        persistEvidenceWithUserJwt({ ...baseDiff, evidence: evA }),
        persistEvidenceWithUserJwt({ ...baseDiff, evidence: evB }),
      ]);
      const okDiff = [d1, d2].filter((r) => r.ok);
      const conflictDiff = [d1, d2].filter(
        (r): r is Extract<typeof r, { ok: false }> =>
          r.ok === false && r.code === 'EVIDENCE_IDEMPOTENCY_CONFLICT'
      );
      expect(okDiff).toHaveLength(1);
      expect(conflictDiff).toHaveLength(1);

      const { data: opsDiff } = await a
        .from('evidence_persist_ops')
        .select('graph_digest,status')
        .eq('map_id', diff.mapId)
        .eq('status', 'complete');
      expect(opsDiff ?? []).toHaveLength(1);

      const { data: nodesDiff } = await a
        .from('content_nodes')
        .select('claim_id')
        .eq('map_id', diff.mapId);
      expect(nodesDiff ?? []).toHaveLength(1);

      for (const m of [same, diff]) {
        await a.from('evidence_links').delete().eq('map_id', m.mapId);
        await a.from('content_nodes').delete().eq('map_id', m.mapId);
        await a.from('evidence_persist_ops').delete().eq('map_id', m.mapId);
        await a.from('source_segments').delete().eq('source_version_id', m.sourceVersionId);
        await a.from('source_versions').delete().eq('id', m.sourceVersionId);
        await a.from('sources').delete().eq('id', m.sourceId);
        await a.from('maps').delete().eq('id', m.mapId);
      }
    });
  });
}
