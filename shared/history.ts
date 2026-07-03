import type { SavedSession, SourceType, MapIntent, ActionMapData } from './contracts';
export type { SourceType } from './contracts';
import {
  deriveMapStatus,
  FALLBACK_MAP_CATEGORY,
  normalizeHistoryEntry,
  normalizeTags,
  sanitizeUserCategory,
  type MapStatus,
} from './categories';

export type { MapStatus } from './categories';
import { getStorage } from './storage';

export type HistoryEntry = {
  id: string;
  title: string;
  category?: string;
  tags?: string[];
  intent?: MapIntent;
  status?: MapStatus;
  pinned?: boolean;
  pinnedAt?: number;
  createdAt: number;
  updatedAt: number;
  sourceType: SourceType;
  session: SavedSession;
};

export type HistoryStore = {
  activeId: string | null;
  entries: HistoryEntry[];
};

const HISTORY_KEY = 'tdah-optimizer-history';
const LEGACY_SESSION_KEY = 'tdah-optimizer-session';
const MAX_ENTRIES = 30;

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
    return { activeId: entry.id, entries: [entry] };
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

function persist(store: HistoryStore): boolean {
  const trimmed: HistoryStore = {
    activeId: store.activeId,
    entries: trimEntries(store.entries),
  };

  try {
    getStorage().setItem(HISTORY_KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    if (trimmed.entries.length <= 1) return false;

    const reduced: HistoryStore = {
      activeId: trimmed.activeId,
      entries: trimmed.entries.slice(0, Math.max(1, Math.floor(trimmed.entries.length / 2))),
    };

    try {
      getStorage().setItem(HISTORY_KEY, JSON.stringify(reduced));
      return true;
    } catch {
      return false;
    }
  }
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

export function loadHistory(): HistoryStore {
  try {
    const raw = getStorage().getItem(HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HistoryStore;
      const entries = (parsed.entries || []).filter(isValidEntry).map(normalizeHistoryEntry);
      const activeId = resolveActiveId(parsed.activeId, entries);
      return { activeId, entries };
    }
  } catch {
    // fall through to migration
  }

  const migrated = migrateLegacySession();
  if (migrated) {
    persist(migrated);
    return migrated;
  }

  return { activeId: null, entries: [] };
}

export function saveHistory(store: HistoryStore): boolean {
  return persist(store);
}

export function clearAllHistory(): HistoryStore {
  const empty: HistoryStore = { activeId: null, entries: [] };
  try {
    getStorage().removeItem(HISTORY_KEY);
    getStorage().removeItem(LEGACY_SESSION_KEY);
  } catch {
    // ignore storage errors during dev wipe
  }
  return empty;
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
  const category = sanitizeUserCategory(data.category) ?? FALLBACK_MAP_CATEGORY;
  const tags = normalizeTags(data.tags);
  const status = deriveMapStatus(session, intent);

  return { category, tags, intent, status };
}

export function createEntry(
  store: HistoryStore,
  session: SavedSession,
  sourceType: SourceType,
  providedId?: string
): HistoryStore {
  const now = Date.now();
  const title = (session.data as { title?: string } | undefined)?.title || 'Mapa sin título';
  const metadata = metadataFromSession(session, sourceType);
  const entry: HistoryEntry = {
    id: providedId || generateId(),
    title,
    createdAt: now,
    updatedAt: now,
    sourceType,
    session,
    ...metadata,
  };

  return {
    activeId: entry.id,
    entries: [entry, ...store.entries],
  };
}

export function updateActiveSession(
  store: HistoryStore,
  session: SavedSession
): HistoryStore {
  if (!store.activeId) return store;

  const entries = store.entries.map((entry) => {
    if (entry.id !== store.activeId) return entry;

    const title = ((session.data as { title?: string } | undefined)?.title || entry.title) as string;
    const metadata = metadataFromSession(session, entry.sourceType);
    const progressChanged =
      entry.session.currentStep !== session.currentStep ||
      entry.session.isComplete !== session.isComplete ||
      entry.session.viewAll !== session.viewAll;
    const titleChanged = title !== entry.title;
    const metadataChanged =
      entry.category !== metadata.category ||
      entry.status !== metadata.status ||
      entry.intent !== metadata.intent ||
      JSON.stringify(entry.tags ?? []) !== JSON.stringify(metadata.tags ?? []);

    if (!progressChanged && !titleChanged && !metadataChanged) {
      if (entry.session.data === session.data) return entry;
      return { ...entry, title, session, ...metadata };
    }

    const now = Date.now();
    return {
      ...entry,
      title,
      updatedAt: now,
      session,
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

  return { activeId, entries };
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
