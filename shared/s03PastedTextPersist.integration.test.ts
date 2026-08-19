/**
 * S03 local persistence + idempotency against Supabase (JWT + RPC).
 * RUN_S02_RLS=1 (same local stack) also enables these.
 * None of these tests use describe.skip when RUN_S02_RLS=1.
 */

import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createPastedTextOperationIds } from './pastedText';
import { hashCanonicalPastedText } from './pastedTextHash';
import { canonicalizePastedText } from './pastedText';
import {
  orchestratePastedTextPersistOnly,
  orchestratePastedTextTransform,
  segmentsPayload,
} from '../server/src/ingestors/pastedTextOrchestration';
import { persistPastedTextWithUserJwt } from '../server/src/ingestors/pastedTextPersist';
import { textIngestor } from '../server/src/ingestors/textIngestor';

const enabled = process.env.RUN_S02_RLS === '1';
const url = process.env.S02_SUPABASE_URL?.trim();
const anon = process.env.S02_SUPABASE_ANON_KEY?.trim();
/** Exclusive A/B identities for S03 — do not reuse S02/S05 users. */
const emailA = (process.env.S03_USER_A_EMAIL ?? 's03-a@example.com').trim();
const passA = (process.env.S03_USER_A_PASSWORD ?? 'password-a-s03').trim();
const emailB = (process.env.S03_USER_B_EMAIL ?? 's03-b@example.com').trim();
const passB = (process.env.S03_USER_B_PASSWORD ?? 'password-b-s03').trim();

const describeRls = enabled ? describe : describe.skip;

async function signIn(email: string, password: string) {
  if (!url || !anon) throw new Error('S03 persist env incomplete');
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  const token = (await client.auth.getSession()).data.session?.access_token;
  expect(token).toBeTruthy();
  return { client, token: token! };
}

