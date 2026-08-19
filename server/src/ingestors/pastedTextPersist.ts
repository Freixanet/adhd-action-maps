/**
 * Persist pasted-text source graph via JWT-bound Supabase RPC (RLS / security invoker).
 * Never uses service role.
 */

import { createClient } from '@supabase/supabase-js';
import type { PastedTextOperationIds } from '../../../shared/pastedText';

export type PersistPastedTextArgs = {
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  ids: PastedTextOperationIds;
  contentHash: string;
  rawText: string;
  title: string | undefined;
  segments: Array<{
    ordinal: number;
    kind: string;
    raw_text: string;
    normalized_text: string;
    chunk_id: string;
    anchor: Record<string, unknown>;
  }>;
};

export async function persistPastedTextWithUserJwt(
  args: PersistPastedTextArgs
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = args.accessToken.trim();
  if (!token) return { ok: false, error: 'missing_token' };

  const client = createClient(args.supabaseUrl, args.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.rpc('persist_pasted_text_source', {
    p_source_id: args.ids.sourceId,
    p_source_version_id: args.ids.sourceVersionId,
    p_source_request_id: args.ids.sourceRequestId,
    p_content_hash: args.contentHash,
    p_raw_text: args.rawText,
    p_title: args.title ?? null,
    p_segments: args.segments,
    p_utf16_length: args.rawText.length,
  });

  if (error) {
    return { ok: false, error: error.message || 'SOURCE_PERSIST_FAILED' };
  }
  if (!data) {
    return { ok: false, error: 'SOURCE_PERSIST_FAILED' };
  }
  return { ok: true };
}
