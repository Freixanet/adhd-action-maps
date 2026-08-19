/**
 * Atomic authenticated identity for sensitive ops (delete account, sign-out, mutations).
 *
 * Never combine React `cloudUserId` with a separate token ref — always read/write
 * `{ epoch, userId, accessToken }` as one unit from the same Session object.
 */

export type ActiveAuthSnapshot = {
  epoch: number;
  userId: string;
  accessToken: string;
};

export type SessionIdentityInput = {
  userId: string;
  accessToken: string;
};

export type DeleteAccountBeginResult =
  | { ok: false; reason: 'no_snapshot' | 'envelope_mismatch' | 'in_progress' }
  | {
      ok: true;
      captured: ActiveAuthSnapshot;
      invalidationEpoch: number;
    };

export type DeleteAccountFailResolution =
  | { action: 'restore'; snapshot: ActiveAuthSnapshot }
  | { action: 'leave'; reason: 'superseded' };

export type DeleteAccountSuccessResolution =
  | {
      action: 'full_local_clear';
      purgedUserId: string;
      shouldLocalSignOut: true;
    }
  | {
      action: 'purge_partition_only';
      purgedUserId: string;
      shouldLocalSignOut: false;
    };

export type SignOutBeginResult =
  | { ok: false; reason: 'no_snapshot' | 'envelope_mismatch' | 'in_progress' }
  | {
      ok: true;
      captured: ActiveAuthSnapshot;
      invalidationEpoch: number;
    };

export type SignOutCompleteResolution =
  | { action: 'remote_sign_out'; userId: string; accessToken: string }
  | { action: 'skip_remote'; reason: 'superseded' };

type InFlight = {
  kind: 'delete' | 'sign_out';
  userId: string;
  invalidationEpoch: number;
};

/**
 * Owns epoch + active snapshot together.
 * Compatible with hydration `isCurrent(epoch, userId)` checks.
 */
