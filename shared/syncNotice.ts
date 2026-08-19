/**
 * Stable sync notice for the active map — derived, not last-writer-wins on setError.
 */

export type SyncLaneStatus = 'idle' | 'saved' | 'pending' | 'saving' | 'error';

/** Honest DEV panel statuses — "guardado" only after cloud confirmation. */
export type PersistLaneDevStatus =
  | 'not_applicable'
  | 'unknown'
  | 'pending'
  | 'saving'
  | 'confirmed'
  | 'error';

export type SyncRetryKind = 'source' | 'evidence' | 'progress' | 'application' | null;

export type ActiveMapSyncSnapshot = {
  sourcePending: boolean;
  evidencePending: boolean;
  progressPending: boolean;
  applicationPending: boolean;
  /** True while a source persist is in flight for this map. */
  sourceSaving?: boolean;
  /** True while an evidence persist is in flight for this map. */
  evidenceSaving?: boolean;
  retryingKind: SyncRetryKind;
  lastFailureCode: string | null;
  /** Evidence must wait until source is cloud-bound. */
  evidenceBlockedBySource?: boolean;
  /** Source version confirmed cloud (persistStatus === cloud). */
  sourceCloudConfirmed?: boolean;
  /** Map has a complete evidence artifact that can be persisted. */
  evidenceApplicable?: boolean;
  /** Evidence graph confirmed persisted for this map. */
  evidenceCloudConfirmed?: boolean;
};

export type SyncNoticeViewModel = {
  visible: boolean;
  title: string;
  message: string;
  retryLabel: string | null;
  retryKind: SyncRetryKind;
  /** Stable identity for live-region announcements — changes only when meaning changes. */
  liveRegionKey: string;
  sourceStatus: SyncLaneStatus;
  evidenceStatus: SyncLaneStatus;
  /** Honest DEV labels — never "guardado" without cloud confirmation. */
  sourceDevStatus: PersistLaneDevStatus;
  evidenceDevStatus: PersistLaneDevStatus;
};

export const SYNC_NOTICE_TITLE = 'Sincronización pendiente';

export function laneStatus(args: {
  pending: boolean;
  saving?: boolean;
  failed?: boolean;
  blocked?: boolean;
}): SyncLaneStatus {
  if (args.saving) return 'saving';
  if (args.failed && args.pending) return 'error';
  if (args.pending || args.blocked) return 'pending';
  if (!args.pending && !args.blocked) return 'saved';
  return 'idle';
}

/**
 * Single stable banner for the active map. Message does not alternate unless
 * the underlying pending/saving set actually changes.
 */
export function deriveSyncNotice(snap: ActiveMapSyncSnapshot): SyncNoticeViewModel | null {
  const sourcePending = snap.sourcePending;
  const evidencePending = snap.evidencePending || Boolean(snap.evidenceBlockedBySource);
  const progressPending = snap.progressPending;
  const applicationPending = snap.applicationPending;

  const anyPending =
    sourcePending || evidencePending || progressPending || applicationPending;
  if (!anyPending && !snap.sourceSaving && !snap.evidenceSaving) {
    return null;
  }

  const sourceSaving = Boolean(snap.sourceSaving);
  const evidenceSaving = Boolean(snap.evidenceSaving);

  const sourceStatus = laneStatus({
    pending: sourcePending,
    saving: sourceSaving,
    failed: Boolean(snap.lastFailureCode?.startsWith('SOURCE_') || snap.lastFailureCode?.startsWith('PDF_') || snap.lastFailureCode === 'SUPABASE_ANON_INVALID' || snap.lastFailureCode === 'PDF_RPC_UNAVAILABLE' || snap.lastFailureCode === 'PDF_SCHEMA_MISSING'),
  });
  const evidenceStatus = laneStatus({
    pending: evidencePending,
    saving: evidenceSaving,
    failed: Boolean(snap.lastFailureCode?.startsWith('EVIDENCE_')),
    blocked: snap.evidenceBlockedBySource && !sourcePending,
  });

  const sourceDevStatus = derivePersistLaneDevStatus({
    applicable: true,
    pending: sourcePending,
    saving: sourceSaving,
    cloudConfirmed: Boolean(snap.sourceCloudConfirmed),
    failed: Boolean(
      snap.lastFailureCode?.startsWith('SOURCE_') ||
        snap.lastFailureCode?.startsWith('PDF_') ||
        snap.lastFailureCode === 'SUPABASE_ANON_INVALID'
    ),
  });
  const evidenceDevStatus = derivePersistLaneDevStatus({
    applicable: Boolean(snap.evidenceApplicable),
    pending: evidencePending,
    saving: evidenceSaving,
    cloudConfirmed: Boolean(snap.evidenceCloudConfirmed),
    failed: Boolean(snap.lastFailureCode?.startsWith('EVIDENCE_')),
  });

  let message: string;
  let retryKind: SyncRetryKind = null;
  let retryLabel: string | null = 'Reintentar sincronización';

  if (sourceSaving) {
    message = 'Guardando documento…';
    retryLabel = null;
    retryKind = null;
  } else if (evidenceSaving && !sourcePending) {
    message = 'Guardando referencias…';
    retryLabel = null;
    retryKind = null;
  } else if (sourcePending && evidencePending) {
    message = 'Falta guardar el documento y sus referencias.';
    retryKind = 'source';
  } else if (sourcePending) {
    message = 'El documento aún no se ha guardado en tu cuenta.';
    retryKind = 'source';
  } else if (evidencePending) {
    message = 'Las referencias del Núcleo aún no se han guardado.';
    retryKind = 'evidence';
  } else if (progressPending) {
    message = 'El progreso del Núcleo aún no se ha guardado.';
    retryKind = 'progress';
  } else if (applicationPending) {
    message = 'El plan de aplicación aún no se ha guardado.';
    retryKind = 'application';
  } else {
    return null;
  }

  const liveRegionKey = [
    sourcePending ? 'S' : '-',
    evidencePending ? 'E' : '-',
    progressPending ? 'P' : '-',
    applicationPending ? 'A' : '-',
    sourceSaving ? 'sS' : '',
    evidenceSaving ? 'sE' : '',
  ].join('');

  return {
    visible: true,
    title: SYNC_NOTICE_TITLE,
    message,
    retryLabel,
    retryKind,
    liveRegionKey,
    sourceStatus,
    evidenceStatus,
    sourceDevStatus,
    evidenceDevStatus,
  };
}

