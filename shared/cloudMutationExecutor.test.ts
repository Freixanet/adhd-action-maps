import { describe, expect, it } from 'vitest';
import {
  captureMutationSnapshot,
  runBoundCloudMutation,
  type ImmutableAuthSnapshot,
} from './cloudMutationExecutor';
import { createHydrationEpochController } from './cloudHistoryHydration';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('cloudMutationExecutor', () => {
  it('push A suspended → sign-out (epoch null): does not apply to guest', async () => {
    const gate = createHydrationEpochController();
    const epoch = gate.begin('user-a');
    const pushWait = deferred<void>();
    const applied: string[] = [];
    const errors: unknown[] = [];

    const snapshot: ImmutableAuthSnapshot = {
      epoch,
      userId: 'user-a',
      accessToken: 'token-a',
    };

    const run = runBoundCloudMutation({
      snapshot,
      gate: { isCurrent: (e, u) => gate.isCurrent(e, u) },
      expectedOwnerId: 'user-a',
      createClient: (s) => ({ expectedUserId: s.userId, label: 'A' }),
      run: async () => {
        await pushWait.promise;
        return 'pushed';
      },
      onApplied: (result) => applied.push(String(result)),
      onErrorCurrent: (err) => errors.push(err),
    });

    gate.begin(null); // sign-out invalidation
    pushWait.resolve();
    const { outcome } = await run;
    expect(outcome).toBe('stale');
    expect(applied).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('delete A suspended → B active: does not rewrite B memory via onApplied', async () => {
    const gate = createHydrationEpochController();
    const epochA = gate.begin('user-a');
    const delWait = deferred<void>();
    const durable: Record<string, string[]> = {
      'user-a': ['map-a'],
      'user-b': ['map-b'],
    };
    let memory = ['map-a'];

    const run = runBoundCloudMutation({
      snapshot: { epoch: epochA, userId: 'user-a', accessToken: 'a' },
      gate: { isCurrent: (e, u) => gate.isCurrent(e, u) },
      expectedOwnerId: 'user-a',
      createClient: (s) => ({ expectedUserId: s.userId }),
      run: async () => {
        await delWait.promise;
        return { remaining: [] as string[] };
      },
      onApplied: (result) => {
        // Would wrongly touch B if called after switch
        memory = result.remaining;
        durable['user-b'] = ['tampered'];
      },
    });

    // Simulate durable update that mutation host should do for A even when stale:
    // executor itself must not call onApplied when stale.
    gate.begin('user-b');
    memory = ['map-b'];
    delWait.resolve();
    const { outcome, result } = await run;
    expect(outcome).toBe('stale');
    expect(result?.remaining).toEqual([]);
    expect(memory).toEqual(['map-b']);
    expect(durable['user-b']).toEqual(['map-b']);
  });

  it('rejects when expectedOwnerId mismatches snapshot', async () => {
    const gate = createHydrationEpochController();
    const epoch = gate.begin('user-a');
    const { outcome } = await runBoundCloudMutation({
      snapshot: { epoch, userId: 'user-a', accessToken: 't' },
      gate: { isCurrent: (e, u) => gate.isCurrent(e, u) },
      expectedOwnerId: 'user-b',
      createClient: (s) => ({ expectedUserId: s.userId }),
      run: async () => 'x',
    });
    expect(outcome).toBe('stale');
  });

  it('stale error does not surface onErrorCurrent', async () => {
    const gate = createHydrationEpochController();
    const epoch = gate.begin('user-a');
    const wait = deferred<void>();
    const errors: unknown[] = [];
    const run = runBoundCloudMutation({
      snapshot: { epoch, userId: 'user-a', accessToken: 't' },
      gate: { isCurrent: (e, u) => gate.isCurrent(e, u) },
      expectedOwnerId: 'user-a',
      createClient: (s) => ({ expectedUserId: s.userId }),
      run: async () => {
        await wait.promise;
        throw new Error('fail-a');
      },
      onErrorCurrent: (err) => errors.push(err),
    });
    gate.begin('user-b');
    wait.resolve();
    const { outcome } = await run;
    expect(outcome).toBe('error-stale');
    expect(errors).toEqual([]);
  });

  it('scheduled push for A after B activates never runs as B', async () => {
    const gate = createHydrationEpochController();
    const epochA = gate.begin('user-a');
    const clients: string[] = [];
    // Timer fires after B is active but still holds A's snapshot.
    gate.begin('user-b');
    const { outcome } = await runBoundCloudMutation({
      snapshot: { epoch: epochA, userId: 'user-a', accessToken: 'token-a' },
      gate: { isCurrent: (e, u) => gate.isCurrent(e, u) },
      expectedOwnerId: 'user-a',
      createClient: (s) => {
        clients.push(s.userId);
        return { expectedUserId: s.userId, label: 'A' };
      },
      run: async (client) => {
        clients.push(`run:${client.expectedUserId}`);
        return 'ok';
      },
    });
    expect(outcome).toBe('stale');
    expect(clients).toEqual([]); // createClient never called when already stale
  });

  it('captureMutationSnapshot requires user and token', () => {
    expect(
      captureMutationSnapshot({ epoch: 1, activeUserId: 'u', accessToken: 't' })
    ).toEqual({ epoch: 1, userId: 'u', accessToken: 't' });
    expect(captureMutationSnapshot({ epoch: 1, activeUserId: null, accessToken: 't' })).toBeNull();
  });
});
