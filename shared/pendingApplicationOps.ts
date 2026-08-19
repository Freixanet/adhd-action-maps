/**
 * Discriminated pending ops for S06: plan | replan | execution | review.
 * Retries call the correct RPC with the original payload. Never Gemini.
 * Replan ops store the immutable P2 core + previousDigest (CAS). Never silent P3.
 */

import { getStorage } from './storage';
import { isUuidLike } from './pastedText';
import type { ApplicationArtifactV1, ApplicationReviewV1 } from './application/types';
import {
  persistApplicationExecutionWithUserJwt,
  persistApplicationReviewWithUserJwt,
  persistApplicationWithUserJwt,
  replanApplicationWithUserJwt,
  type PersistApplicationArgs,
  type PersistApplicationResult,
} from './application/persistApplication';
import { applicationPlanDigest } from './application/planDigest';
import { toImmutableApplicationArtifact } from './application/immutableCore';
import { setActivePlanDigest } from './application/activePlanDigestStore';
import { validateApplicationArtifact } from './application/validate';

export type PendingApplicationOpKind = 'plan' | 'replan' | 'execution' | 'review';

export type PendingApplicationOp = {
  kind: PendingApplicationOpKind;
  mapId: string;
  planDigest?: string;
  previousDigest?: string;
  confirmReplace?: boolean;
  /** Exact immutable P2 core for replan — never derive silently from a newer local P3. */
  immutableArtifact?: ApplicationArtifactV1;
  /** Confirmation dialog pending — must NOT auto-retry as network failure. */
  awaitingConfirmation?: boolean;
  superseded?: boolean;
  supersededByDigest?: string;
  startedAt?: string;
  review?: ApplicationReviewV1;
  sourceId?: string;
  sourceVersionId?: string;
  contentHash?: string;
  updatedAt: number;
  /** Set on normal sign-out; kept for next login. Cleared only on map/account delete. */
  sealedAt?: number;
};

function keyForUser(userId: string): string {
  return `nucleo_pending_application_ops:user:${userId.trim()}`;
}

function artifactLooksSafe(artifact: unknown): artifact is ApplicationArtifactV1 {
  if (!artifact || typeof artifact !== 'object') return false;
  const row = artifact as ApplicationArtifactV1;
  return (
    typeof row.contentHash === 'string' &&
    typeof row.contextCanonicalHash === 'string' &&
    row.plan != null &&
    typeof row.plan.id === 'string'
  );
}

export function isValidPendingApplicationOp(item: unknown): item is PendingApplicationOp {
  if (!item || typeof item !== 'object') return false;
  const row = item as PendingApplicationOp;
  if (
    row.kind !== 'plan' &&
    row.kind !== 'replan' &&
    row.kind !== 'execution' &&
    row.kind !== 'review'
  ) {
    return false;
  }
  if (typeof row.mapId !== 'string' || !row.mapId) return false;
  if (typeof row.updatedAt !== 'number') return false;
  if (row.sourceId !== undefined && !isUuidLike(row.sourceId)) return false;
  if (row.sourceVersionId !== undefined && !isUuidLike(row.sourceVersionId)) return false;
  if (row.kind === 'execution' && typeof row.startedAt !== 'string') return false;
  if (row.kind === 'review' && (!row.review || typeof row.review.id !== 'string')) return false;
  if (
    (row.kind === 'execution' || row.kind === 'review' || row.kind === 'replan') &&
    (typeof row.planDigest !== 'string' || !row.planDigest)
  ) {
    return false;
  }
  if (row.kind === 'replan') {
    if (typeof row.previousDigest !== 'string' || row.previousDigest.length < 8) return false;
    if (row.immutableArtifact !== undefined && !artifactLooksSafe(row.immutableArtifact)) {
      return false;
    }
  }
  // Never persist secrets
  const raw = JSON.stringify(row);
  if (/eyJhbGci|sb_secret_|Bearer\s+[A-Za-z0-9._-]+/i.test(raw)) return false;
  return true;
}

