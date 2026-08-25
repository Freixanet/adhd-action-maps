/**
 * Local history ownership / provenance.
 *
 * Guest works without an account. Authenticated partitions are keyed by
 * Supabase `user.id`. User data is never reclassified as guest on session loss.
 *
 * Legacy (pre-envelope) stores migrate to guest only when no prior bound user
 * was recorded — never auto-attributed to a different account (ADR-009).
 */

import type { HistoryStore } from './history';

export const HISTORY_OWNERSHIP_VERSION = 1 as const;

export type HistoryOwner =
  | { kind: 'guest' }
  | { kind: 'user'; userId: string };

export type GuestAdoptionRecord = {
  adoptedIntoUserId: string;
  at: number;
  /** Entry ids moved in that batch (audit only). */
  entryIds?: string[];
};

export type OwnedHistoryEnvelope = {
  version: typeof HISTORY_OWNERSHIP_VERSION;
  activeOwner: HistoryOwner;
  guest: HistoryStore;
  byUserId: Record<string, HistoryStore>;
  /** Last authenticated user on this device (survives sign-out). */
  lastBoundUserId: string | null;
  /**
   * Last guest→user batch adoption (audit). Does NOT block future guest batches.
   * Each guest entry is moved at most once when its batch is adopted; new guest
   * content created after sign-out can be adopted on the next login (ADR-009).
   */
  guestAdoption: GuestAdoptionRecord | null;
};

export type OwnerTransitionResult = {
  envelope: OwnedHistoryEnvelope;
  /** Entries that may be upserted to the current user's cloud maps. */
  cloudMigrateEntries: import('./history').HistoryEntry[];
  /** True when guest entries were merged into the user partition this call. */
  adoptedGuest: boolean;
};

function emptyStore(): HistoryStore {
  return { activeId: null, entries: [], collections: [] };
}

function cloneStore(store: HistoryStore): HistoryStore {
  return {
    activeId: store.activeId,
    entries: [...store.entries],
    collections: [...(store.collections ?? [])],
  };
}

function isStoreShape(value: unknown): value is HistoryStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const store = value as HistoryStore;
  return Array.isArray(store.entries);
}

function isOwner(value: unknown): value is HistoryOwner {
  if (!value || typeof value !== 'object') return false;
  const owner = value as HistoryOwner;
  if (owner.kind === 'guest') return true;
  return (
    owner.kind === 'user' &&
    typeof owner.userId === 'string' &&
    owner.userId.trim().length > 0
  );
}

export function createEmptyEnvelope(): OwnedHistoryEnvelope {
  return {
    version: HISTORY_OWNERSHIP_VERSION,
    activeOwner: { kind: 'guest' },
    guest: emptyStore(),
    byUserId: {},
    lastBoundUserId: null,
    guestAdoption: null,
  };
}

export function getActiveStore(envelope: OwnedHistoryEnvelope): HistoryStore {
  if (envelope.activeOwner.kind === 'guest') {
    return cloneStore(envelope.guest);
  }
  const userId = envelope.activeOwner.userId;
  return cloneStore(envelope.byUserId[userId] ?? emptyStore());
}

export function replaceActiveStore(
  envelope: OwnedHistoryEnvelope,
  store: HistoryStore
): OwnedHistoryEnvelope {
  const next = cloneStore(store);
  if (envelope.activeOwner.kind === 'guest') {
    return { ...envelope, guest: next };
  }
  const userId = envelope.activeOwner.userId;
  return {
    ...envelope,
    byUserId: {
      ...envelope.byUserId,
      [userId]: next,
    },
  };
}

function mergeStores(primary: HistoryStore, incoming: HistoryStore): HistoryStore {
  const byId = new Map<string, HistoryStore['entries'][number]>();
  for (const entry of incoming.entries) byId.set(entry.id, entry);
  for (const entry of primary.entries) byId.set(entry.id, entry);
  const entries = Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  const collectionsById = new Map<string, HistoryStore['collections'][number]>();
  for (const collection of [...(incoming.collections ?? []), ...(primary.collections ?? [])]) {
    collectionsById.set(collection.id, collection);
  }
  const activeId =
    (primary.activeId && entries.some((e) => e.id === primary.activeId) && primary.activeId) ||
    (incoming.activeId && entries.some((e) => e.id === incoming.activeId) && incoming.activeId) ||
    entries[0]?.id ||
    null;
  return {
    activeId,
    entries,
    collections: Array.from(collectionsById.values()),
  };
}

/**
 * Parse storage JSON into an envelope.
 * Legacy HistoryStore → guest (safe). Never invents a user binding.
 */
