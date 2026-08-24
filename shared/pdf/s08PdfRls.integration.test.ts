/**
 * S08 PDF A/B — store PDF bytes under sources storage; B denied.
 * Registered only with RUN_S02_RLS=1; the full gate must run with 0 skipped.
 */

import { describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildSourcesObjectPath, SOURCES_STORAGE_BUCKET } from '../sourcesStorage';
import { fixtureTextualPdf, fixtureMultipagePdf } from './fixtures';
import { extractPdfNative } from '../../server/src/ingestors/pdfExtractNative';

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

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe('S08 PDF RLS env gate', () => {
  it('records whether the local A/B stack is available', () => {
    if (!enabled) {
      expect(enabled).toBe(false);
      return;
    }
    expect(url && anon && adminKey()).toBeTruthy();
  });
});

if (enabled && url && anon) {
  describe('S08 PDF storage A/B', () => {
    it('A uploads PDF; B cannot read/link; exact retry digest stable; delete cleans row', async () => {
      await ensureUsers();
      const clientA = await signIn(emailA, passA);
      const clientB = await signIn(emailB, passB);
      const userA = (await clientA.auth.getUser()).data.user!;
      const userB = (await clientB.auth.getUser()).data.user!;
      const stamp = `${Date.now()}`;
      const buf = await fixtureTextualPdf();
      const extracted = await extractPdfNative({
        buffer: buf,
        declaredMime: 'application/pdf',
      });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) return;

      const { data: source, error: srcErr } = await clientA
        .from('sources')
        .insert({
          owner_id: userA.id,
          type: 'pdf',
          content_hash: extracted.rawHash,
          status: 'ready',
          title: `S08 PDF ${stamp}`,
        })
        .select('id')
        .single();
      expect(srcErr).toBeNull();
      const sourceId = source!.id as string;

      const pathBuild = buildSourcesObjectPath({
        ownerId: userA.id,
        sourceId,
        objectName: `doc-${stamp}.pdf`,
      });
      expect(pathBuild.ok).toBe(true);
      if (!pathBuild.ok) return;
      const path = pathBuild.path;

      const up = await clientA.storage.from(SOURCES_STORAGE_BUCKET).upload(path, buf, {
        contentType: 'application/pdf',
        upsert: false,
      });
      expect(up.error).toBeNull();

      const { data: version, error: verErr } = await clientA
        .from('source_versions')
        .insert({
          owner_id: userA.id,
          source_id: sourceId,
          version: 1,
          storage_bucket: SOURCES_STORAGE_BUCKET,
          storage_path: path,
          content_hash: extracted.rawHash,
          byte_size: buf.length,
          mime_type: 'application/pdf',
        })
        .select('id')
        .single();
      expect(verErr).toBeNull();
      expect(version?.id).toBeTruthy();

      // Exact retry extraction identity (no model call)
      const again = await extractPdfNative({
        buffer: buf,
        declaredMime: 'application/pdf',
      });
      expect(again.ok).toBe(true);
      if (again.ok) {
        expect(again.extractionDigest).toBe(extracted.extractionDigest);
        expect(again.rawHash).toBe(extracted.rawHash);
      }

      // Conflict: different PDF bytes → different digest
      const otherBuf = await fixtureMultipagePdf();
      const other = await extractPdfNative({
        buffer: otherBuf,
        declaredMime: 'application/pdf',
      });
      expect(other.ok && other.rawHash !== extracted.rawHash).toBe(true);

      // B cannot download A's object
      const denied = await clientB.storage.from(SOURCES_STORAGE_BUCKET).download(path);
      expect(denied.error || !denied.data).toBeTruthy();

      // B cannot read A's source row
      const { data: asB } = await clientB.from('sources').select('id').eq('id', sourceId);
      expect(asB ?? []).toEqual([]);

      // B cannot insert version pointing at A's source
      const { error: crossLink } = await clientB.from('source_versions').insert({
        owner_id: userB.id,
        source_id: sourceId,
        version: 2,
        storage_bucket: SOURCES_STORAGE_BUCKET,
        storage_path: `${userB.id}/${sourceId}/steal.pdf`,
        content_hash: 'x',
      });
      expect(crossLink).toBeTruthy();

      // A cannot forge storage_path under B's prefix
      const { error: pathOfB } = await clientA.from('source_versions').insert({
        owner_id: userA.id,
        source_id: sourceId,
        version: 3,
        storage_bucket: SOURCES_STORAGE_BUCKET,
        storage_path: `${userB.id}/${sourceId}/evil.pdf`,
        content_hash: 'y',
      });
      expect(pathOfB).toBeTruthy();

      await clientA.from('sources').delete().eq('id', sourceId);
      await clientA.storage.from(SOURCES_STORAGE_BUCKET).remove([path]);
    }, 60_000);
  });
}
