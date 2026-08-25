import { describe, expect, it } from 'vitest';
import type { HistoryEntry, HistoryStore } from './history';
import {
  createHydrationEpochController,
  flushPendingDeletesBound,
  hydrateCloudHistoryForSession,
  type BoundMapsClient,
  type CloudHistoryHydrationHooks,
} from './cloudHistoryHydration';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function entry(id: string): HistoryEntry {
  return {
    id,
    title: id,
    createdAt: 1,
    updatedAt: 2,
    sourceType: 'text',
    session: {
      data: { title: id, steps: [{ id: 's1', title: 'Paso' }] },
      currentStep: 0,
      isComplete: false,
      viewAll: false,
    } as HistoryEntry['session'],
  };
}

function emptyStore(): HistoryStore {
  return { activeId: null, entries: [], collections: [] };
}

describe('cloudHistoryHydration concurrency', () => {
  it('A pull suspended then B active: A result never merges into B', async () => {
    const epochCtrl = createHydrationEpochController();
    const commits: Array<{ userId: string | null; ids: string[] }> = [];
    const errors: string[] = [];
    const pullA = deferred<HistoryEntry[]>();

    let committed: HistoryStore = emptyStore();
    const pendingByUser: Record<string, string[]> = { A: [], B: [] };

    const makeHooks = (label: 'A' | 'B'): CloudHistoryHydrationHooks => ({
      isCurrent: (epoch, userId) => epochCtrl.isCurrent(epoch, userId),
      sealToGuest: () => emptyStore(),
      activateUser: (userId) => ({
        store: { activeId: null, entries: [entry(`local-${label}`)], collections: [] },
        migrateEntries: [entry(`local-${label}`)],
      }),
      createBoundClient: (userId) => {
        const client: BoundMapsClient = {
          label,
          expectedUserId: userId,
          migrate: async () => undefined,
          pull: async () => {
            if (label === 'A') return pullA.promise;
            return [entry('remote-B')];
          },
          deleteEntry: async () => undefined,
        };
        return client;
      },
      loadPendingDeletes: (userId) => pendingByUser[userId === 'user-a' ? 'A' : 'B'] ?? [],
      savePendingDeletes: (userId, ids) => {
        pendingByUser[userId === 'user-a' ? 'A' : 'B'] = ids;
      },
      mergeHistory: (local, remote) => [...remote, ...local],
      commitStore: (store) => {
        committed = store;
        commits.push({
          userId: epochCtrl.activeUserId,
          ids: store.entries.map((e) => e.id),
        });
      },
      getCommittedStore: () => committed,
      setSyncError: (message) => errors.push(message),
      clearPendingDeletesMemory: () => undefined,
      setPendingDeletesMemory: () => undefined,
    });

    const epochA = epochCtrl.begin('user-a');
    const runA = hydrateCloudHistoryForSession({
      epoch: epochA,
      userId: 'user-a',
      accessToken: 'token-a',
      hooks: makeHooks('A'),
    });

    // B becomes active while A is suspended on pull.
    const epochB = epochCtrl.begin('user-b');
    const runB = hydrateCloudHistoryForSession({
      epoch: epochB,
      userId: 'user-b',
      accessToken: 'token-b',
      hooks: makeHooks('B'),
    });

    await runB;
    pullA.resolve([entry('remote-A')]);
    const outcomeA = await runA;

    expect(outcomeA).toBe('stale');
    expect(committed.entries.map((e) => e.id)).toContain('remote-B');
    expect(committed.entries.map((e) => e.id)).not.toContain('remote-A');
    expect(errors).toEqual([]);
  });

  it('A migrate suspended; switch to B: migrate never hits B-bound client', async () => {
    const epochCtrl = createHydrationEpochController();
    const migrateTargets: string[] = [];
    const migrateA = deferred<void>();

    const makeClient = (label: string, userId: string): BoundMapsClient => ({
      label,
      expectedUserId: userId,
      migrate: async (entries) => {
        migrateTargets.push(`${label}:${entries.map((e) => e.id).join(',')}`);
        if (label === 'A') await migrateA.promise;
      },
      pull: async () => [],
      deleteEntry: async () => undefined,
    });

    let committed = emptyStore();
    const hooksFor = (label: 'A' | 'B', userId: string): CloudHistoryHydrationHooks => ({
      isCurrent: (epoch, uid) => epochCtrl.isCurrent(epoch, uid),
      sealToGuest: () => emptyStore(),
      activateUser: () => ({
        store: { activeId: 'x', entries: [entry(`mig-${label}`)], collections: [] },
        migrateEntries: [entry(`mig-${label}`)],
      }),
      createBoundClient: (uid, _token) => makeClient(label, uid),
      loadPendingDeletes: () => [],
      savePendingDeletes: () => undefined,
      mergeHistory: (local, remote) => [...local, ...remote],
      commitStore: (store) => {
        committed = store;
      },
      getCommittedStore: () => committed,
      setSyncError: () => undefined,
      clearPendingDeletesMemory: () => undefined,
      setPendingDeletesMemory: () => undefined,
    });

    const epochA = epochCtrl.begin('user-a');
    const runA = hydrateCloudHistoryForSession({
      epoch: epochA,
      userId: 'user-a',
      accessToken: 'token-a',
      hooks: hooksFor('A', 'user-a'),
    });

    // Let A reach migrate suspension
    await Promise.resolve();
    const epochB = epochCtrl.begin('user-b');
    const runB = hydrateCloudHistoryForSession({
      epoch: epochB,
      userId: 'user-b',
      accessToken: 'token-b',
      hooks: hooksFor('B', 'user-b'),
    });
    await runB;
    migrateA.resolve();
    const outcomeA = await runA;

    expect(outcomeA).toBe('stale');
    expect(migrateTargets.some((t) => t.startsWith('B:mig-A'))).toBe(false);
    expect(migrateTargets).toContain('A:mig-A');
    expect(migrateTargets).toContain('B:mig-B');
  });

  it('pending delete for A finishing after B does not rewrite B queue', async () => {
    const epochCtrl = createHydrationEpochController();
    const deleteA = deferred<void>();
    const saved: Record<string, string[]> = { 'user-a': ['map-a'], 'user-b': ['map-b'] };
    let memory: string[] = [];

    const clientA: BoundMapsClient = {
      label: 'A',
      expectedUserId: 'user-a',
      migrate: async () => undefined,
      pull: async () => [],
      deleteEntry: async () => deleteA.promise,
    };

    const hooks: CloudHistoryHydrationHooks = {
      isCurrent: (epoch, uid) => epochCtrl.isCurrent(epoch, uid),
      sealToGuest: () => emptyStore(),
      activateUser: () => ({ store: emptyStore(), migrateEntries: [] }),
      createBoundClient: () => clientA,
      loadPendingDeletes: (userId) => saved[userId] ?? [],
      savePendingDeletes: (userId, ids) => {
        saved[userId] = ids;
      },
      mergeHistory: (a, b) => [...a, ...b],
      commitStore: () => undefined,
      getCommittedStore: () => emptyStore(),
      setSyncError: () => undefined,
      clearPendingDeletesMemory: () => {
        memory = [];
      },
      setPendingDeletesMemory: (ids) => {
        memory = ids;
      },
    };

    const epochA = epochCtrl.begin('user-a');
    const flushA = flushPendingDeletesBound({
      epoch: epochA,
      userId: 'user-a',
      client: clientA,
      hooks,
    });

    epochCtrl.begin('user-b');
    memory = ['map-b'];
    deleteA.resolve();
    const result = await flushA;

    expect(result).toBe('stale');
    expect(saved['user-b']).toEqual(['map-b']);
    expect(saved['user-a']).toEqual(['map-a']);
    expect(memory).toEqual(['map-b']);
  });

  it('two consecutive A events do not duplicate adoption maps in commits', async () => {
    const epochCtrl = createHydrationEpochController();
    let adoptCount = 0;
    const commitIds: string[][] = [];
    let committed: HistoryStore = emptyStore();

    const hooks: CloudHistoryHydrationHooks = {
      isCurrent: (epoch, uid) => epochCtrl.isCurrent(epoch, uid),
      sealToGuest: () => emptyStore(),
      activateUser: () => {
        adoptCount += 1;
        return {
          store: { activeId: 'g1', entries: [entry('g1')], collections: [] },
          migrateEntries: [entry('g1')],
        };
      },
      createBoundClient: (userId) => ({
        expectedUserId: userId,
        migrate: async () => undefined,
        pull: async () => [entry('g1')],
        deleteEntry: async () => undefined,
      }),
      loadPendingDeletes: () => [],
      savePendingDeletes: () => undefined,
      mergeHistory: (local, remote) => {
        const map = new Map<string, HistoryEntry>();
        for (const e of [...remote, ...local]) map.set(e.id, e);
        return Array.from(map.values());
      },
      commitStore: (store) => {
        committed = store;
        commitIds.push(store.entries.map((e) => e.id));
      },
      getCommittedStore: () => committed,
      setSyncError: () => undefined,
      clearPendingDeletesMemory: () => undefined,
      setPendingDeletesMemory: () => undefined,
    };

    const e1 = epochCtrl.begin('user-a');
    const p1 = hydrateCloudHistoryForSession({
      epoch: e1,
      userId: 'user-a',
      accessToken: 't',
      hooks,
    });
    const e2 = epochCtrl.begin('user-a');
    const p2 = hydrateCloudHistoryForSession({
      epoch: e2,
      userId: 'user-a',
      accessToken: 't',
      hooks,
    });
    const [o1, o2] = await Promise.all([p1, p2]);
    expect([o1, o2].sort()).toEqual(['applied', 'stale'].sort());
    expect(committed.entries.filter((e) => e.id === 'g1')).toHaveLength(1);
    expect(adoptCount).toBe(2); // both may activate; upsert/merge stays unique
  });

  it('stale error from A does not set error on B session', async () => {
    const epochCtrl = createHydrationEpochController();
    const pullA = deferred<HistoryEntry[]>();
    const enteredPull = deferred<void>();
    const errors: Array<{ userId: string | null; message: string }> = [];
    let committed = emptyStore();

    const hooksFor = (label: 'A' | 'B'): CloudHistoryHydrationHooks => ({
      isCurrent: (epoch, uid) => epochCtrl.isCurrent(epoch, uid),
      sealToGuest: () => emptyStore(),
      activateUser: () => ({
        store: { activeId: null, entries: [entry(label)], collections: [] },
        migrateEntries: [],
      }),
      createBoundClient: (userId) => ({
        label,
        expectedUserId: userId,
        migrate: async () => undefined,
        pull: async () => {
          if (label === 'A') {
            enteredPull.resolve();
            await pullA.promise;
            throw new Error('network A');
          }
          return [];
        },
        deleteEntry: async () => undefined,
      }),
      loadPendingDeletes: () => [],
      savePendingDeletes: () => undefined,
      mergeHistory: (a, b) => [...a, ...b],
      commitStore: (store) => {
        committed = store;
      },
      getCommittedStore: () => committed,
      setSyncError: (message) => {
        errors.push({ userId: epochCtrl.activeUserId, message });
      },
      clearPendingDeletesMemory: () => undefined,
      setPendingDeletesMemory: () => undefined,
    });

    const epochA = epochCtrl.begin('user-a');
    const runA = hydrateCloudHistoryForSession({
      epoch: epochA,
      userId: 'user-a',
      accessToken: 'a',
      hooks: hooksFor('A'),
    });
    await enteredPull.promise;
    const epochB = epochCtrl.begin('user-b');
    await hydrateCloudHistoryForSession({
      epoch: epochB,
      userId: 'user-b',
      accessToken: 'b',
      hooks: hooksFor('B'),
    });
    pullA.resolve([]);
    const outcomeA = await runA;
    expect(outcomeA === 'error-stale' || outcomeA === 'stale').toBe(true);
    expect(errors).toEqual([]);
  });

  it('Strict Mode / duplicate INITIAL_SESSION for same user stays safe', async () => {
    const epochCtrl = createHydrationEpochController();
    let migrateCalls = 0;
    let committed = emptyStore();
    const hooks: CloudHistoryHydrationHooks = {
      isCurrent: (epoch, uid) => epochCtrl.isCurrent(epoch, uid),
      sealToGuest: () => emptyStore(),
      activateUser: () => ({
        store: { activeId: '1', entries: [entry('1')], collections: [] },
        migrateEntries: [entry('1')],
      }),
      createBoundClient: (userId) => ({
        expectedUserId: userId,
        migrate: async () => {
          migrateCalls += 1;
        },
        pull: async () => [entry('1')],
        deleteEntry: async () => undefined,
      }),
      loadPendingDeletes: () => [],
      savePendingDeletes: () => undefined,
      mergeHistory: (local, remote) => {
        const map = new Map<string, HistoryEntry>();
        for (const e of [...local, ...remote]) map.set(e.id, e);
        return Array.from(map.values());
      },
      commitStore: (store) => {
        committed = store;
      },
      getCommittedStore: () => committed,
      setSyncError: () => undefined,
      clearPendingDeletesMemory: () => undefined,
      setPendingDeletesMemory: () => undefined,
    };

    const e1 = epochCtrl.begin('user-a');
    const e2 = epochCtrl.begin('user-a');
    await Promise.all([
      hydrateCloudHistoryForSession({
        epoch: e1,
        userId: 'user-a',
        accessToken: 't',
        hooks,
      }),
      hydrateCloudHistoryForSession({
        epoch: e2,
        userId: 'user-a',
        accessToken: 't',
        hooks,
      }),
    ]);
    expect(committed.entries).toHaveLength(1);
    expect(migrateCalls).toBeLessThanOrEqual(2);
  });

  it('pull A suspended → sign-out: A never reappears', async () => {
    const epochCtrl = createHydrationEpochController();
    const pullA = deferred<HistoryEntry[]>();
    const enteredPull = deferred<void>();
    let committed = emptyStore();
    const hooks: CloudHistoryHydrationHooks = {
      isCurrent: (epoch, uid) => epochCtrl.isCurrent(epoch, uid),
      sealToGuest: () => emptyStore(),
      activateUser: () => ({
        store: { activeId: null, entries: [entry('local-A')], collections: [] },
        migrateEntries: [],
      }),
      createBoundClient: (userId) => ({
        expectedUserId: userId,
        migrate: async () => undefined,
        pull: async () => {
          enteredPull.resolve();
          return pullA.promise;
        },
        deleteEntry: async () => undefined,
      }),
      loadPendingDeletes: () => [],
      savePendingDeletes: () => undefined,
      mergeHistory: (local, remote) => [...remote, ...local],
      commitStore: (store) => {
        committed = store;
      },
      getCommittedStore: () => committed,
      setSyncError: () => undefined,
      clearPendingDeletesMemory: () => undefined,
      setPendingDeletesMemory: () => undefined,
    };

    const epochA = epochCtrl.begin('user-a');
    const runA = hydrateCloudHistoryForSession({
      epoch: epochA,
      userId: 'user-a',
      accessToken: 'a',
      hooks,
    });
    await enteredPull.promise;
    epochCtrl.begin(null);
    committed = emptyStore();
    pullA.resolve([entry('remote-A')]);
    const outcome = await runA;
    expect(outcome).toBe('stale');
    expect(committed.entries.map((e) => e.id)).not.toContain('remote-A');
  });
});
