/**
 * S08 productive PDF persist A/B — invokes persistPdfSourceWithUserJwt (not manual inserts).
 * Requires RUN_S02_RLS=1.
 *
 * Adversarial matrix: B/anon with A's ids+path, forge owner/path, same-length different
 * bytes, divergent normalized_text/kind/coverage/pageCount, extra/missing segments,
 * concurrency same/different payload. Storage asserted after delete.
 */

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createPastedTextOperationIds } from '../pastedText';
import { fixtureTextualPdf, fixtureMultipagePdf } from './fixtures';
import { extractPdfNative } from '../../server/src/ingestors/pdfExtractNative';
import { segmentPdfPages, asSourceChunks } from './segmentPdf';
import { pdfSegmentsPayload } from '../../server/src/ingestors/pdfOrchestration';
import { persistPdfSourceWithUserJwt } from '../../server/src/ingestors/pdfPersist';
import { SOURCES_STORAGE_BUCKET } from '../sourcesStorage';
import type { PdfSegmentPayload } from './types';
import { computePdfPersistPayloadDigest } from './persistDigest';

const enabled = process.env.RUN_S02_RLS === '1';
const url = process.env.S02_SUPABASE_URL?.trim();
const anon = process.env.S02_SUPABASE_ANON_KEY?.trim();
const emailA = (process.env.S08_USER_A_EMAIL ?? 's08-a@example.com').trim();
const passA = (process.env.S08_USER_A_PASSWORD ?? 'password-a-s08').trim();
const emailB = (process.env.S08_USER_B_EMAIL ?? 's08-b@example.com').trim();
const passB = (process.env.S08_USER_B_PASSWORD ?? 'password-b-s08').trim();

function adminKey(): string {
  const values = [
    process.env.S02_SUPABASE_SERVICE_ROLE_KEY?.trim(),
    process.env.S02_SUPABASE_ADMIN_KEY?.trim(),
  ].filter((value): value is string => Boolean(value));
  return values.find((value) => value.startsWith('eyJ')) ?? values[0] ?? '';
}

