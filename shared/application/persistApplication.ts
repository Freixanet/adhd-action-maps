/**
 * Persist S06 application plan / replan / review / execution with user JWT.
 */

import type { ApplicationArtifactV1, ApplicationReviewV1 } from './types';
import { applicationPlanDigest } from './planDigest';
import { toImmutableApplicationArtifact } from './immutableCore';
import {
  APPLICATION_COMPILER_VERSION,
  APPLICATION_MODEL_ROUTE,
  APPLICATION_POLICY_VERSION,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
} from './versions';

export type PersistApplicationArgs = {
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  ownerId: string;
  mapId: string;
  sourceId?: string;
  sourceVersionId?: string;
  application: ApplicationArtifactV1;
  isCurrent?: () => boolean;
};

export type PersistApplicationResult =
  | {
      ok: true;
      status: 'complete';
      idempotent?: boolean;
      planDigest?: string;
      replaced?: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
      started?: boolean;
      hasReview?: boolean;
      activePlanDigest?: string;
    };

async function supabaseRpc(
  args: Pick<PersistApplicationArgs, 'accessToken' | 'supabaseUrl' | 'supabaseAnonKey'>,
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
      json: { message: err instanceof Error ? err.message : 'network_error' },
    };
  }
}

function stale(args: PersistApplicationArgs): PersistApplicationResult | null {
  if (args.isCurrent && !args.isCurrent()) {
    return {
      ok: false,
      status: 409,
      error: 'Auth snapshot stale — application write aborted',
      code: 'APPLICATION_AUTH_STALE',
    };
  }
  return null;
}

function messageFromJson(json: unknown, fallback: string): string {
  if (json && typeof json === 'object' && 'message' in json) {
    return String((json as { message: unknown }).message);
  }
  return fallback;
}

function codeFromPersistMessage(message: string): string {
  if (/REPLAN_REQUIRES_CONFIRMATION/i.test(message)) {
    return 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION';
  }
  if (/REVIEW_IDEMPOTENCY_CONFLICT/i.test(message)) {
    return 'APPLICATION_REVIEW_IDEMPOTENCY_CONFLICT';
  }
  if (/EXECUTION_IDEMPOTENCY_CONFLICT/i.test(message)) {
    return 'APPLICATION_EXECUTION_IDEMPOTENCY_CONFLICT';
  }
  if (/IDEMPOTENCY_CONFLICT/i.test(message)) {
    return 'APPLICATION_IDEMPOTENCY_CONFLICT';
  }
  return 'APPLICATION_PERSIST_FAILED';
}

function planRpcBody(args: PersistApplicationArgs, digest: string, artifact: ApplicationArtifactV1) {
  return {
    p_map_id: args.mapId,
    p_source_id: args.sourceId ?? null,
    p_source_version_id: args.sourceVersionId ?? null,
    p_plan_digest: digest,
    p_content_hash: artifact.contentHash,
    p_context_canonical_hash: artifact.contextCanonicalHash,
    p_schema_version: artifact.schemaVersion || APPLICATION_SCHEMA_VERSION,
    p_prompt_version: artifact.promptVersion || APPLICATION_PROMPT_VERSION,
    p_compiler_version: artifact.compilerVersion || APPLICATION_COMPILER_VERSION,
    p_policy_version: artifact.policyVersion || APPLICATION_POLICY_VERSION,
    p_model_route: artifact.modelRoute || APPLICATION_MODEL_ROUTE,
    p_artifact: artifact,
  };
}

export async function persistApplicationWithUserJwt(
  args: PersistApplicationArgs
): Promise<PersistApplicationResult> {
  const blocked = stale(args);
  if (blocked) return blocked;

  const core = toImmutableApplicationArtifact(args.application);
  const digest = applicationPlanDigest(core);
  const { status, json } = await supabaseRpc(
    args,
    'persist_application_plan',
    planRpcBody(args, digest, core)
  );

  const again = stale(args);
  if (again) return again;

  if (status >= 200 && status < 300 && json && typeof json === 'object') {
    const row = json as { ok?: boolean; idempotent?: boolean; plan_digest?: string };
    if (row.ok) {
      return {
        ok: true,
        status: 'complete',
        idempotent: Boolean(row.idempotent),
        planDigest: row.plan_digest || digest,
      };
    }
  }

  const message = messageFromJson(json, 'persist failed');
  return {
    ok: false,
    status: status || 500,
    error: message,
    code: codeFromPersistMessage(message),
  };
}

