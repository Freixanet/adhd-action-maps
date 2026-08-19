/**
 * Persist PDF source graph via JWT-bound Supabase (Storage upload + RPC).
 * Never uses service role. Retry must not re-extract when segments+hashes provided.
 * Integrity: recalculates SHA-256 of buffer; compares existing object by hash;
 * sends authoritative payload_digest (any field mismatch → conflict).
 */

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sanitizePersistFailureCode } from '../../../shared/persistFailureCodes';
import {
  assertPathOwnedBy,
  buildSourcesObjectPath,
  SOURCES_STORAGE_BUCKET,
} from '../../../shared/sourcesStorage';
import { sniffPdfMagic } from '../../../shared/pdf/validatePdf';
import { computePdfPersistPayloadDigest } from '../../../shared/pdf/persistDigest';
import type { PastedTextOperationIds } from '../../../shared/pastedText';
import type { PdfCoverage, PdfSegmentPayload } from '../../../shared/pdf/types';

export type { PdfSegmentPayload };

export type PersistPdfSourceArgs = {
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  ids: PastedTextOperationIds;
  contentHash: string;
  extractionDigest: string;
  title: string | undefined;
  buffer: Buffer;
  byteSize: number;
  mimeType?: string;
  pageCount: number;
  segments: PdfSegmentPayload[];
  coverage: PdfCoverage | Record<string, unknown>;
  /** When set, skip re-upload and bind this path (exact retry). */
  storagePath?: string;
};

function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function persistPdfSourceWithUserJwt(
  args: PersistPdfSourceArgs
): Promise<
  | { ok: true; storagePath: string; idempotent?: boolean; payloadDigest: string }
  | { ok: false; error: string }
> {
  const token = args.accessToken.trim();
  if (!token) return { ok: false, error: 'missing_token' };

  if (!sniffPdfMagic(args.buffer)) {
    return { ok: false, error: 'PDF_INVALID_SIGNATURE' };
  }
  if (args.byteSize !== args.buffer.length) {
    return { ok: false, error: 'PDF_BYTE_SIZE_MISMATCH' };
  }
  const computedHash = sha256Buffer(args.buffer);
  if (computedHash !== args.contentHash) {
    return { ok: false, error: 'PDF_CONTENT_HASH_MISMATCH' };
  }

  const mimeType = args.mimeType || 'application/pdf';
  const coverage = args.coverage as PdfCoverage;
  const payloadDigest = computePdfPersistPayloadDigest({
    sourceId: args.ids.sourceId,
    sourceVersionId: args.ids.sourceVersionId,
    sourceRequestId: args.ids.sourceRequestId,
    contentHash: args.contentHash,
    extractionDigest: args.extractionDigest,
    pageCount: args.pageCount,
    byteSize: args.buffer.length,
    mimeType,
    title: args.title,
    coverage,
    segments: args.segments,
  });

  const client = createClient(args.supabaseUrl, args.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user?.id) {
    return { ok: false, error: sanitizePersistFailureCode(userErr?.message || 'auth_required') };
  }
  const ownerId = userData.user.id;

  let storagePath = args.storagePath?.trim() || '';
  if (storagePath && !assertPathOwnedBy(storagePath, ownerId)) {
    return { ok: false, error: 'STORAGE_PATH_NOT_OWNED' };
  }

  let uploadedThisCall = false;
  if (!storagePath) {
    const built = buildSourcesObjectPath({
      ownerId,
      sourceId: args.ids.sourceId,
      objectName: `source-${args.ids.sourceVersionId}.pdf`,
    });
    if (built.ok === false) return { ok: false, error: built.error };
    storagePath = built.path;
    const up = await client.storage.from(SOURCES_STORAGE_BUCKET).upload(storagePath, args.buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (up.error) {
      // Exact retry: object may already exist from a prior partial success.
      const existing = await client.storage.from(SOURCES_STORAGE_BUCKET).download(storagePath);
      if (existing.error || !existing.data) {
        return { ok: false, error: sanitizePersistFailureCode(up.error.message || 'STORAGE_UPLOAD_FAILED') };
      }
      const existingBuf = Buffer.from(await existing.data.arrayBuffer());
      const existingHash = sha256Buffer(existingBuf);
      if (existingHash !== computedHash) {
        return { ok: false, error: 'STORAGE_BYTES_CONFLICT' };
      }
    } else {
      uploadedThisCall = true;
    }
  } else {
    // Bound path: verify object hash matches claimed contentHash.
    const existing = await client.storage.from(SOURCES_STORAGE_BUCKET).download(storagePath);
    if (existing.error || !existing.data) {
      return { ok: false, error: sanitizePersistFailureCode(existing.error?.message || 'STORAGE_OBJECT_MISSING') };
    }
    const existingBuf = Buffer.from(await existing.data.arrayBuffer());
    if (sha256Buffer(existingBuf) !== computedHash) {
      return { ok: false, error: 'STORAGE_BYTES_CONFLICT' };
    }
  }

  const { data, error } = await client.rpc('persist_pdf_source', {
    p_source_id: args.ids.sourceId,
    p_source_version_id: args.ids.sourceVersionId,
    p_source_request_id: args.ids.sourceRequestId,
    p_content_hash: args.contentHash,
    p_extraction_digest: args.extractionDigest,
    p_title: args.title ?? null,
    p_storage_bucket: SOURCES_STORAGE_BUCKET,
    p_storage_path: storagePath,
    p_byte_size: args.buffer.length,
    p_mime_type: mimeType,
    p_page_count: args.pageCount,
    p_segments: args.segments,
    p_coverage: args.coverage,
    p_payload_digest: payloadDigest,
  });

  if (error) {
    // Roll back blob uploaded in this attempt so we leave no orphan without op rows.
    if (uploadedThisCall) {
      await client.storage.from(SOURCES_STORAGE_BUCKET).remove([storagePath]);
    }
    return { ok: false, error: sanitizePersistFailureCode(error.message || 'PDF_PERSIST_FAILED') };
  }
  if (!data) {
    if (uploadedThisCall) {
      await client.storage.from(SOURCES_STORAGE_BUCKET).remove([storagePath]);
    }
    return { ok: false, error: 'PDF_PERSIST_FAILED' };
  }
  const idempotent = Boolean((data as { idempotent?: boolean }).idempotent);
  return { ok: true, storagePath, idempotent, payloadDigest };
}
