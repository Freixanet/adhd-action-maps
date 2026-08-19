import type { SavedSession, SourceType, MapIntent, ActionMapData } from './contracts';
export type { SourceType } from './contracts';
import type { Coleccion } from './collections';
import {
  deriveMapStatus,
  FALLBACK_MAP_CATEGORY,
  normalizeHistoryEntry,
  normalizeTags,
  resolveMapCategory,
  sanitizeUserCategory,
  type MapStatus,
} from './categories';

export type { MapStatus } from './categories';
import { getStorage } from './storage';
import {
  selectLatestHistoryEntryByTime,
  synthesizeTldrFromMap,
  tldrItemsEqual,
} from './tldr';
import { TLDR_MAX_COUNT } from './contracts';
import { clearPendingSourceSyncForUser } from './pendingSourceSync';
import { clearPendingPdfSourceSyncForUser } from './pendingPdfSourceSync';
import { clearPendingEvidenceSyncForUser } from './pendingEvidenceSync';
import { sessionWithSemanticProgress } from './progress/deriveProgress';
import { clearPendingProgressSyncForUser } from './pendingProgressSync';
import {
  createEmptyEnvelope,
  getActiveStore,
  parseOwnedHistoryEnvelope,
  removeHistoryOwner,
  replaceActiveStore,
  serializeOwnedHistoryEnvelope,
  transitionHistoryOwner,
  type HistoryOwner,
  type OwnedHistoryEnvelope,
  type OwnerTransitionResult,
} from './historyOwnership';

export type {
  HistoryOwner,
  OwnedHistoryEnvelope,
  OwnerTransitionResult,
  GuestAdoptionRecord,
} from './historyOwnership';
export {
  cloudMigrateEntriesForUser,
  createEmptyEnvelope,
  getActiveStore,
  ownersEqual,
  parseOwnedHistoryEnvelope,
  removeHistoryOwner,
  transitionHistoryOwner,
} from './historyOwnership';

export type HistoryEntry = {
  id: string;
  title: string;
  category?: string;
  tags?: string[];
  intent?: MapIntent;
  status?: MapStatus;
  pinned?: boolean;
  pinnedAt?: number;
  /** M-02: completion haptic + check animation runs once when false/missing. */
  completionCeremonyShown?: boolean;
  collectionId?: string;
  createdAt: number;
  updatedAt: number;
  sourceType: SourceType;
  session: SavedSession;
  /** S03 pasted-text cloud/source metadata (no full text). */
  sourceMeta?:
    | import('./pastedText').PastedTextSourceMeta
    | import('./pdf/types').PdfSourceMeta;
};

export type HistoryStore = {
  activeId: string | null;
  entries: HistoryEntry[];
  collections: Coleccion[];
};

const HISTORY_KEY = 'tdah-optimizer-history';
const LEGACY_SESSION_KEY = 'tdah-optimizer-session';
const MAX_ENTRIES = 30;
/** One-shot: rewrite «En 60 segundos» on the most recently touched entry. */
const TLDR_SIXTY_REWRITE_FLAG = 'tdah-tldr-sixty-rewrite-v1';

function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore and use fallback
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isValidSession(session: unknown): session is SavedSession {
  const s = session as SavedSession;
  const steps = (s?.data as { steps?: unknown } | undefined)?.steps;
  return Array.isArray(steps) && steps.length > 0;
}

function isValidEntry(entry: unknown): entry is HistoryEntry {
  const e = entry as HistoryEntry;
  return Boolean(
    e?.id &&
      e?.title &&
      typeof e.createdAt === 'number' &&
      typeof e.updatedAt === 'number' &&
      e.sourceType &&
      isValidSession(e.session)
  );
}

