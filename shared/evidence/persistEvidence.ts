/**
 * Persist S05 evidence graph with user JWT (no service role).
 * Prefer transactional RPC persist_evidence_graph — no partial "complete" graph.
 * Server recomputes graph_digest; client does not supply an authoritative hash.
 */

import type { EvidenceArtifact } from './types';

export type PersistEvidenceArgs = {
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  ownerId: string;
  mapId: string;
  sourceId?: string;
  sourceVersionId?: string;
  evidence: EvidenceArtifact;
  contentHash?: string;
  isCurrent?: () => boolean;
};

export type PersistEvidenceResult =
  | { ok: true; status: 'complete'; idempotent?: boolean; graphDigest?: string }
  | {
      ok: false;
      status: number;
      error: string;
      code:
        | 'EVIDENCE_AUTH_STALE'
        | 'EVIDENCE_INCOMPLETE'
        | 'EVIDENCE_SOURCE_UNBOUND'
        | 'EVIDENCE_IDEMPOTENCY_CONFLICT'
        | 'EVIDENCE_CHUNK_UNBOUND'
        | 'EVIDENCE_NODE_MISSING'
        | 'EVIDENCE_PERSIST_FAILED'
        | string;
    };

async function supabaseRpc(
  args: PersistEvidenceArgs,
  fn: string,
  body: unknown
): Promise<{ status: number; json: unknown }> {
  try {
    const res = await fetch(`${args.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: args.supabaseAnonKey,
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch (err) {
    return {
      status: 503,
      json: {
        message: err instanceof Error ? err.message : 'network_error',
      },
    };
  }
}

function stale(args: PersistEvidenceArgs): PersistEvidenceResult | null {
  if (args.isCurrent && !args.isCurrent()) {
    return {
      ok: false,
      status: 409,
      error: 'Auth snapshot stale — evidence write aborted',
      code: 'EVIDENCE_AUTH_STALE',
    };
  }
  return null;
}

/**
 * Productive persister. Call only after the maps row exists for this owner.
 *
 * Atomic failure contract: RPC raises → full SQL rollback; no durable `failed`
 * ledger row and no partial nodes/links/complete op.
 *
 * Idempotent only when server graph_digest matches a prior complete op exactly.
 * Client must not send an authoritative digest (p_client_digest left null).
 */
export async function persistEvidenceWithUserJwt(
  args: PersistEvidenceArgs
): Promise<PersistEvidenceResult> {
  const early = stale(args);
  if (early) return early;

  if (!args.evidence || args.evidence.status !== 'complete') {
    return {
      ok: false,
      status: 400,
      error: 'Evidence artifact incomplete',
      code: 'EVIDENCE_INCOMPLETE',
    };
  }

  const hasLinks = args.evidence.links.length > 0;
  if (hasLinks && !args.sourceVersionId) {
    return {
      ok: false,
      status: 409,
      error: 'Evidence links require a normalized source version',
      code: 'EVIDENCE_SOURCE_UNBOUND',
    };
  }

  const gate = stale(args);
  if (gate) return gate;

  const nodes = args.evidence.claims.map((claim) => ({
    claim_id: claim.id,
    unit_id: claim.unitId ?? null,
    claim_text: claim.presentationText || claim.text,
    claim_type: claim.claimType,
    criticality: claim.criticality,
    epistemic_status: claim.epistemicStatus,
    presentation_status: claim.presentationStatus,
    abstention_codes: claim.abstentionCodes,
  }));

  const links = args.evidence.links.map((link) => ({
    content_node_claim_id: link.contentNodeId,
    chunk_id: link.chunkId,
    relation: link.relation,
    verifier_status: link.verifierStatus,
    epistemic_status: link.epistemicStatus,
    verifier_version: link.verifierVersion,
    check_codes: link.checkCodes,
    abstention_codes: link.abstentionCodes,
    link_key: link.id,
  }));

  // op_key is advisory; server identity is graph_digest recomputed from payload+pins.
  const opKey = [
    args.mapId,
    args.contentHash ?? '',
    args.evidence.schemaVersion,
    args.evidence.claims.length,
    args.evidence.links.length,
  ].join(':');

  const rpc = await supabaseRpc(args, 'persist_evidence_graph', {
    p_map_id: args.mapId,
    p_op_key: opKey,
    p_source_id: args.sourceId ?? null,
    p_source_version_id: args.sourceVersionId ?? null,
    p_content_hash: args.contentHash ?? null,
    p_schema_version: args.evidence.schemaVersion,
    p_prompt_version: args.evidence.promptVersion,
    p_verifier_version: args.evidence.verifierVersion,
    p_compiler_version: args.evidence.compilerVersion,
    p_model_route: args.evidence.modelRoute,
    p_nodes: nodes,
    p_links: links,
    p_client_digest: null,
  });

  if (rpc.status >= 400) {
    const msg =
      typeof rpc.json === 'object' &&
      rpc.json &&
      'message' in (rpc.json as object)
        ? String((rpc.json as { message?: string }).message ?? '')
        : '';
    let code = 'EVIDENCE_PERSIST_FAILED';
    if (/EVIDENCE_IDEMPOTENCY_CONFLICT|claim conflict|link conflict|client digest mismatch/i.test(msg)) {
      code = 'EVIDENCE_IDEMPOTENCY_CONFLICT';
    }
    if (/chunk unbound/i.test(msg)) code = 'EVIDENCE_CHUNK_UNBOUND';
    if (/content node missing/i.test(msg)) code = 'EVIDENCE_NODE_MISSING';
    if (/source_version_id required/i.test(msg)) code = 'EVIDENCE_SOURCE_UNBOUND';
    return {
      ok: false,
      status: rpc.status,
      error: msg || 'No se pudo persistir el grafo de evidencia',
      code,
    };
  }

  const body = rpc.json as {
    ok?: boolean;
    status?: string;
    idempotent?: boolean;
    graph_digest?: string;
  } | null;
  if (!body || body.ok !== true || body.status !== 'complete') {
    return {
      ok: false,
      status: 500,
      error: 'Evidence persist did not complete',
      code: 'EVIDENCE_PERSIST_FAILED',
    };
  }

  const late = stale(args);
  if (late) return late;

  return {
    ok: true,
    status: 'complete',
    idempotent: body.idempotent === true,
    graphDigest: typeof body.graph_digest === 'string' ? body.graph_digest : undefined,
  };
}