export function loadPendingApplicationOps(userId: string): PendingApplicationOp[] {
  const id = userId.trim();
  if (!id) return [];
  try {
    const raw = getStorage().getItem(keyForUser(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPendingApplicationOp);
  } catch {
    return [];
  }
}

export function savePendingApplicationOps(userId: string, items: PendingApplicationOp[]): void {
  const id = userId.trim();
  if (!id) return;
  try {
    getStorage().setItem(
      keyForUser(id),
      JSON.stringify(items.filter(isValidPendingApplicationOp))
    );
  } catch {
    /* ignore */
  }
}

function opKey(op: PendingApplicationOp): string {
  if (op.kind === 'review') return `${op.kind}:${op.mapId}:${op.review?.id ?? ''}`;
  if (op.kind === 'execution') return `${op.kind}:${op.mapId}:${op.startedAt ?? ''}`;
  return `${op.kind}:${op.mapId}:${op.planDigest ?? ''}`;
}

export function upsertPendingApplicationOp(
  userId: string,
  item: Omit<PendingApplicationOp, 'updatedAt'>
): void {
  const next: PendingApplicationOp = { ...item, updatedAt: Date.now() };
  if (!isValidPendingApplicationOp(next)) return;
  const existing = loadPendingApplicationOps(userId).filter(
    (row) => opKey(row) !== opKey(next)
  );
  existing.push(next);
  savePendingApplicationOps(userId, existing);
}

export function removePendingApplicationOp(
  userId: string,
  kind: PendingApplicationOpKind,
  mapId: string,
  extra?: { reviewId?: string; startedAt?: string; planDigest?: string }
): void {
  savePendingApplicationOps(
    userId,
    loadPendingApplicationOps(userId).filter((row) => {
      if (row.kind !== kind || row.mapId !== mapId) return true;
      if (kind === 'review' && extra?.reviewId && row.review?.id !== extra.reviewId) return true;
      if (kind === 'execution' && extra?.startedAt && row.startedAt !== extra.startedAt) {
        return true;
      }
      if (
        (kind === 'plan' || kind === 'replan') &&
        extra?.planDigest &&
        row.planDigest !== extra.planDigest
      ) {
        return true;
      }
      return false;
    })
  );
}

export function removeAllPendingApplicationOpsForMap(userId: string, mapId: string): void {
  savePendingApplicationOps(
    userId,
    loadPendingApplicationOps(userId).filter((row) => row.mapId !== mapId)
  );
}

/**
 * Drop ops for maps that are gone (or plan ops with no local artifact).
 * Home must not resurrect a global error from leftover storage.
 */
export function reconcilePendingApplicationOpsWithHistory(args: {
  userId: string;
  entries: Array<{ id: string; session?: { data?: unknown } }>;
}): PendingApplicationOp[] {
  const known = new Map(args.entries.map((entry) => [entry.id, entry]));
  const pending = loadPendingApplicationOps(args.userId);
  const kept = pending.filter((op) => {
    const entry = known.get(op.mapId);
    if (!entry) return false;
    if (op.kind === 'plan') {
      const data = entry.session?.data as { application?: unknown } | undefined;
      if (!data?.application) return false;
    }
    return true;
  });
  if (kept.length !== pending.length) {
    savePendingApplicationOps(args.userId, kept);
  }
  return kept;
}

/** True when copy is a map-scoped application sync notice — not a home Error. */
export function isApplicationSyncPendingCopy(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    message === pendingApplicationBannerMessage('plan') ||
    message === pendingApplicationBannerMessage('execution') ||
    message === pendingApplicationBannerMessage('review') ||
    message === pendingApplicationBannerMessage('replan') ||
    message === 'El plan de aplicación aún no se ha guardado.'
  );
}

/** Normal sign-out: seal ops so next login can flush them. */
export function sealPendingApplicationOpsForUser(userId: string): void {
  const id = userId.trim();
  if (!id) return;
  const sealedAt = Date.now();
  savePendingApplicationOps(
    id,
    loadPendingApplicationOps(id).map((row) => ({ ...row, sealedAt }))
  );
}

/** Map delete or account delete: purge permanently. */
export function clearPendingApplicationOpsForUser(userId: string): void {
  try {
    getStorage().removeItem(keyForUser(userId.trim()));
  } catch {
    /* ignore */
  }
}

export function pendingApplicationBannerMessage(kind: PendingApplicationOpKind): string {
  switch (kind) {
    case 'execution':
      return 'Inicio de acción pendiente de sincronizar';
    case 'review':
      return 'Revisión pendiente de sincronizar';
    case 'replan':
      return 'Replanificación pendiente de sincronizar';
    default:
      return 'Sincronización del plan de aplicación pendiente';
  }
}

