import { describe, expect, it } from 'vitest';
import {
  createActiveAuthController,
  sessionIdentityFromSession,
} from './activeAuthSnapshot';

function session(userId: string, accessToken: string) {
  return { userId, accessToken };
}

describe('activeAuthSnapshot atomic identity', () => {
  it('applySession installs epoch+userId+token as one unit', () => {
    const auth = createActiveAuthController();
    const { epoch: e, applied } = auth.applySession(session('user-a', 'token-a'));
    expect(applied).toBe(true);
    expect(auth.getSnapshot()).toEqual({
      epoch: e,
      userId: 'user-a',
      accessToken: 'token-a',
    });
    expect(auth.isCurrent(e, 'user-a')).toBe(true);
  });

  it('UI A + transient snapshot B: delete cannot start with envelope mismatch', () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-b', 'token-b'));
    // React still thinks A; envelope still A — refuse.
    const begin = auth.beginDeleteAccount({ envelopeOwnerId: 'user-a' });
    expect(begin).toEqual({ ok: false, reason: 'envelope_mismatch' });
    expect(auth.getSnapshot()?.userId).toBe('user-b');
  });

  it('delete A suspended → B arrives → delete A fails: leave B, do not restore A', async () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-a', 'token-a'));
    const begin = auth.beginDeleteAccount({ envelopeOwnerId: 'user-a' });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;

    // B signs in while request is deferred
    auth.applySession(session('user-b', 'token-b'));
    expect(auth.getSnapshot()?.userId).toBe('user-b');

    const resolution = auth.resolveDeleteFailure(begin.invalidationEpoch, begin.captured);
    expect(resolution).toEqual({ action: 'leave', reason: 'superseded' });
    expect(auth.getSnapshot()).toMatchObject({
      userId: 'user-b',
      accessToken: 'token-b',
    });
  });

  it('delete A suspended → B arrives → delete A succeeds: purge A only, no sign-out of B', () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-a', 'token-a'));
    const begin = auth.beginDeleteAccount({ envelopeOwnerId: 'user-a' });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;

    auth.applySession(session('user-b', 'token-b'));
    const resolution = auth.resolveDeleteSuccess(begin.invalidationEpoch, begin.captured);
    expect(resolution).toEqual({
      action: 'purge_partition_only',
      purgedUserId: 'user-a',
      shouldLocalSignOut: false,
    });
    expect(auth.getSnapshot()?.userId).toBe('user-b');
  });

  it('delete A fails with no new session: restore A snapshot', () => {
    const auth = createActiveAuthController();
    const { epoch: e } = auth.applySession(session('user-a', 'token-a'));
    const begin = auth.beginDeleteAccount({ envelopeOwnerId: 'user-a' });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;
    expect(auth.getSnapshot()).toBeNull();
    expect(auth.isCurrent(begin.invalidationEpoch, null)).toBe(true);

    const resolution = auth.resolveDeleteFailure(begin.invalidationEpoch, begin.captured);
    expect(resolution.action).toBe('restore');
    if (resolution.action !== 'restore') return;
    expect(resolution.snapshot.userId).toBe('user-a');
    expect(resolution.snapshot.accessToken).toBe('token-a');
    expect(resolution.snapshot.epoch).not.toBe(e);
    expect(auth.getSnapshot()?.userId).toBe('user-a');
  });

  it('delete A succeeds with no new session: full local clear + sign-out', () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-a', 'token-a'));
    const begin = auth.beginDeleteAccount({ envelopeOwnerId: 'user-a' });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;

    const resolution = auth.resolveDeleteSuccess(begin.invalidationEpoch, begin.captured);
    expect(resolution).toEqual({
      action: 'full_local_clear',
      purgedUserId: 'user-a',
      shouldLocalSignOut: true,
    });
    expect(auth.getSnapshot()).toBeNull();
  });

  it('token-refresh of A during delete is ignored (does not mix snapshots)', () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-a', 'token-a1'));
    const begin = auth.beginDeleteAccount({ envelopeOwnerId: 'user-a' });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;
    expect(begin.captured.accessToken).toBe('token-a1');

    // Refresh arrives with new token while invalidation is active
    const epochBefore = auth.epoch;
    const refresh = auth.applySession(session('user-a', 'token-a2'));
    expect(refresh.applied).toBe(false);
    expect(auth.epoch).toBe(epochBefore);
    expect(auth.getSnapshot()).toBeNull();

    // Failure restores the originally captured token, not the refresh
    const resolution = auth.resolveDeleteFailure(begin.invalidationEpoch, begin.captured);
    expect(resolution.action).toBe('restore');
    if (resolution.action !== 'restore') return;
    expect(resolution.snapshot.accessToken).toBe('token-a1');
  });

  it('token-refresh of A while signed in replaces snapshot atomically (new epoch)', () => {
    const auth = createActiveAuthController();
    const { epoch: e1 } = auth.applySession(session('user-a', 'token-a1'));
    const { epoch: e2 } = auth.applySession(session('user-a', 'token-a2'));
    expect(e2).not.toBe(e1);
    expect(auth.isCurrent(e1, 'user-a')).toBe(false);
    expect(auth.getSnapshot()).toEqual({
      epoch: e2,
      userId: 'user-a',
      accessToken: 'token-a2',
    });
  });

  it('double delete: only one effective begin; second is in_progress', async () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-a', 'token-a'));
    const first = auth.beginDeleteAccount({ envelopeOwnerId: 'user-a' });
    const second = auth.beginDeleteAccount({ envelopeOwnerId: 'user-a' });
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: 'in_progress' });

    if (!first.ok) return;
    // Complete first successfully — idempotent for a second conceptual complete
    const r1 = auth.resolveDeleteSuccess(first.invalidationEpoch, first.captured);
    expect(r1.action).toBe('full_local_clear');
    const r2 = auth.resolveDeleteSuccess(first.invalidationEpoch, first.captured);
    // After settle, invalidation epoch is no longer "ours" as in-flight, but
    // isCurrent(null) may still hold — full clear is still safe/idempotent.
    expect(r2.purgedUserId).toBe('user-a');
  });

  it('sign-out does not remote-sign-out when B arrives mid-flight', () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-a', 'token-a'));
    const begin = auth.beginSignOut({ envelopeOwnerId: 'user-a' });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;

    auth.applySession(session('user-b', 'token-b'));
    const remote = auth.resolveSignOutRemote(begin.invalidationEpoch, begin.captured);
    expect(remote).toEqual({ action: 'skip_remote', reason: 'superseded' });
    expect(auth.getSnapshot()?.userId).toBe('user-b');
  });

  it('sign-out remote proceeds when invalidation still current', () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-a', 'token-a'));
    const begin = auth.beginSignOut({ envelopeOwnerId: 'user-a' });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;

    const remote = auth.resolveSignOutRemote(begin.invalidationEpoch, begin.captured);
    expect(remote).toEqual({
      action: 'remote_sign_out',
      userId: 'user-a',
      accessToken: 'token-a',
    });
  });

  it('sessionIdentityFromSession requires both fields from one object', () => {
    expect(
      sessionIdentityFromSession({
        user: { id: 'a' },
        access_token: 't',
      })
    ).toEqual({ userId: 'a', accessToken: 't' });
    expect(
      sessionIdentityFromSession({
        user: { id: 'a' },
        access_token: '',
      })
    ).toBeNull();
    expect(sessionIdentityFromSession(null)).toBeNull();
  });

  it('interleaved deferred delete failure does not surface as restore when superseded', async () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-a', 'token-a'));
    const begin = auth.beginDeleteAccount({ envelopeOwnerId: 'user-a' });
    if (!begin.ok) throw new Error('expected begin');

    let settle!: (ok: boolean) => void;
    const deferred = new Promise<boolean>((resolve) => {
      settle = resolve;
    });

    const errorsShown: string[] = [];
    const uiUser: { current: string | null } = { current: null };

    const run = (async () => {
      const ok = await deferred;
      if (!ok) {
        const resolution = auth.resolveDeleteFailure(begin.invalidationEpoch, begin.captured);
        if (resolution.action === 'restore') {
          uiUser.current = resolution.snapshot.userId;
          errorsShown.push('delete-failed-a');
        }
        // superseded: swallow error for the new identity
        return resolution;
      }
      return auth.resolveDeleteSuccess(begin.invalidationEpoch, begin.captured);
    })();

    auth.applySession(session('user-b', 'token-b'));
    uiUser.current = 'user-b';
    settle(false);
    const resolution = await run;
    expect(resolution).toEqual({ action: 'leave', reason: 'superseded' });
    expect(errorsShown).toEqual([]);
    expect(uiUser.current).toBe('user-b');
    expect(auth.getSnapshot()?.userId).toBe('user-b');
  });
});

describe('activeAuthSnapshot capture for mutations', () => {
  it('mutations must use getSnapshot() unit — never mix foreign token', () => {
    const auth = createActiveAuthController();
    auth.applySession(session('user-a', 'token-a'));
    const snap = auth.getSnapshot();
    expect(snap).not.toBeNull();
    // Simulate stale React cloudUserId=A while auth already B
    auth.applySession(session('user-b', 'token-b'));
    expect(auth.isCurrent(snap!.epoch, snap!.userId)).toBe(false);
    const live = auth.getSnapshot();
    expect(live?.userId).toBe('user-b');
    expect(live?.accessToken).toBe('token-b');
    // Mixing stale React id with old snap token is forbidden
    expect(snap!.userId === 'user-a' && live!.accessToken === 'token-b').toBe(true);
    expect(snap!.accessToken === live!.accessToken).toBe(false);
  });
});