function migrateLegacySession(): HistoryStore | null {
  try {
    const storage = getStorage();
    const raw = storage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedSession;
    if (!isValidSession(parsed)) {
      storage.removeItem(LEGACY_SESSION_KEY);
      return null;
    }

    const now = Date.now();
    const title = (parsed.data as { title?: string } | undefined)?.title || 'Mapa sin título';
    const entry: HistoryEntry = {
      id: generateId(),
      title,
      createdAt: now,
      updatedAt: now,
      sourceType: 'text',
      session: parsed,
    };

    storage.removeItem(LEGACY_SESSION_KEY);
    return { activeId: entry.id, entries: [entry], collections: [] };
  } catch {
    try {
      getStorage().removeItem(LEGACY_SESSION_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

function trimEntries(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.slice(0, MAX_ENTRIES);
}

/** In-memory ownership envelope; kept in sync with HISTORY_KEY. */
let ownershipEnvelope: OwnedHistoryEnvelope | null = null;

function normalizeStore(store: HistoryStore): HistoryStore {
  return {
    activeId: resolveActiveId(store.activeId, store.entries.filter(isValidEntry).map(normalizeHistoryEntry)),
    entries: trimEntries(store.entries.filter(isValidEntry).map(normalizeHistoryEntry)),
    collections: Array.isArray(store.collections)
      ? store.collections.filter(
          (collection) =>
            collection?.id &&
            collection?.title &&
            Array.isArray(collection.nucleoIds) &&
            typeof collection.createdAt === 'number' &&
            typeof collection.updatedAt === 'number'
        )
      : [],
  };
}

function persistEnvelope(envelope: OwnedHistoryEnvelope): boolean {
  const active = normalizeStore(getActiveStore(envelope));
  const withActive = replaceActiveStore(envelope, active);
  ownershipEnvelope = withActive;
  try {
    getStorage().setItem(HISTORY_KEY, serializeOwnedHistoryEnvelope(withActive));
    return true;
  } catch {
    if (active.entries.length <= 1) return false;
    const reduced = {
      ...active,
      entries: active.entries.slice(0, Math.max(1, Math.floor(active.entries.length / 2))),
    };
    const reducedEnvelope = replaceActiveStore(withActive, reduced);
    ownershipEnvelope = reducedEnvelope;
    try {
      getStorage().setItem(HISTORY_KEY, serializeOwnedHistoryEnvelope(reducedEnvelope));
      return true;
    } catch {
      return false;
    }
  }
}

function persist(store: HistoryStore): boolean {
  const envelope = ownershipEnvelope ?? createEmptyEnvelope();
  return persistEnvelope(replaceActiveStore(envelope, store));
}

export function getHistoryOwnershipEnvelope(): OwnedHistoryEnvelope {
  if (!ownershipEnvelope) {
    ownershipEnvelope = loadOwnershipEnvelopeFromStorage();
  }
  return ownershipEnvelope;
}

function loadOwnershipEnvelopeFromStorage(): OwnedHistoryEnvelope {
  try {
    const raw = getStorage().getItem(HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const envelope = parseOwnedHistoryEnvelope(parsed);
      // Normalize partitions
      const guest = normalizeStore(envelope.guest);
      const byUserId: OwnedHistoryEnvelope['byUserId'] = {};
      for (const [userId, store] of Object.entries(envelope.byUserId)) {
        byUserId[userId] = normalizeStore(store);
      }
      return { ...envelope, guest, byUserId };
    }
  } catch {
    // fall through
  }
  return createEmptyEnvelope();
}

/**
 * Switch visible history partition (guest ↔ user).
 * Seals the previous user partition; never converts user maps into guest maps.
 */
export function activateHistoryOwner(owner: HistoryOwner): OwnerTransitionResult {
  const current = getHistoryOwnershipEnvelope();
  const result = transitionHistoryOwner(current, owner);
  persistEnvelope(result.envelope);
  return result;
}

/**
 * Purge a user's local history partition and related metadata from durable storage.
 * Guest and other users remain intact.
 */
export function removeHistoryOwnerFromStorage(userId: string): OwnedHistoryEnvelope {
  const current = getHistoryOwnershipEnvelope();
  const next = removeHistoryOwner(current, userId);
  persistEnvelope(next);
  try {
    getStorage().removeItem(`nucleo_pending_deletes:user:${userId.trim()}`);
  } catch {
    // ignore
  }
  clearPendingSourceSyncForUser(userId);
  void clearPendingPdfSourceSyncForUser(userId);
  clearPendingEvidenceSyncForUser(userId);
  clearPendingProgressSyncForUser(userId);
  return next;
}

function resolveActiveId(
  stored: string | null | undefined,
  entries: HistoryEntry[]
): string | null {
  if (stored === null) return null;
  if (stored && entries.some((entry) => entry.id === stored)) return stored;
  if (stored) return null;
  return entries[0]?.id ?? null;
}

/**
 * Rewrite only «En 60 segundos» on the entry with the latest created/updated
 * timestamp. Keeps id, title, cover, progress, source, steps, etc. intact.
 * Returns null when no rewrite is needed (and marks the one-shot flag).
 * When a store is returned, the caller must persist it and then call
 * markTldrSixtyRewriteDone().
 */
export function rewriteLatestEntryTldrSixtySeconds(store: HistoryStore): HistoryStore | null {
  let alreadyDone = false;
  try {
    alreadyDone = getStorage().getItem(TLDR_SIXTY_REWRITE_FLAG) === '1';
  } catch {
    return null;
  }

  const latest = selectLatestHistoryEntryByTime(store.entries);
  if (!latest?.session?.data) {
    markTldrSixtyRewriteDone();
    return null;
  }

  const data = latest.session.data as ActionMapData;
  const currentTldr = Array.isArray(data.tldr) ? data.tldr : [];
  const oversized = currentTldr.length > TLDR_MAX_COUNT;
  // Re-run if never migrated, or if something restored >4 items (e.g. cloud hydrate).
  if (alreadyDone && !oversized) return null;

  const nextTldr = synthesizeTldrFromMap(data);
  if (!nextTldr.length) {
    markTldrSixtyRewriteDone();
    return null;
  }

  if (!oversized && tldrItemsEqual(currentTldr, nextTldr)) {
    markTldrSixtyRewriteDone();
    return null;
  }

  const now = Date.now();
  return {
    ...store,
    entries: store.entries.map((entry) => {
      if (entry.id !== latest.id) return entry;
      return {
        ...entry,
        updatedAt: now,
        session: {
          ...entry.session,
          data: {
            ...entry.session.data,
            tldr: nextTldr,
          },
        },
      };
    }),
  };
}

export function markTldrSixtyRewriteDone(): void {
  try {
    getStorage().setItem(TLDR_SIXTY_REWRITE_FLAG, '1');
  } catch {
    // ignore
  }
}

export function loadHistory(): HistoryStore {
  ownershipEnvelope = loadOwnershipEnvelopeFromStorage();

  if (
    ownershipEnvelope.activeOwner.kind === 'guest' &&
    ownershipEnvelope.guest.entries.length === 0 &&
    Object.keys(ownershipEnvelope.byUserId).length === 0
  ) {
    const migrated = migrateLegacySession();
    if (migrated) {
      ownershipEnvelope = {
        ...createEmptyEnvelope(),
        guest: normalizeStore(migrated),
      };
      persistEnvelope(ownershipEnvelope);
      return getActiveStore(ownershipEnvelope);
    }
  }

  const active = getActiveStore(ownershipEnvelope);
  const rewritten = rewriteLatestEntryTldrSixtySeconds(active);
  if (rewritten) {
    if (persist(rewritten)) {
      markTldrSixtyRewriteDone();
    }
    return getActiveStore(ownershipEnvelope!);
  }
  return active;
}

export function saveHistory(store: HistoryStore): boolean {
  return persist(store);
}

export function clearAllHistory(): HistoryStore {
  ownershipEnvelope = createEmptyEnvelope();
  try {
    getStorage().removeItem(HISTORY_KEY);
    getStorage().removeItem(LEGACY_SESSION_KEY);
  } catch {
    // ignore storage errors during wipe
  }
  return { activeId: null, entries: [], collections: [] };
}

export function getActiveEntry(store: HistoryStore): HistoryEntry | null {
  if (!store.activeId) return null;
  return store.entries.find((e) => e.id === store.activeId) ?? null;
}

function metadataFromSession(
  session: SavedSession,
  sourceType: SourceType
): Pick<HistoryEntry, 'category' | 'tags' | 'intent' | 'status'> {
  const data = session.data as ActionMapData;
  const intent =
    data.intent === 'apply' || data.intent === 'study' ? data.intent : 'understand';
  const category = resolveMapCategory(data.category);
  const tags = normalizeTags(data.tags);
  const status = deriveMapStatus(session, intent);

  return { category, tags, intent, status };
}

export function createEntry(
  store: HistoryStore,
  session: SavedSession,
  sourceType: SourceType,
  providedId?: string,
  collectionId?: string,
  sourceMeta?:
    | import('./pastedText').PastedTextSourceMeta
    | import('./pdf/types').PdfSourceMeta
): HistoryStore {
  const now = Date.now();
  const resumableSession = sessionWithSemanticProgress(session, session.data, now);
  const title =
    (resumableSession.data as { title?: string } | undefined)?.title || 'Mapa sin título';
  const metadata = metadataFromSession(resumableSession, sourceType);
  const entry: HistoryEntry = {
    id: providedId || generateId(),
    title,
    createdAt: now,
    updatedAt: now,
    sourceType,
    session: resumableSession,
    ...(collectionId ? { collectionId } : {}),
    ...(sourceMeta ? { sourceMeta } : {}),
    ...metadata,
  };

  return {
    activeId: entry.id,
    entries: [entry, ...store.entries],
    collections: store.collections ?? [],
  };
}

export function updateEntrySourceMeta(
  store: HistoryStore,
  id: string,
  sourceMeta:
    | import('./pastedText').PastedTextSourceMeta
    | import('./pdf/types').PdfSourceMeta
): HistoryStore {
  return {
    ...store,
    entries: store.entries.map((entry) =>
      entry.id === id
        ? { ...entry, sourceMeta, updatedAt: Date.now() }
        : entry
    ),
  };
}

export function createCollection(
  store: HistoryStore,
  input: { id?: string; title: string; nucleoIds?: string[] }
): HistoryStore {
  const now = Date.now();
  const collection: Coleccion = {
    id: input.id || generateId(),
    title: input.title.trim() || 'Colección',
    nucleoIds: [...(input.nucleoIds ?? [])],
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...store,
    collections: [collection, ...(store.collections ?? [])],
  };
}

export function registerNucleoInCollection(
  store: HistoryStore,
  collectionId: string,
  nucleoId: string
): HistoryStore {
  const now = Date.now();
  const collections = (store.collections ?? []).map((collection) => {
    if (collection.id !== collectionId) return collection;
    if (collection.nucleoIds.includes(nucleoId)) {
      return { ...collection, updatedAt: now };
    }
    return {
      ...collection,
      nucleoIds: [...collection.nucleoIds, nucleoId],
      updatedAt: now,
    };
  });

  return { ...store, collections };
}

export function updateActiveSession(
  store: HistoryStore,
  session: SavedSession
): HistoryStore {
  if (!store.activeId) return store;

  const entries = store.entries.map((entry) => {
    if (entry.id !== store.activeId) return entry;

    const nextSavedAt = Date.now();
    const resumableSession = sessionWithSemanticProgress(
      session,
      session.data,
      nextSavedAt
    );
    const title = ((resumableSession.data as { title?: string } | undefined)?.title ||
      entry.title) as string;
    const metadata = metadataFromSession(resumableSession, entry.sourceType);
    const progressChanged =
      entry.session.currentStep !== resumableSession.currentStep ||
      entry.session.isComplete !== resumableSession.isComplete ||
      entry.session.viewAll !== resumableSession.viewAll ||
      entry.session.progress?.currentStepId !== resumableSession.progress?.currentStepId ||
      entry.session.progress?.state !== resumableSession.progress?.state;
    const titleChanged = title !== entry.title;
    const metadataChanged =
      entry.category !== metadata.category ||
      entry.status !== metadata.status ||
      entry.intent !== metadata.intent ||
      JSON.stringify(entry.tags ?? []) !== JSON.stringify(metadata.tags ?? []);

    if (!progressChanged && !titleChanged && !metadataChanged) {
      if (entry.session.data === resumableSession.data) return entry;
      return { ...entry, title, session: resumableSession, ...metadata };
    }

    const now = Date.now();
    return {
      ...entry,
      title,
      updatedAt: now,
      session: resumableSession,
      ...metadata,
    };
  });

  return { ...store, entries };
}

export function setActiveId(store: HistoryStore, id: string | null): HistoryStore {
  if (id && !store.entries.some((e) => e.id === id)) {
    return store;
  }
  return { ...store, activeId: id };
}

export function deleteEntry(store: HistoryStore, id: string): HistoryStore {
  const entries = store.entries.filter((e) => e.id !== id);
  const activeId = store.activeId === id ? null : store.activeId;
  const collections = (store.collections ?? []).map((collection) => ({
    ...collection,
    nucleoIds: collection.nucleoIds.filter((nucleoId) => nucleoId !== id),
  }));

  return { activeId, entries, collections };
}

export function renameEntry(store: HistoryStore, id: string, title: string): HistoryStore {
  const trimmed = title.trim();
  if (!trimmed) return store;

  const now = Date.now();
  const entries = store.entries.map((entry) => {
    if (entry.id !== id) return entry;

    return {
      ...entry,
      title: trimmed,
      updatedAt: now,
      session: {
        ...entry.session,
        data: {
          ...entry.session.data,
          title: trimmed,
        },
      },
    };
  });

  return { ...store, entries };
}

export function updateEntryCategory(
  store: HistoryStore,
  id: string,
  category: string
): HistoryStore {
  const trimmed = sanitizeUserCategory(category);
  if (!trimmed) return store;

  const now = Date.now();
  const entries = store.entries.map((entry) => {
    if (entry.id !== id) return entry;

    return {
      ...entry,
      category: trimmed,
      updatedAt: now,
      session: {
        ...entry.session,
        data: {
          ...entry.session.data,
          category: trimmed,
        },
      },
    };
  });

  return { ...store, entries };
}

export function markCompletionCeremonyShown(store: HistoryStore, id: string): HistoryStore {
  const entries = store.entries.map((entry) => {
    if (entry.id !== id) return entry;
    if (entry.completionCeremonyShown) return entry;
    return { ...entry, completionCeremonyShown: true };
  });

  return { ...store, entries };
}

export function togglePinEntry(store: HistoryStore, id: string): HistoryStore {
  const now = Date.now();
  const entries = store.entries.map((entry) => {
    if (entry.id !== id) return entry;

    if (entry.pinned) {
      const { pinned: _pinned, pinnedAt: _pinnedAt, ...rest } = entry;
      return rest;
    }

    return { ...entry, pinned: true, pinnedAt: now };
  });

  return { ...store, entries };
}

export function formatRelativeDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

export function sortPinnedEntries(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort(
    (a, b) => (b.pinnedAt ?? b.updatedAt) - (a.pinnedAt ?? a.updatedAt)
  );
}