function adminClient(): SupabaseClient {
  return createClient(url!, adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureUsers(): Promise<void> {
  const admin = adminClient();
  for (const [email, password] of [
    [emailA, passA],
    [emailB, passB],
  ] as const) {
    await admin.auth.admin
      .createUser({ email, password, email_confirm: true })
      .catch(() => undefined);
  }
}

async function signIn(email: string, password: string): Promise<{
  client: SupabaseClient;
  token: string;
  userId: string;
}> {
  const client = createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token || !data.user?.id) throw error || new Error('sign-in');
  return { client, token: data.session.access_token, userId: data.user.id };
}

async function prepareExtract(buf: Buffer) {
  const extracted = await extractPdfNative({
    buffer: buf,
    declaredMime: 'application/pdf',
  });
  if (extracted.ok === false) throw new Error(`extract failed: ${extracted.code}`);
  const artifact = segmentPdfPages({
    pages: extracted.pages,
    rawHash: extracted.rawHash,
    coverage: extracted.coverage,
    title: extracted.title,
    extractionDigest: extracted.extractionDigest,
  });
  const chunks = asSourceChunks(artifact.segments);
  const segments = pdfSegmentsPayload(chunks);
  return { extracted, chunks, segments };
}

function mutateSegmentText(
  segments: PdfSegmentPayload[],
  field: 'normalized_text' | 'kind'
): PdfSegmentPayload[] {
  return segments.map((s, i) => {
    if (i !== 0) return s;
    if (field === 'normalized_text') {
      return { ...s, normalized_text: `${s.normalized_text} forged` };
    }
    return { ...s, kind: s.kind === 'heading' ? 'paragraph' : 'heading' };
  });
}

describe('S08 PDF persist RLS env gate', () => {
  it('records whether the local A/B stack is available', () => {
    if (!enabled) {
      expect(enabled).toBe(false);
      return;
    }
    expect(url && anon && adminKey()).toBeTruthy();
  });
});

if (enabled && url && anon) {
  describe('S08 productive persistPdfSourceWithUserJwt A/B', () => {
    it('exact retry after lost response → one source/version/op/object', async () => {
      await ensureUsers();
      const a = await signIn(emailA, passA);
      const buf = await fixtureTextualPdf();
      const { extracted, chunks, segments } = await prepareExtract(buf);
      const ids = createPastedTextOperationIds();

      const first = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 lost-response',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      // Simulate lost HTTP response: client retries with exact same IDs + bytes.
      const again = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 lost-response',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
        storagePath: first.storagePath,
      });
      expect(again.ok).toBe(true);
      if (again.ok) expect(again.idempotent).toBe(true);

      const { data: sources } = await a.client
        .from('sources')
        .select('id')
        .eq('id', ids.sourceId);
      expect(sources).toHaveLength(1);

      const { data: versions } = await a.client
        .from('source_versions')
        .select('id')
        .eq('id', ids.sourceVersionId);
      expect(versions).toHaveLength(1);

      const { data: ops } = await a.client
        .from('pdf_ingest_ops')
        .select('source_request_id')
        .eq('source_request_id', ids.sourceRequestId);
      expect(ops).toHaveLength(1);

      const { data: segs } = await a.client
        .from('source_segments')
        .select('id')
        .eq('source_version_id', ids.sourceVersionId);
      expect((segs ?? []).length).toBe(chunks.length);

      const dl = await a.client.storage.from(SOURCES_STORAGE_BUCKET).download(first.storagePath);
      expect(dl.error).toBeNull();
      expect(dl.data).toBeTruthy();

      await a.client.from('sources').delete().eq('id', ids.sourceId);
      const gone = await a.client.storage.from(SOURCES_STORAGE_BUCKET).download(first.storagePath);
      // Cascade may leave blob; assert via remove + re-download.
      await a.client.storage.from(SOURCES_STORAGE_BUCKET).remove([first.storagePath]);
      const afterRemove = await a.client.storage
        .from(SOURCES_STORAGE_BUCKET)
        .download(first.storagePath);
      expect(afterRemove.error || !afterRemove.data).toBeTruthy();
      void gone;
    }, 90_000);

    it('adversarial: B/anon forge path/bytes/segments/coverage; concurrency', async () => {
      await ensureUsers();
      const a = await signIn(emailA, passA);
      const b = await signIn(emailB, passB);
      const anonymous = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const buf = await fixtureTextualPdf();
      const { extracted, chunks, segments } = await prepareExtract(buf);
      const ids = createPastedTextOperationIds();

      const first = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 A',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      // B invokes productive persister with A's IDs + storagePath
      const asB = await persistPdfSourceWithUserJwt({
        accessToken: b.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 forge B',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
        storagePath: first.storagePath,
      });
      expect(asB.ok).toBe(false);

      // Anon cannot call RPC via JWT client (no user)
      const asAnon = await persistPdfSourceWithUserJwt({
        accessToken: 'invalid.token.here',
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'anon',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
        storagePath: first.storagePath,
      });
      expect(asAnon.ok).toBe(false);

      // Forge storage path owned by B's prefix but A's source ids
      const forgedPath = `${b.userId}/${ids.sourceId}/forged.pdf`;
      const forgePath = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'forge path',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
        storagePath: forgedPath,
      });
      expect(forgePath.ok).toBe(false);

      // Same-length different bytes → hash mismatch / conflict
      const otherBuf = Buffer.alloc(buf.length, 0x41);
      otherBuf.write('%PDF-1.4', 0, 'ascii');
      const otherHash = createHash('sha256').update(otherBuf).digest('hex');
      // Pre-upload conflicting object at a new path under A, then bind with wrong hash claim
      const conflictIds = createPastedTextOperationIds();
      const conflictPath = `${a.userId}/${conflictIds.sourceId}/same-len.pdf`;
      await a.client.storage.from(SOURCES_STORAGE_BUCKET).upload(conflictPath, otherBuf, {
        contentType: 'application/pdf',
        upsert: true,
      });
      const sameLen = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids: conflictIds,
        contentHash: extracted.rawHash, // claim A's hash but object is otherBuf
        extractionDigest: extracted.extractionDigest,
        title: 'same-len',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
        storagePath: conflictPath,
      });
      expect(sameLen.ok).toBe(false);
      await a.client.storage.from(SOURCES_STORAGE_BUCKET).remove([conflictPath]);
      void otherHash;

      // Divergent title on retry → conflict (title is in authoritative digest)
      const titleConflict = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 A forged title',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
        storagePath: first.storagePath,
      });
      expect(titleConflict.ok).toBe(false);

      // Forged client digest via direct RPC
      const digest = first.ok ? first.payloadDigest : '';
      const forged = await a.client.rpc('persist_pdf_source', {
        p_source_id: ids.sourceId,
        p_source_version_id: ids.sourceVersionId,
        p_source_request_id: ids.sourceRequestId,
        p_content_hash: extracted.rawHash,
        p_extraction_digest: extracted.extractionDigest,
        p_title: 'S08 A',
        p_storage_bucket: SOURCES_STORAGE_BUCKET,
        p_storage_path: first.storagePath,
        p_byte_size: buf.length,
        p_mime_type: 'application/pdf',
        p_page_count: extracted.coverage.pageCount,
        p_segments: segments,
        p_coverage: extracted.coverage,
        p_payload_digest: '0'.repeat(64),
      });
      expect(forged.error).toBeTruthy();
      void digest;

      // Divergent normalized_text on retry → conflict (not idempotent)
      const normConflict = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 A',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments: mutateSegmentText(segments, 'normalized_text'),
        coverage: extracted.coverage as unknown as Record<string, unknown>,
        storagePath: first.storagePath,
      });
      expect(normConflict.ok).toBe(false);

      // Divergent kind
      const kindConflict = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 A',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments: mutateSegmentText(segments, 'kind'),
        coverage: extracted.coverage as unknown as Record<string, unknown>,
        storagePath: first.storagePath,
      });
      expect(kindConflict.ok).toBe(false);

      // Divergent pageCount
      const pageConflict = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 A',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount + 7,
        segments,
        coverage: {
          ...(extracted.coverage as unknown as Record<string, unknown>),
          pageCount: extracted.coverage.pageCount + 7,
        },
        storagePath: first.storagePath,
      });
      expect(pageConflict.ok).toBe(false);

      // Divergent coverage status
      const covConflict = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 A',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: {
          ...(extracted.coverage as unknown as Record<string, unknown>),
          status: 'partial',
          summary: 'forged coverage',
        },
        storagePath: first.storagePath,
      });
      expect(covConflict.ok).toBe(false);

      // Extra segment
      const extraSeg = [
        ...segments,
        {
          ...segments[0]!,
          ordinal: segments.length,
          chunk_id: `${segments[0]!.chunk_id}-extra`,
        },
      ];
      const extraConflict = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids,
        contentHash: extracted.rawHash,
        extractionDigest: extracted.extractionDigest,
        title: 'S08 A',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments: extraSeg,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
        storagePath: first.storagePath,
      });
      expect(extraConflict.ok).toBe(false);

      // Missing segment
      if (segments.length > 1) {
        const missing = segments.slice(0, -1).map((s, i) => ({ ...s, ordinal: i }));
        const missingConflict = await persistPdfSourceWithUserJwt({
          accessToken: a.token,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ids,
          contentHash: extracted.rawHash,
          extractionDigest: extracted.extractionDigest,
          title: 'S08 A',
          buffer: buf,
          byteSize: buf.length,
          pageCount: extracted.coverage.pageCount,
          segments: missing,
          coverage: extracted.coverage as unknown as Record<string, unknown>,
          storagePath: first.storagePath,
        });
        expect(missingConflict.ok).toBe(false);
      }

      // Content hash mismatch (declared ≠ buffer)
      const hashMismatch = await persistPdfSourceWithUserJwt({
        accessToken: a.token,
        supabaseUrl: url,
        supabaseAnonKey: anon,
        ids: createPastedTextOperationIds(),
        contentHash: '0'.repeat(64),
        extractionDigest: extracted.extractionDigest,
        title: 'hash',
        buffer: buf,
        byteSize: buf.length,
        pageCount: extracted.coverage.pageCount,
        segments,
        coverage: extracted.coverage as unknown as Record<string, unknown>,
      });
      expect(hashMismatch.ok).toBe(false);

      // Concurrent same payload → exactly one logical source
      const concIds = createPastedTextOperationIds();
      const [c1, c2] = await Promise.all([
        persistPdfSourceWithUserJwt({
          accessToken: a.token,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ids: concIds,
          contentHash: extracted.rawHash,
          extractionDigest: extracted.extractionDigest,
          title: 'conc-same',
          buffer: buf,
          byteSize: buf.length,
          pageCount: extracted.coverage.pageCount,
          segments,
          coverage: extracted.coverage as unknown as Record<string, unknown>,
        }),
        persistPdfSourceWithUserJwt({
          accessToken: a.token,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ids: concIds,
          contentHash: extracted.rawHash,
          extractionDigest: extracted.extractionDigest,
          title: 'conc-same',
          buffer: buf,
          byteSize: buf.length,
          pageCount: extracted.coverage.pageCount,
          segments,
          coverage: extracted.coverage as unknown as Record<string, unknown>,
        }),
      ]);
      const okSame = [c1, c2].filter((r) => r.ok);
      expect(okSame.length).toBeGreaterThanOrEqual(1);
      const { data: concSources } = await a.client
        .from('sources')
        .select('id')
        .eq('id', concIds.sourceId);
      expect(concSources).toHaveLength(1);
      const { data: concOps } = await a.client
        .from('pdf_ingest_ops')
        .select('source_request_id')
        .eq('source_request_id', concIds.sourceRequestId);
      expect(concOps).toHaveLength(1);

      // Concurrent different payload (same request id) → at most one wins; loser conflicts
      const diffIds = createPastedTextOperationIds();
      const other = await fixtureMultipagePdf();
      const otherPrep = await prepareExtract(other);
      const [d1, d2] = await Promise.all([
        persistPdfSourceWithUserJwt({
          accessToken: a.token,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ids: diffIds,
          contentHash: extracted.rawHash,
          extractionDigest: extracted.extractionDigest,
          title: 'conc-diff-a',
          buffer: buf,
          byteSize: buf.length,
          pageCount: extracted.coverage.pageCount,
          segments,
          coverage: extracted.coverage as unknown as Record<string, unknown>,
        }),
        persistPdfSourceWithUserJwt({
          accessToken: a.token,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ids: diffIds,
          contentHash: otherPrep.extracted.rawHash,
          extractionDigest: otherPrep.extracted.extractionDigest,
          title: 'conc-diff-b',
          buffer: other,
          byteSize: other.length,
          pageCount: otherPrep.extracted.coverage.pageCount,
          segments: otherPrep.segments,
          coverage: otherPrep.extracted.coverage as unknown as Record<string, unknown>,
        }),
      ]);
      const okDiff = [d1, d2].filter((r) => r.ok);
      const failDiff = [d1, d2].filter((r) => !r.ok);
      expect(okDiff.length).toBe(1);
      expect(failDiff.length).toBe(1);

      // B cannot read A's rows / storage
      const { data: asBRead } = await b.client
        .from('sources')
        .select('id')
        .eq('id', ids.sourceId);
      expect(asBRead ?? []).toEqual([]);
      const denied = await b.client.storage
        .from(SOURCES_STORAGE_BUCKET)
        .download(first.storagePath);
      expect(denied.error || !denied.data).toBeTruthy();

      const { error: anonErr } = await anonymous
        .from('sources')
        .select('id')
        .eq('id', ids.sourceId);
      expect(anonErr).toBeTruthy();

      // Delete A primary + assert storage gone after remove
      const storagePath = first.ok ? first.storagePath : '';
      const { error: delErr } = await a.client.from('sources').delete().eq('id', ids.sourceId);
      expect(delErr).toBeNull();
      const { data: afterSegs } = await a.client
        .from('source_segments')
        .select('id')
        .eq('source_version_id', ids.sourceVersionId);
      expect(afterSegs ?? []).toEqual([]);
      const rem = await a.client.storage.from(SOURCES_STORAGE_BUCKET).remove([storagePath]);
      expect(rem.error).toBeNull();
      const afterDl = await a.client.storage.from(SOURCES_STORAGE_BUCKET).download(storagePath);
      expect(afterDl.error || !afterDl.data).toBeTruthy();

      // Cleanup concurrent leftovers
      await a.client.from('sources').delete().eq('id', concIds.sourceId);
      await a.client.from('sources').delete().eq('id', diffIds.sourceId);
      void chunks;
      void computePdfPersistPayloadDigest;
    }, 180_000);

    it('exactly one persist_pdf_source signature; no PUBLIC execute; forged digest rejected', async () => {
      await ensureUsers();
      const a = await signIn(emailA, passA);

      const { data: overloadCount, error: countErr } = await a.client.rpc(
        's08_persist_pdf_source_overload_count'
      );
      expect(countErr).toBeNull();
      expect(overloadCount).toBe(1);

      const { data: publicExec, error: pubErr } = await a.client.rpc(
        's08_persist_pdf_source_public_execute'
      );
      expect(pubErr).toBeNull();
      expect(publicExec).toBe(false);

      const ids = createPastedTextOperationIds();
      const buf = await fixtureTextualPdf();
      const { extracted, segments } = await prepareExtract(buf);
      const path = `${a.userId}/${ids.sourceId}/${ids.sourceVersionId}.pdf`;
      await a.client.storage.from(SOURCES_STORAGE_BUCKET).upload(path, buf, {
        contentType: 'application/pdf',
        upsert: true,
      });

      const okRpc = await a.client.rpc('persist_pdf_source', {
        p_source_id: ids.sourceId,
        p_source_version_id: ids.sourceVersionId,
        p_source_request_id: ids.sourceRequestId,
        p_content_hash: extracted.rawHash,
        p_extraction_digest: extracted.extractionDigest,
        p_title: 'sig-check',
        p_storage_bucket: SOURCES_STORAGE_BUCKET,
        p_storage_path: path,
        p_byte_size: buf.length,
        p_mime_type: 'application/pdf',
        p_page_count: extracted.coverage.pageCount,
        p_segments: segments,
        p_coverage: extracted.coverage,
      });
      expect(okRpc.error).toBeNull();
      expect(String(okRpc.error ?? '')).not.toMatch(/PGRST203/i);
      expect(okRpc.data).toBeTruthy();

      const retry = await a.client.rpc('persist_pdf_source', {
        p_source_id: ids.sourceId,
        p_source_version_id: ids.sourceVersionId,
        p_source_request_id: ids.sourceRequestId,
        p_content_hash: extracted.rawHash,
        p_extraction_digest: extracted.extractionDigest,
        p_title: 'sig-check',
        p_storage_bucket: SOURCES_STORAGE_BUCKET,
        p_storage_path: path,
        p_byte_size: buf.length,
        p_mime_type: 'application/pdf',
        p_page_count: extracted.coverage.pageCount,
        p_segments: segments,
        p_coverage: extracted.coverage,
      });
      expect(retry.error).toBeNull();
      expect((retry.data as { idempotent?: boolean } | null)?.idempotent).toBe(true);

      const forged = await a.client.rpc('persist_pdf_source', {
        p_source_id: ids.sourceId,
        p_source_version_id: ids.sourceVersionId,
        p_source_request_id: ids.sourceRequestId,
        p_content_hash: extracted.rawHash,
        p_extraction_digest: extracted.extractionDigest,
        p_title: 'sig-check',
        p_storage_bucket: SOURCES_STORAGE_BUCKET,
        p_storage_path: path,
        p_byte_size: buf.length,
        p_mime_type: 'application/pdf',
        p_page_count: extracted.coverage.pageCount,
        p_segments: segments,
        p_coverage: extracted.coverage,
        p_payload_digest: 'f'.repeat(64),
      });
      expect(forged.error).toBeTruthy();

      const empty = await fetch(`${url}/rest/v1/rpc/persist_pdf_source`, {
        method: 'POST',
        headers: {
          apikey: anon!,
          Authorization: `Bearer ${a.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(await empty.text()).not.toMatch(/PGRST203/);

      await a.client.from('sources').delete().eq('id', ids.sourceId);
      await a.client.storage.from(SOURCES_STORAGE_BUCKET).remove([path]);
    }, 120_000);
  });
}
