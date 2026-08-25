/**
 * Cloud history hydration with immutable per-run identity.
 *
 * Each run captures userId + accessToken + epoch. Network ops use only the
 * bound client for that run. After every await, stale runs exit without UI,
 * partition, pending-delete, or error side effects.
 */

import type { HistoryEntry, HistoryStore } from './history';

export type BoundMapsClient = {
  /** Test label (e.g. "A" / "B"); unused in production. */
  label?: string;
  expectedUserId: string;
  migrate: (entries: HistoryEntry[]) => Promise<void>;
  pull: () => Promise<HistoryEntry[]>;
  deleteEntry: (id: string) => Promise<void>;
};

export type CloudHistoryHydrationHooks = {
  /** True only while this run's epoch and userId are still the active hydration. */
  isCurrent: (epoch: number, userId: string | null) => boolean;
  /** Seal authenticated partition and show guest (sync). */
  sealToGuest: () => HistoryStore;
  /**
   * Activate user partition (guest batch adoption happens here).
   * Must be synchronous — no network.
   */
  activateUser: (userId: string) => {
    store: HistoryStore;
    migrateEntries: HistoryEntry[];
  };
  createBoundClient: (userId: string, accessToken: string) => BoundMapsClient;
  loadPendingDeletes: (userId: string) => string[];
  savePendingDeletes: (userId: string, ids: string[]) => void;
  mergeHistory: (local: HistoryEntry[], remote: HistoryEntry[]) => HistoryEntry[];
  /** Apply store only when still current (caller enforces). */
  commitStore: (store: HistoryStore) => void;
  getCommittedStore: () => HistoryStore;
  setSyncError: (message: string) => void;
  clearPendingDeletesMemory: () => void;
  setPendingDeletesMemory: (ids: string[]) => void;
};

export type HydrationOutcome = 'applied' | 'stale' | 'skipped' | 'error-stale' | 'error-applied';

function stillCurrent(
  hooks: CloudHistoryHydrationHooks,
  epoch: number,
  userId: string | null
): boolean {
  return hooks.isCurrent(epoch, userId);
}

/**
 * Flush pending deletes using a session-bound client.
 * Stale mid-flight: does not write another user's pending queue.
 */
export async function flushPendingDeletesBound(args: {
  epoch: number;
  userId: string;
  client: BoundMapsClient;
  hooks: CloudHistoryHydrationHooks;
}): Promise<'done' | 'stale'> {
  const { epoch, userId, client, hooks } = args;
  if (client.expectedUserId !== userId) {
    throw new Error('Bound client userId mismatch');
  }
  if (!stillCurrent(hooks, epoch, userId)) return 'stale';

  const ids = hooks.loadPendingDeletes(userId);
  if (ids.length === 0) {
    if (!stillCurrent(hooks, epoch, userId)) return 'stale';
    hooks.setPendingDeletesMemory([]);
    return 'done';
  }

  const remaining = [...ids];
  for (const id of ids) {
    if (!stillCurrent(hooks, epoch, userId)) return 'stale';
    try {
      await client.deleteEntry(id);
      if (!stillCurrent(hooks, epoch, userId)) return 'stale';
      const index = remaining.indexOf(id);
      if (index >= 0) remaining.splice(index, 1);
    } catch {
      break;
    }
  }

  if (!stillCurrent(hooks, epoch, userId)) return 'stale';
  hooks.savePendingDeletes(userId, remaining);
  hooks.setPendingDeletesMemory(remaining);
  return 'done';
}

/**
 * Full hydration for one captured auth snapshot.
 * Pass accessToken+userId from the Session at the start of the run — never re-read the global singleton after awaits.
 */
export async function hydrateCloudHistoryForSession(args: {
  epoch: number;
  userId: string | null;
  accessToken: string | null;
  hooks: CloudHistoryHydrationHooks;
  /** DEV hide-history etc. */
  skipCloudSync?: boolean;
}): Promise<HydrationOutcome> {
  const { epoch, userId, accessToken, hooks, skipCloudSync } = args;

  if (!stillCurrent(hooks, epoch, userId)) return 'stale';

  if (!userId) {
    const guest = hooks.sealToGuest();
    if (!stillCurrent(hooks, epoch, null)) return 'stale';
    hooks.commitStore(guest);
    hooks.clearPendingDeletesMemory();
    return 'applied';
  }

  if (skipCloudSync) return 'skipped';
  if (!accessToken) {
    // Signed-in identity without token cannot safely talk to the API as that user.
    return 'skipped';
  }

  let migrateEntries: HistoryEntry[] = [];
  try {
    const activated = hooks.activateUser(userId);
    if (!stillCurrent(hooks, epoch, userId)) return 'stale';
    hooks.commitStore(activated.store);
    migrateEntries = activated.migrateEntries;

    const client = hooks.createBoundClient(userId, accessToken);
    if (client.expectedUserId !== userId) {
      throw new Error('createBoundClient returned mismatched expectedUserId');
    }

    const flushResult = await flushPendingDeletesBound({ epoch, userId, client, hooks });
    if (flushResult === 'stale' || !stillCurrent(hooks, epoch, userId)) return 'stale';

    await client.migrate(migrateEntries);
    if (!stillCurrent(hooks, epoch, userId)) return 'stale';

    const remote = await client.pull();
    if (!stillCurrent(hooks, epoch, userId)) return 'stale';

    const pending = hooks.loadPendingDeletes(userId);
    if (!stillCurrent(hooks, epoch, userId)) return 'stale';

    const remoteFiltered = remote.filter((entry) => !pending.includes(entry.id));
    const current = hooks.getCommittedStore();
    if (!stillCurrent(hooks, epoch, userId)) return 'stale';
    const mergedEntries = hooks.mergeHistory(current.entries, remoteFiltered);
    if (!stillCurrent(hooks, epoch, userId)) return 'stale';

    hooks.commitStore({
      ...current,
      entries: mergedEntries,
    });
    return 'applied';
  } catch {
    if (!stillCurrent(hooks, epoch, userId)) return 'error-stale';
    hooks.setSyncError(
      'No se pudo sincronizar el historial. Tus Núcleos locales siguen disponibles.'
    );
    return 'error-applied';
  }
}

/** Epoch helper for hosts (AppSession / tests). */
export function createHydrationEpochController() {
  let epoch = 0;
  let activeUserId: string | null = null;

  return {
    begin(userId: string | null): number {
      epoch += 1;
      activeUserId = userId;
      return epoch;
    },
    isCurrent(candidateEpoch: number, userId: string | null): boolean {
      return candidateEpoch === epoch && activeUserId === userId;
    },
    get epoch() {
      return epoch;
    },
    get activeUserId() {
      return activeUserId;
    },
  };
}