/**
 * Replace active plan P1 with P2 on the same map (atomic). Exact retry idempotent.
 */
export async function replanApplicationWithUserJwt(
  args: PersistApplicationArgs & {
    previousDigest?: string;
    confirmReplace?: boolean;
  }
): Promise<PersistApplicationResult> {
  const blocked = stale(args);
  if (blocked) return blocked;

  const core = toImmutableApplicationArtifact(args.application);
  const digest = applicationPlanDigest(core);
  const { status, json } = await supabaseRpc(args, 'replan_application_plan', {
    ...planRpcBody(args, digest, core),
    p_previous_digest: args.previousDigest ?? null,
    p_confirm_replace: Boolean(args.confirmReplace),
  });

  const again = stale(args);
  if (again) return again;

  if (status >= 200 && status < 300 && json && typeof json === 'object') {
    const row = json as {
      ok?: boolean;
      idempotent?: boolean;
      replaced?: boolean;
      plan_digest?: string;
      code?: string;
      started?: boolean;
      has_review?: boolean;
      active_plan_digest?: string;
    };
    if (row.ok) {
      return {
        ok: true,
        status: 'complete',
        idempotent: Boolean(row.idempotent),
        replaced: Boolean(row.replaced),
        planDigest: row.plan_digest || digest,
      };
    }
    if (row.code === 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION') {
      return {
        ok: false,
        status: 200,
        error: 'Replan requires confirmation for started or reviewed plan',
        code: 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION',
        started: Boolean(row.started),
        hasReview: Boolean(row.has_review),
        activePlanDigest: row.active_plan_digest,
      };
    }
  }

  const message = messageFromJson(json, 'replan failed');
  return {
    ok: false,
    status: status || 500,
    error: message,
    code: codeFromPersistMessage(message),
  };
}

export async function persistApplicationReviewWithUserJwt(
  args: PersistApplicationArgs & {
    planDigest: string;
    review: ApplicationReviewV1;
  }
): Promise<PersistApplicationResult> {
  const blocked = stale(args);
  if (blocked) return blocked;
  const { status, json } = await supabaseRpc(args, 'persist_application_review', {
    p_map_id: args.mapId,
    p_plan_digest: args.planDigest,
    p_review: args.review,
  });
  const again = stale(args);
  if (again) return again;

  if (status >= 200 && status < 300 && json && typeof json === 'object') {
    const row = json as { ok?: boolean; idempotent?: boolean };
    if (row.ok) {
      return {
        ok: true,
        status: 'complete',
        idempotent: Boolean(row.idempotent),
        planDigest: args.planDigest,
      };
    }
  }

  const message = messageFromJson(json, 'review persist failed');
  return {
    ok: false,
    status: status || 500,
    error: message,
    code: codeFromPersistMessage(message),
  };
}

export async function persistApplicationExecutionWithUserJwt(
  args: PersistApplicationArgs & {
    planDigest: string;
    startedAt?: string;
  }
): Promise<PersistApplicationResult> {
  const blocked = stale(args);
  if (blocked) return blocked;
  const startedAt = args.startedAt ?? new Date().toISOString();
  const { status, json } = await supabaseRpc(args, 'persist_application_execution', {
    p_map_id: args.mapId,
    p_plan_digest: args.planDigest,
    p_started_at: startedAt,
  });
  const again = stale(args);
  if (again) return again;

  if (status >= 200 && status < 300 && json && typeof json === 'object') {
    const row = json as { ok?: boolean; idempotent?: boolean };
    if (row.ok) {
      return {
        ok: true,
        status: 'complete',
        idempotent: Boolean(row.idempotent),
        planDigest: args.planDigest,
      };
    }
  }

  const message = messageFromJson(json, 'execution persist failed');
  return {
    ok: false,
    status: status || 500,
    error: message,
    code: codeFromPersistMessage(message),
  };
}