/**
 * DEV lane honesty: absence of pending ≠ confirmed cloud.
 */
export function derivePersistLaneDevStatus(args: {
  applicable: boolean;
  pending: boolean;
  saving?: boolean;
  cloudConfirmed: boolean;
  failed?: boolean;
}): PersistLaneDevStatus {
  if (!args.applicable) return 'not_applicable';
  if (args.saving) return 'saving';
  if (args.failed && args.pending) return 'error';
  if (args.pending) return 'pending';
  if (args.cloudConfirmed) return 'confirmed';
  if (args.failed) return 'error';
  return 'unknown';
}

/** Human labels for the DEV persistence panel. */
export function syncLaneDevLabel(status: SyncLaneStatus | PersistLaneDevStatus): string {
  switch (status) {
    case 'saved':
    case 'confirmed':
      return status === 'confirmed' ? 'guardado confirmado' : 'guardado';
    case 'pending':
      return 'pendiente';
    case 'saving':
      return 'guardando';
    case 'error':
      return 'error';
    case 'not_applicable':
      return 'no aplicable';
    case 'unknown':
      return 'desconocido';
    default:
      return '—';
  }
}

/**
 * Whether evidence flush should run now. Source must not be pending.
 */
export function canFlushEvidence(args: {
  sourcePending: boolean;
  evidencePending: boolean;
  sourceId?: string | null;
  sourceVersionId?: string | null;
}): { ok: true } | { ok: false; code: 'EVIDENCE_WAITING_SOURCE' | 'EVIDENCE_SOURCE_UNBOUND' | 'EVIDENCE_NOT_PENDING' } {
  if (!args.evidencePending) return { ok: false, code: 'EVIDENCE_NOT_PENDING' };
  if (args.sourcePending) return { ok: false, code: 'EVIDENCE_WAITING_SOURCE' };
  if (!args.sourceId?.trim() || !args.sourceVersionId?.trim()) {
    return { ok: false, code: 'EVIDENCE_SOURCE_UNBOUND' };
  }
  return { ok: true };
}

/**
 * Ordered auto-flush plan: source → evidence → progress.
 * Evidence stays on the plan even while source is pending; the flush itself
 * no-ops via canFlushEvidence until source is cloud-bound, then runs once
 * in the same ordered pass after source succeeds.
 */
export function orderedSyncRetryPlan(snap: Pick<
  ActiveMapSyncSnapshot,
  'sourcePending' | 'evidencePending' | 'progressPending'
>): Array<'source' | 'evidence' | 'progress'> {
  const plan: Array<'source' | 'evidence' | 'progress'> = [];
  if (snap.sourcePending) plan.push('source');
  if (snap.evidencePending) plan.push('evidence');
  if (snap.progressPending) plan.push('progress');
  return plan;
}