export function parseOwnedHistoryEnvelope(raw: unknown): OwnedHistoryEnvelope {
  if (!raw || typeof raw !== 'object') return createEmptyEnvelope();

  const record = raw as Record<string, unknown>;
  if (record.version === HISTORY_OWNERSHIP_VERSION && isOwner(record.activeOwner)) {
    const byUserId: Record<string, HistoryStore> = {};
    if (record.byUserId && typeof record.byUserId === 'object' && !Array.isArray(record.byUserId)) {
      for (const [userId, store] of Object.entries(record.byUserId as Record<string, unknown>)) {
        if (typeof userId === 'string' && userId && isStoreShape(store)) {
          byUserId[userId] = {
            activeId: store.activeId ?? null,
            entries: Array.isArray(store.entries) ? store.entries : [],
            collections: Array.isArray(store.collections) ? store.collections : [],
          };
        }
      }
    }
    const guest = isStoreShape(record.guest) ? cloneStore(record.guest) : emptyStore();
    const guestAdoption =
      record.guestAdoption &&
      typeof record.guestAdoption === 'object' &&
      typeof (record.guestAdoption as GuestAdoptionRecord).adoptedIntoUserId === 'string'
        ? {
            adoptedIntoUserId: String(
              (record.guestAdoption as GuestAdoptionRecord).adoptedIntoUserId
            ),
            at: Number((record.guestAdoption as GuestAdoptionRecord).at) || 0,
          }
        : null;
    return {
      version: HISTORY_OWNERSHIP_VERSION,
      activeOwner: record.activeOwner,
      guest,
      byUserId,
      lastBoundUserId:
        typeof record.lastBoundUserId === 'string' && record.lastBoundUserId.trim()
          ? record.lastBoundUserId.trim()
          : null,
      guestAdoption,
    };
  }

  // Legacy flat HistoryStore → guest only.
  if (isStoreShape(raw)) {
    const envelope = createEmptyEnvelope();
    envelope.guest = {
      activeId: raw.activeId ?? null,
      entries: Array.isArray(raw.entries) ? raw.entries : [],
      collections: Array.isArray(raw.collections) ? raw.collections : [],
    };
    return envelope;
  }

  return createEmptyEnvelope();
}

/**
 * Activate an owner partition.
 * - guest → user A: move the current guest batch into A (if non-empty), then empty guest.
 * - Later guest batches (after sign-out) can be adopted on a subsequent login.
 * - user A → user A: keep A; adopt any new guest batch present.
 * - user A → user B: seal A; never upload/merge A's bound content into B; B may adopt a fresh guest batch only.
 * - user → guest (sign-out / session loss): seal user; show guest; never convert user→guest.
 */
export function transitionHistoryOwner(
  envelope: OwnedHistoryEnvelope,
  nextOwner: HistoryOwner,
  options?: { now?: number }
): OwnerTransitionResult {
  const now = options?.now ?? Date.now();
  let next: OwnedHistoryEnvelope = {
    ...envelope,
    guest: cloneStore(envelope.guest),
    byUserId: { ...envelope.byUserId },
  };

  let adoptedGuest = false;

  if (nextOwner.kind === 'guest') {
    next = {
      ...next,
      activeOwner: { kind: 'guest' },
    };
    return {
      envelope: next,
      cloudMigrateEntries: [],
      adoptedGuest: false,
    };
  }

  const userId = nextOwner.userId.trim();
  if (!userId) {
    return {
      envelope: { ...next, activeOwner: { kind: 'guest' } },
      cloudMigrateEntries: [],
      adoptedGuest: false,
    };
  }

  let userStore = cloneStore(next.byUserId[userId] ?? emptyStore());

  const guestBatchNonEmpty =
    next.guest.entries.length > 0 || (next.guest.collections?.length ?? 0) > 0;

  if (guestBatchNonEmpty) {
    const adoptedIds = next.guest.entries.map((entry) => entry.id);
    userStore = mergeStores(userStore, next.guest);
    next = {
      ...next,
      guest: emptyStore(),
      guestAdoption: { adoptedIntoUserId: userId, at: now, entryIds: adoptedIds },
    };
    adoptedGuest = true;
  }

  next = {
    ...next,
    activeOwner: { kind: 'user', userId },
    lastBoundUserId: userId,
    byUserId: {
      ...next.byUserId,
      [userId]: userStore,
    },
  };

  return {
    envelope: next,
    cloudMigrateEntries: [...userStore.entries],
    adoptedGuest,
  };
}

/** Entries safe to upsert for the given user (active user partition only). */
export function cloudMigrateEntriesForUser(
  envelope: OwnedHistoryEnvelope,
  userId: string
): import('./history').HistoryEntry[] {
  if (!userId) return [];
  const store = envelope.byUserId[userId];
  return store ? [...store.entries] : [];
}

export function serializeOwnedHistoryEnvelope(envelope: OwnedHistoryEnvelope): string {
  return JSON.stringify(envelope);
}

export function ownersEqual(a: HistoryOwner, b: HistoryOwner): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'guest') return true;
  return a.userId === (b as { kind: 'user'; userId: string }).userId;
}

/**
 * Fully remove a user's local partition and identity metadata.
 * Does not touch guest or other users' partitions.
 */
export function removeHistoryOwner(
  envelope: OwnedHistoryEnvelope,
  userId: string
): OwnedHistoryEnvelope {
  const id = userId.trim();
  if (!id) return envelope;

  const byUserId = { ...envelope.byUserId };
  delete byUserId[id];

  const guestAdoption =
    envelope.guestAdoption?.adoptedIntoUserId === id ? null : envelope.guestAdoption;

  const lastBoundUserId = envelope.lastBoundUserId === id ? null : envelope.lastBoundUserId;

  const activeOwner =
    envelope.activeOwner.kind === 'user' && envelope.activeOwner.userId === id
      ? ({ kind: 'guest' } as const)
      : envelope.activeOwner;

  return {
    ...envelope,
    activeOwner,
    byUserId,
    lastBoundUserId,
    guestAdoption,
  };
}