export function markReplanSuperseded(
  userId: string,
  mapId: string,
  planDigest: string,
  supersededByDigest: string
): void {
  const next = loadPendingApplicationOps(userId).map((row) => {
    if (row.kind === 'replan' && row.mapId === mapId && row.planDigest === planDigest) {
      return { ...row, superseded: true, supersededByDigest, updatedAt: Date.now() };
    }
    return row;
  });
  savePendingApplicationOps(userId, next);
}

/**
 * Resolve exact replan payload. Never silently use a newer local P3 under P2's identity.
 */
export function resolveReplanArtifactForFlush(
  item: PendingApplicationOp,
  localApplication: ApplicationArtifactV1 | null
):
  | { ok: true; artifact: ApplicationArtifactV1 }
  | { ok: false; reason: 'missing' | 'digest_mismatch' | 'superseded' | 'invalid' } {
  if (item.kind !== 'replan' || !item.planDigest || !item.previousDigest) {
    return { ok: false, reason: 'invalid' };
  }
  if (item.superseded) return { ok: false, reason: 'superseded' };

  if (item.immutableArtifact) {
    const core = toImmutableApplicationArtifact(item.immutableArtifact);
    const validated = validateApplicationArtifact(core);
    const artifact = validated.ok ? validated.value : core;
    const digest = applicationPlanDigest(artifact);
    if (digest !== item.planDigest) return { ok: false, reason: 'digest_mismatch' };
    return { ok: true, artifact };
  }

  if (!localApplication) return { ok: false, reason: 'missing' };
  const core = toImmutableApplicationArtifact(localApplication);
  const digest = applicationPlanDigest(core);
  if (digest !== item.planDigest) return { ok: false, reason: 'digest_mismatch' };
  return { ok: true, artifact: core };
}

export type FlushApplicationOpsDeps = {
  getApplicationForMap: (mapId: string) => ApplicationArtifactV1 | null;
  isCurrent?: () => boolean;
  persistPlan?: typeof persistApplicationWithUserJwt;
  persistReplan?: typeof replanApplicationWithUserJwt;
  persistExecution?: typeof persistApplicationExecutionWithUserJwt;
  persistReview?: typeof persistApplicationReviewWithUserJwt;
  /** When local P3 supersedes pending P2, create an explicit P3 replan op. */
  onReplanSuperseded?: (args: {
    mapId: string;
    oldDigest: string;
    newDigest: string;
    local: ApplicationArtifactV1;
    previousDigest: string;
  }) => void;
};

