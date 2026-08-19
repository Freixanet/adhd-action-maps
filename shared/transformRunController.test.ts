import { describe, expect, it, vi } from 'vitest';
import { createTransformRunController } from './transformRunController';

describe('TransformRunController', () => {
  it('cancel during analysis aborts signal and isCurrent becomes false', () => {
    const ctrl = createTransformRunController();
    const { snapshot, signal } = ctrl.begin({
      mapId: 'm1',
      textMode: 'source',
      auth: { epoch: 1, userId: 'a', accessToken: 't' },
    });
    expect(ctrl.isCurrent(snapshot.runId)).toBe(true);
    ctrl.cancel();
    expect(signal.aborted).toBe(true);
    expect(ctrl.isCurrent(snapshot.runId)).toBe(false);
  });

  it('cancel before persist: new begin invalidates previous', () => {
    const ctrl = createTransformRunController();
    const first = ctrl.begin({
      mapId: 'm1',
      auth: { epoch: 1, userId: 'a', accessToken: 't' },
    });
    const second = ctrl.begin({
      mapId: 'm2',
      auth: { epoch: 1, userId: 'a', accessToken: 't' },
    });
    expect(first.signal.aborted).toBe(true);
    expect(ctrl.isCurrent(first.snapshot.runId)).toBe(false);
    expect(ctrl.isCurrent(second.snapshot.runId)).toBe(true);
  });

  it('late result after cancel must not be current', () => {
    const ctrl = createTransformRunController();
    const { snapshot } = ctrl.begin({
      mapId: 'm1',
      auth: { epoch: 1, userId: 'a', accessToken: 't' },
    });
    ctrl.cancel();
    expect(ctrl.isCurrentForAuth(snapshot.runId, { userId: 'a', epoch: 1 })).toBe(false);
  });

  it('late result after retry is stale for previous runId', () => {
    const ctrl = createTransformRunController();
    const first = ctrl.begin({
      mapId: 'm1',
      sourceRequestId: 'r1',
      auth: { epoch: 1, userId: 'a', accessToken: 't' },
    });
    const second = ctrl.begin({
      mapId: 'm1',
      sourceRequestId: 'r1',
      auth: { epoch: 1, userId: 'a', accessToken: 't' },
    });
    expect(ctrl.isCurrent(first.snapshot.runId)).toBe(false);
    expect(ctrl.isCurrent(second.snapshot.runId)).toBe(true);
  });

  it('double begin (double tap) keeps only latest', () => {
    const ctrl = createTransformRunController();
    const a = ctrl.begin({ mapId: 'm', auth: null });
    const b = ctrl.begin({ mapId: 'm', auth: null });
    expect(a.signal.aborted).toBe(true);
    expect(ctrl.runId).toBe(b.snapshot.runId);
  });

  it('Strict Mode remount simulation: clearIf then begin again', () => {
    const ctrl = createTransformRunController();
    const first = ctrl.begin({ mapId: 'm', auth: null });
    ctrl.clearIf(first.snapshot.runId);
    expect(ctrl.runId).toBeNull();
    const second = ctrl.begin({ mapId: 'm', auth: null });
    expect(ctrl.isCurrent(second.snapshot.runId)).toBe(true);
  });

  it('A → B during run: discard silently (isCurrentForAuth false)', () => {
    const ctrl = createTransformRunController();
    const { snapshot } = ctrl.begin({
      mapId: 'm1',
      auth: { epoch: 1, userId: 'user-a', accessToken: 'ta' },
    });
    expect(ctrl.isCurrentForAuth(snapshot.runId, { userId: 'user-b', epoch: 2 })).toBe(
      false
    );
    // Signal is not auto-aborted on auth drift — caller discards results.
    expect(ctrl.isCurrent(snapshot.runId)).toBe(true);
    expect(ctrl.isCurrentForAuth(snapshot.runId, { userId: 'user-a', epoch: 1 })).toBe(true);
  });

  it('same-user token refresh (new epoch) keeps the run', () => {
    const ctrl = createTransformRunController();
    const { snapshot } = ctrl.begin({
      mapId: 'm1',
      auth: { epoch: 1, userId: 'user-a', accessToken: 't1' },
    });
    expect(ctrl.isCurrentForAuth(snapshot.runId, { userId: 'user-a', epoch: 50 })).toBe(true);
  });

  it('obsolete ready timer cannot mark ready when run cleared', () => {
    vi.useFakeTimers();
    const ctrl = createTransformRunController();
    const { snapshot } = ctrl.begin({
      mapId: 'm1',
      auth: { epoch: 1, userId: 'a', accessToken: 't' },
    });
    let markedReady = false;
    const timer = setTimeout(() => {
      if (!ctrl.isCurrentForAuth(snapshot.runId, { userId: 'a', epoch: 1 })) return;
      markedReady = true;
    }, 400);
    ctrl.cancel();
    vi.advanceTimersByTime(500);
    clearTimeout(timer);
    expect(markedReady).toBe(false);
    vi.useRealTimers();
  });
});