describeRls('S03 pasted text cloud persist (local)', () => {
  it('A persists atomically; sequential retry converges; B cannot read A', async () => {
    if (!url || !anon || !emailA || !passA || !emailB || !passB) {
      throw new Error('S03 persist env incomplete');
    }

    const { client: a, token: tokenA } = await signIn(emailA, passA);
    const ids = createPastedTextOperationIds();
    const text = 'Persistencia atómica del texto pegado para A.';
    const canonical = canonicalizePastedText(text);

    const first = await orchestratePastedTextTransform({
      body: { type: 'text', text, textMode: 'source', ...ids },
      persistFn: async (args) =>
        persistPastedTextWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ...args,
        }),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.persistStatus).toBe('cloud');

    const second = await orchestratePastedTextPersistOnly({
      text,
      ids,
      persistFn: async (args) =>
        persistPastedTextWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ...args,
        }),
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.persistStatus).toBe('cloud');

    const { data: versions, error: vErr } = await a
      .from('source_versions')
      .select('id')
      .eq('source_id', ids.sourceId);
    expect(vErr).toBeNull();
    expect(versions).toHaveLength(1);

    const { data: segs, error: sErr } = await a
      .from('source_segments')
      .select('id, chunk_id, ordinal')
      .eq('source_version_id', ids.sourceVersionId)
      .order('ordinal');
    expect(sErr).toBeNull();
    expect((segs ?? []).length).toBe(first.ingest.chunks.length);

    const { client: b } = await signIn(emailB, passB);
    const { data: stolen, error: stealErr } = await b
      .from('sources')
      .select('id')
      .eq('id', ids.sourceId);
    expect(stealErr).toBeNull();
    expect(stolen ?? []).toEqual([]);

    expect(first.contentHash).toBe(hashCanonicalPastedText(canonical));
  });

  it('two concurrent RPCs converge to one source/version/segment set', async () => {
    if (!url || !anon || !emailA || !passA) throw new Error('S03 persist env incomplete');
    const { client: a, token: tokenA } = await signIn(emailA, passA);
    const ids = createPastedTextOperationIds();
    const text = 'Concurrente A y A otra vez sobre el mismo sourceRequestId.';

    const call = () =>
      orchestratePastedTextTransform({
        body: { type: 'text', text, textMode: 'source', ...ids },
        persistFn: async (args) =>
          persistPastedTextWithUserJwt({
            accessToken: tokenA,
            supabaseUrl: url,
            supabaseAnonKey: anon,
            ...args,
          }),
      });

    const [r1, r2] = await Promise.all([call(), call()]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const { data: versions } = await a
      .from('source_versions')
      .select('id')
      .eq('source_id', ids.sourceId);
    expect(versions).toHaveLength(1);

    const { data: segs } = await a
      .from('source_segments')
      .select('id')
      .eq('source_version_id', ids.sourceVersionId);
    expect((segs ?? []).length).toBeGreaterThan(0);
  });

  it('same sourceRequestId with different sourceId is rejected', async () => {
    if (!url || !anon || !emailA || !passA) throw new Error('S03 persist env incomplete');
    const { token: tokenA } = await signIn(emailA, passA);
    const ids = createPastedTextOperationIds();
    const text = 'Clave de operación fijada a un sourceId.';

    const first = await orchestratePastedTextTransform({
      body: { type: 'text', text, textMode: 'source', ...ids },
      persistFn: async (args) =>
        persistPastedTextWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ...args,
        }),
    });
    expect(first.ok).toBe(true);

    const hijack = createPastedTextOperationIds();
    const bad = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids: {
        mapId: hijack.mapId,
        sourceId: hijack.sourceId,
        sourceVersionId: hijack.sourceVersionId,
        sourceRequestId: ids.sourceRequestId,
      },
      contentHash: first.ok ? first.contentHash : 'x',
      rawText: canonicalizePastedText(text),
      title: undefined,
      segments: first.ok ? segmentsPayload(first.ingest.chunks) : [],
    });
    expect(bad.ok).toBe(false);
  });

  it('same request with different hash/text is rejected', async () => {
    if (!url || !anon || !emailA || !passA) throw new Error('S03 persist env incomplete');
    const { token: tokenA } = await signIn(emailA, passA);
    const ids = createPastedTextOperationIds();
    const text = 'Texto original inmutable para hash.';

    const first = await orchestratePastedTextTransform({
      body: { type: 'text', text, textMode: 'source', ...ids },
      persistFn: async (args) =>
        persistPastedTextWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ...args,
        }),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const bad = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids,
      contentHash: hashCanonicalPastedText('otro texto distinto'),
      rawText: 'otro texto distinto',
      title: undefined,
      segments: segmentsPayload(first.ingest.chunks),
    });
    expect(bad.ok).toBe(false);
  });

  it('invalid mid-array segment rolls back (no partial segments)', async () => {
    if (!url || !anon || !emailA || !passA) throw new Error('S03 persist env incomplete');
    const { client: a, token: tokenA } = await signIn(emailA, passA);
    const ids = createPastedTextOperationIds();
    const text = 'Segmento inválido a mitad debe hacer rollback.';
    const ingest = await textIngestor.ingest({ text });
    const segs = segmentsPayload(ingest.chunks);
    if (segs.length < 1) throw new Error('need segments');
    const broken = [
      ...segs.slice(0, 1),
      { ...segs[0]!, ordinal: 1, chunk_id: '' },
    ];

    const bad = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids,
      contentHash: hashCanonicalPastedText(canonicalizePastedText(text)),
      rawText: canonicalizePastedText(text),
      title: undefined,
      segments: broken,
    });
    expect(bad.ok).toBe(false);

    const { data: sources } = await a.from('sources').select('id').eq('id', ids.sourceId);
    expect(sources ?? []).toEqual([]);
  });

  it('B cannot reuse A operation; anon cannot execute RPC', async () => {
    if (!url || !anon || !emailA || !passA || !emailB || !passB) {
      throw new Error('S03 persist env incomplete');
    }
    const { token: tokenA } = await signIn(emailA, passA);
    const ids = createPastedTextOperationIds();
    const text = 'Operación de A no reutilizable por B.';

    const first = await orchestratePastedTextTransform({
      body: { type: 'text', text, textMode: 'source', ...ids },
      persistFn: async (args) =>
        persistPastedTextWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ...args,
        }),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const { token: tokenB } = await signIn(emailB, passB);
    const asB = await persistPastedTextWithUserJwt({
      accessToken: tokenB,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids,
      contentHash: first.contentHash,
      rawText: first.canonical,
      title: undefined,
      segments: segmentsPayload(first.ingest.chunks),
    });
    expect(asB.ok).toBe(false);

    const anonClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: anonErr } = await anonClient.rpc('persist_pasted_text_source', {
      p_source_id: ids.sourceId,
      p_source_version_id: ids.sourceVersionId,
      p_source_request_id: ids.sourceRequestId,
      p_content_hash: first.contentHash,
      p_raw_text: first.canonical,
      p_title: null,
      p_segments: segmentsPayload(first.ingest.chunks),
    });
    expect(anonErr).toBeTruthy();
  });

  it('same request with different sourceVersionId is rejected; segments divergence fails; exact retry succeeds', async () => {
    if (!url || !anon || !emailA || !passA) throw new Error('S03 persist env incomplete');
    const { client: a, token: tokenA } = await signIn(emailA, passA);
    const ids = createPastedTextOperationIds();
    const text = 'Idempotencia exacta de segmentos y versión.';

    const first = await orchestratePastedTextTransform({
      body: { type: 'text', text, textMode: 'source', ...ids },
      persistFn: async (args) =>
        persistPastedTextWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ...args,
        }),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const otherVersion = createPastedTextOperationIds();
    const badVersion = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids: {
        ...ids,
        sourceVersionId: otherVersion.sourceVersionId,
      },
      contentHash: first.contentHash,
      rawText: first.canonical,
      title: undefined,
      segments: segmentsPayload(first.ingest.chunks),
    });
    expect(badVersion.ok).toBe(false);

    const mutatedSegs = segmentsPayload(first.ingest.chunks).map((s, i) =>
      i === 0 ? { ...s, raw_text: s.raw_text + 'x', normalized_text: s.normalized_text + 'x' } : s
    );
    const badSegs = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids,
      contentHash: first.contentHash,
      rawText: first.canonical,
      title: undefined,
      segments: mutatedSegs,
    });
    expect(badSegs.ok).toBe(false);

    const exact = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids,
      contentHash: first.contentHash,
      rawText: first.canonical,
      title: undefined,
      segments: segmentsPayload(first.ingest.chunks),
    });
    expect(exact.ok).toBe(true);

    const { data: segs } = await a
      .from('source_segments')
      .select('id')
      .eq('source_version_id', ids.sourceVersionId);
    expect((segs ?? []).length).toBe(first.ingest.chunks.length);
  });

  it('anchor beyond utf16_length is rejected', async () => {
    if (!url || !anon || !emailA || !passA) throw new Error('S03 persist env incomplete');
    const { token: tokenA } = await signIn(emailA, passA);
    const ids = createPastedTextOperationIds();
    const text = 'Corto.';
    const canonical = canonicalizePastedText(text);
    const bad = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids,
      contentHash: hashCanonicalPastedText(canonical),
      rawText: canonical,
      title: undefined,
      segments: [
        {
          ordinal: 0,
          kind: 'chunk',
          raw_text: canonical,
          normalized_text: canonical,
          chunk_id: 'chunk_bad',
          anchor: { type: 'char_range', start: 0, end: canonical.length + 50 },
        },
      ],
    });
    expect(bad.ok).toBe(false);
  });

  it('second version of same source rejects reuse of original sourceRequestId; v1 intact', async () => {
    if (!url || !anon || !emailA || !passA) throw new Error('S03 persist env incomplete');
    const { client: a, token: tokenA } = await signIn(emailA, passA);
    const v1 = createPastedTextOperationIds();
    const text = 'Misma fuente, dos versiones válidas, un solo request por versión.';
    const canonical = canonicalizePastedText(text);

    const first = await orchestratePastedTextTransform({
      body: { type: 'text', text, textMode: 'source', ...v1 },
      persistFn: async (args) =>
        persistPastedTextWithUserJwt({
          accessToken: tokenA,
          supabaseUrl: url,
          supabaseAnonKey: anon,
          ...args,
        }),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const v2ids = createPastedTextOperationIds();
    const second = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids: {
        mapId: v2ids.mapId,
        sourceId: v1.sourceId,
        sourceVersionId: v2ids.sourceVersionId,
        sourceRequestId: v2ids.sourceRequestId,
      },
      contentHash: first.contentHash,
      rawText: first.canonical,
      title: undefined,
      segments: segmentsPayload(first.ingest.chunks),
    });
    expect(second.ok).toBe(true);

    const { data: versions } = await a
      .from('source_versions')
      .select('id, version, source_request_id')
      .eq('source_id', v1.sourceId)
      .order('version');
    expect(versions).toHaveLength(2);

    const { data: ops } = await a
      .from('pasted_text_ingest_ops')
      .select('source_request_id, source_version_id, content_hash')
      .eq('source_id', v1.sourceId);
    expect((ops ?? []).length).toBe(2);

    const reuse = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids: {
        ...v1,
        sourceVersionId: v2ids.sourceVersionId,
      },
      contentHash: first.contentHash,
      rawText: first.canonical,
      title: undefined,
      segments: segmentsPayload(first.ingest.chunks),
    });
    expect(reuse.ok).toBe(false);

    const { data: v1Segs } = await a
      .from('source_segments')
      .select('id, chunk_id')
      .eq('source_version_id', v1.sourceVersionId)
      .order('ordinal');
    expect((v1Segs ?? []).length).toBe(first.ingest.chunks.length);
    expect(v1Segs![0]!.chunk_id).toBe(first.ingest.chunks[0]!.id);

    const exactRetry = await persistPastedTextWithUserJwt({
      accessToken: tokenA,
      supabaseUrl: url,
      supabaseAnonKey: anon,
      ids: v1,
      contentHash: first.contentHash,
      rawText: first.canonical,
      title: undefined,
      segments: segmentsPayload(first.ingest.chunks),
    });
    expect(exactRetry.ok).toBe(true);
  });

  it('UTF-16: ASCII/emoji lengths verified; manipulated length rejected; exact retry ok', async () => {
    if (!url || !anon || !emailA || !passA) throw new Error('S03 persist env incomplete');
    const { client: a, token: tokenA } = await signIn(emailA, passA);

    const ascii = 'Hola UTF16';
    expect(ascii.length).toBe(10);
    const { data: asciiLen, error: asciiErr } = await a.rpc('js_utf16_length', {
      p_text: ascii,
    });
    expect(asciiErr).toBeNull();
    expect(asciiLen).toBe(10);

    const emoji = 'Hola 😀';
    expect(emoji.length).toBe(7); // 5 + surrogate pair
    const { data: emojiLen, error: emojiErr } = await a.rpc('js_utf16_length', {
      p_text: emoji,
    });
    expect(emojiErr).toBeNull();
    expect(emojiLen).toBe(7);

    async function rpcPersist(args: {
      ids: ReturnType<typeof createPastedTextOperationIds>;
      text: string;
      utf16: number | null;
      end?: number;
    }) {
      const canonical = canonicalizePastedText(args.text);
      const ingest = await textIngestor.ingest({ text: canonical });
      const segs = segmentsPayload(ingest.chunks);
      if (typeof args.end === 'number' && segs[0]) {
        segs[0] = {
          ...segs[0],
          anchor: { type: 'char_range', start: 0, end: args.end },
        };
      }
      const { error } = await a.rpc('persist_pasted_text_source', {
        p_source_id: args.ids.sourceId,
        p_source_version_id: args.ids.sourceVersionId,
        p_source_request_id: args.ids.sourceRequestId,
        p_content_hash: hashCanonicalPastedText(canonical),
        p_raw_text: canonical,
        p_title: null,
        p_segments: segs,
        p_utf16_length: args.utf16,
      });
      return error;
    }

    const tooHigh = createPastedTextOperationIds();
    expect(
      await rpcPersist({ ids: tooHigh, text: ascii, utf16: ascii.length + 5 })
    ).toBeTruthy();

    const tooLow = createPastedTextOperationIds();
    expect(
      await rpcPersist({ ids: tooLow, text: ascii, utf16: ascii.length - 1 })
    ).toBeTruthy();

    const oob = createPastedTextOperationIds();
    expect(
      await rpcPersist({
        ids: oob,
        text: ascii,
        utf16: ascii.length,
        end: ascii.length + 20,
      })
    ).toBeTruthy();

    const emojiIds = createPastedTextOperationIds();
    expect(await rpcPersist({ ids: emojiIds, text: emoji, utf16: emoji.length })).toBeNull();

    const emojiRetry = await rpcPersist({
      ids: emojiIds,
      text: emoji,
      utf16: emoji.length,
    });
    expect(emojiRetry).toBeNull();

    const { data: op } = await a
      .from('pasted_text_ingest_ops')
      .select('source_id, source_version_id, content_hash')
      .eq('source_request_id', emojiIds.sourceRequestId)
      .maybeSingle();
    expect(op?.source_id).toBe(emojiIds.sourceId);
    expect(op?.source_version_id).toBe(emojiIds.sourceVersionId);
  });
});