export async function flushPendingApplicationOps(
  userId: string,
  auth: Pick<PersistApplicationArgs, 'accessToken' | 'supabaseUrl' | 'supabaseAnonKey'>,
  deps: FlushApplicationOpsDeps
): Promise<{
  flushed: string[];
  failed: Array<{ mapId: string; kind: PendingApplicationOpKind; reason?: string }>;
}> {
  const persistPlan = deps.persistPlan ?? persistApplicationWithUserJwt;
  const persistReplan = deps.persistReplan ?? replanApplicationWithUserJwt;
  const persistExecution = deps.persistExecution ?? persistApplicationExecutionWithUserJwt;
  const persistReview = deps.persistReview ?? persistApplicationReviewWithUserJwt;

  const pending = loadPendingApplicationOps(userId);
  const flushed: string[] = [];
  const failed: Array<{ mapId: string; kind: PendingApplicationOpKind; reason?: string }> = [];

  for (const item of pending) {
    if (deps.isCurrent && !deps.isCurrent()) break;
    if (item.superseded) continue;
    // Confirmation is a dialog state — never auto-retry as network failure.
    if (item.awaitingConfirmation && item.confirmReplace !== true) {
      continue;
    }

    const application = deps.getApplicationForMap(item.mapId);
    if (!application && item.kind !== 'execution' && item.kind !== 'review' && item.kind !== 'replan') {
      removePendingApplicationOp(userId, item.kind, item.mapId, {
        planDigest: item.planDigest,
      });
      continue;
    }

    let result: PersistApplicationResult;

    if (item.kind === 'plan') {
      if (!application) {
        failed.push({ mapId: item.mapId, kind: item.kind, reason: 'missing' });
        continue;
      }
      const core = toImmutableApplicationArtifact(application);
      result = await persistPlan({
        ...auth,
        ownerId: userId,
        mapId: item.mapId,
        sourceId: item.sourceId,
        sourceVersionId: item.sourceVersionId,
        application: core,
        isCurrent: deps.isCurrent,
      });
    } else if (item.kind === 'replan') {
      const resolved = resolveReplanArtifactForFlush(item, application);
      if (resolved.ok === false) {
        if (resolved.reason === 'digest_mismatch' && application && item.planDigest) {
          const localDigest = applicationPlanDigest(toImmutableApplicationArtifact(application));
          markReplanSuperseded(userId, item.mapId, item.planDigest, localDigest);
          deps.onReplanSuperseded?.({
            mapId: item.mapId,
            oldDigest: item.planDigest,
            newDigest: localDigest,
            local: application,
            previousDigest: item.previousDigest!,
          });
        }
        failed.push({ mapId: item.mapId, kind: item.kind, reason: resolved.reason });
        continue;
      }
      if (!item.previousDigest) {
        failed.push({ mapId: item.mapId, kind: item.kind, reason: 'missing_previous' });
        continue;
      }
      result = await persistReplan({
        ...auth,
        ownerId: userId,
        mapId: item.mapId,
        sourceId: item.sourceId,
        sourceVersionId: item.sourceVersionId,
        application: resolved.artifact,
        previousDigest: item.previousDigest,
        confirmReplace: item.confirmReplace,
        isCurrent: deps.isCurrent,
      });
    } else if (item.kind === 'execution') {
      if (!item.planDigest || !item.startedAt) {
        failed.push({ mapId: item.mapId, kind: item.kind });
        continue;
      }
      result = await persistExecution({
        ...auth,
        ownerId: userId,
        mapId: item.mapId,
        sourceId: item.sourceId,
        sourceVersionId: item.sourceVersionId,
        application: application
          ? toImmutableApplicationArtifact(application)
          : (application as unknown as ApplicationArtifactV1),
        planDigest: item.planDigest,
        startedAt: item.startedAt,
        isCurrent: deps.isCurrent,
      });
    } else {
      if (!item.planDigest || !item.review) {
        failed.push({ mapId: item.mapId, kind: item.kind });
        continue;
      }
      const review =
        application?.review?.id === item.review.id ? application.review : item.review;
      result = await persistReview({
        ...auth,
        ownerId: userId,
        mapId: item.mapId,
        sourceId: item.sourceId,
        sourceVersionId: item.sourceVersionId,
        application: application
          ? toImmutableApplicationArtifact(application)
          : (application as unknown as ApplicationArtifactV1),
        planDigest: item.planDigest,
        review,
        isCurrent: deps.isCurrent,
      });
    }

    if (result.ok === true) {
      removePendingApplicationOp(userId, item.kind, item.mapId, {
        reviewId: item.review?.id,
        startedAt: item.startedAt,
        planDigest: item.planDigest,
      });
      if ((item.kind === 'plan' || item.kind === 'replan') && result.planDigest) {
        setActivePlanDigest(userId, item.mapId, result.planDigest);
      }
      flushed.push(`${item.kind}:${item.mapId}`);
    } else if (result.ok === false && result.code === 'APPLICATION_AUTH_STALE') {
      failed.push({ mapId: item.mapId, kind: item.kind, reason: 'auth_stale' });
      break;
    } else if (
      result.ok === false &&
      result.code === 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION'
    ) {
      // Typed confirmation — do not treat as network retry.
      upsertPendingApplicationOp(userId, {
        ...item,
        awaitingConfirmation: true,
        confirmReplace: false,
      });
      failed.push({ mapId: item.mapId, kind: item.kind, reason: 'requires_confirmation' });
    } else {
      failed.push({ mapId: item.mapId, kind: item.kind, reason: result.ok === false ? result.code : 'fail' });
    }
  }
  return { flushed, failed };
}

export const APPLICATION_SYNC_PENDING_MESSAGE =
  pendingApplicationBannerMessage('plan');
export const APPLICATION_EXECUTION_SYNC_PENDING_MESSAGE =
  pendingApplicationBannerMessage('execution');
export const APPLICATION_REVIEW_SYNC_PENDING_MESSAGE =
  pendingApplicationBannerMessage('review');
export const APPLICATION_REPLAN_SYNC_PENDING_MESSAGE =
  pendingApplicationBannerMessage('replan');