export function createActiveAuthController() {
  let epoch = 0;
  let active: ActiveAuthSnapshot | null = null;
  let inFlight: InFlight | null = null;

  function bump(userId: string | null, accessToken: string | null): number {
    epoch += 1;
    if (userId && accessToken) {
      active = { epoch, userId, accessToken };
    } else {
      active = null;
    }
    return epoch;
  }

  const api = {
    get epoch() {
      return epoch;
    },
    get activeUserId(): string | null {
      return active?.userId ?? null;
    },
    /** Immutable copy of the active snapshot, or null. */
    getSnapshot(): ActiveAuthSnapshot | null {
      return active ? { ...active } : null;
    },
    isCurrent(candidateEpoch: number, userId: string | null): boolean {
      if (userId === null) {
        return candidateEpoch === epoch && active === null;
      }
      return (
        candidateEpoch === epoch &&
        active !== null &&
        active.epoch === candidateEpoch &&
        active.userId === userId
      );
    },

    /**
     * Install identity from one Session object (atomic).
     * Same-user token refresh: new epoch + new token (invalidates prior ops).
     * While delete/sign-out for that user is in flight (active null), same-user
     * refresh is ignored so we never mix the in-flight captured token with a
     * mid-flight replacement, and we do not resurrect A over the invalidation.
     * A different user always wins (supersedes the invalidation).
     */
    applySession(identity: SessionIdentityInput | null): {
      epoch: number;
      applied: boolean;
    } {
      if (!identity) {
        return { epoch: bump(null, null), applied: true };
      }
      const userId = identity.userId.trim();
      const accessToken = identity.accessToken.trim();
      if (!userId || !accessToken) {
        return { epoch: bump(null, null), applied: true };
      }

      if (
        inFlight &&
        active === null &&
        inFlight.userId === userId &&
        (inFlight.kind === 'delete' || inFlight.kind === 'sign_out')
      ) {
        // Ignore same-user token refresh during invalidation window.
        return { epoch, applied: false };
      }

      inFlight = null;
      return { epoch: bump(userId, accessToken), applied: true };
    },

    beginDeleteAccount(args: {
      /** Active envelope owner userId, or null if guest. Must match snapshot.userId. */
      envelopeOwnerId: string | null;
    }): DeleteAccountBeginResult {
      if (inFlight) {
        return { ok: false, reason: 'in_progress' };
      }
      const captured = active ? { ...active } : null;
      if (!captured) {
        return { ok: false, reason: 'no_snapshot' };
      }
      if (args.envelopeOwnerId !== captured.userId) {
        return { ok: false, reason: 'envelope_mismatch' };
      }

      const invalidationEpoch = bump(null, null);
      inFlight = {
        kind: 'delete',
        userId: captured.userId,
        invalidationEpoch,
      };
      return { ok: true, captured, invalidationEpoch };
    },

    resolveDeleteFailure(
      invalidationEpoch: number,
      captured: ActiveAuthSnapshot
    ): DeleteAccountFailResolution {
      const canRestore =
        inFlight?.kind === 'delete' &&
        inFlight.invalidationEpoch === invalidationEpoch &&
        inFlight.userId === captured.userId &&
        api.isCurrent(invalidationEpoch, null);

      if (canRestore) {
        epoch += 1;
        active = {
          epoch,
          userId: captured.userId,
          accessToken: captured.accessToken,
        };
        inFlight = null;
        return { action: 'restore', snapshot: { ...active } };
      }

      if (inFlight?.kind === 'delete' && inFlight.invalidationEpoch === invalidationEpoch) {
        inFlight = null;
      }
      return { action: 'leave', reason: 'superseded' };
    },

    resolveDeleteSuccess(
      invalidationEpoch: number,
      captured: ActiveAuthSnapshot
    ): DeleteAccountSuccessResolution {
      const stillOurs =
        inFlight?.kind === 'delete' &&
        inFlight.invalidationEpoch === invalidationEpoch &&
        inFlight.userId === captured.userId;

      if (stillOurs) {
        inFlight = null;
      }

      if (api.isCurrent(invalidationEpoch, null)) {
        return {
          action: 'full_local_clear',
          purgedUserId: captured.userId,
          shouldLocalSignOut: true,
        };
      }

      return {
        action: 'purge_partition_only',
        purgedUserId: captured.userId,
        shouldLocalSignOut: false,
      };
    },

    beginSignOut(args: {
      envelopeOwnerId: string | null;
    }): SignOutBeginResult {
      if (inFlight) {
        return { ok: false, reason: 'in_progress' };
      }
      const captured = active ? { ...active } : null;
      if (!captured) {
        return { ok: false, reason: 'no_snapshot' };
      }
      if (
        args.envelopeOwnerId !== null &&
        args.envelopeOwnerId !== captured.userId
      ) {
        return { ok: false, reason: 'envelope_mismatch' };
      }

      const invalidationEpoch = bump(null, null);
      inFlight = {
        kind: 'sign_out',
        userId: captured.userId,
        invalidationEpoch,
      };
      return { ok: true, captured, invalidationEpoch };
    },

    /**
     * After local UI seal: only remote-sign-out if invalidation still current.
     * If B arrived, skip — do not sign out B.
     */
    resolveSignOutRemote(
      invalidationEpoch: number,
      captured: ActiveAuthSnapshot
    ): SignOutCompleteResolution {
      const stillOurs =
        inFlight?.kind === 'sign_out' &&
        inFlight.invalidationEpoch === invalidationEpoch &&
        inFlight.userId === captured.userId;

      if (stillOurs) {
        inFlight = null;
      }

      if (api.isCurrent(invalidationEpoch, null)) {
        return {
          action: 'remote_sign_out',
          userId: captured.userId,
          accessToken: captured.accessToken,
        };
      }
      return { action: 'skip_remote', reason: 'superseded' };
    },

    /** Test helper: clear in-flight without changing identity. */
    clearInFlightForTests() {
      inFlight = null;
    },
  };

  return api;
}

export type ActiveAuthController = ReturnType<typeof createActiveAuthController>;

/**
 * Build SessionIdentityInput from a Supabase-like Session, or null.
 */
export function sessionIdentityFromSession(session: {
  user?: { id?: string | null } | null;
  access_token?: string | null;
} | null): SessionIdentityInput | null {
  const userId = session?.user?.id?.trim() || '';
  const accessToken = session?.access_token?.trim() || '';
  if (!userId || !accessToken) return null;
  return { userId, accessToken };
}
