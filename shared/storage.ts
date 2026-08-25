/**
 * Sync + optional durable KV storage.
 * React Native pending queues must use setItemDurable (awaits AsyncStorage).
 */

export interface SyncKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Extends sync storage with awaited durable writes. */
export interface DurableKeyValueStorage extends SyncKeyValueStorage {
  setItemDurable(key: string, value: string): Promise<void>;
  removeItemDurable(key: string): Promise<void>;
}

let storageOverride: SyncKeyValueStorage | null = null;

export function configureStorage(storage: SyncKeyValueStorage): void {
  storageOverride = storage;
}

export function getStorage(): SyncKeyValueStorage {
  if (storageOverride) return storageOverride;
  if (
    typeof globalThis !== 'undefined' &&
    'localStorage' in globalThis &&
    globalThis.localStorage
  ) {
    return globalThis.localStorage as SyncKeyValueStorage;
  }
  throw new Error('Storage not configured. Call configureStorage() or set globalThis.localStorage.');
}

export function getDurableStorage(): DurableKeyValueStorage | null {
  const storage = getStorage() as DurableKeyValueStorage;
  if (
    storage &&
    typeof storage.setItemDurable === 'function' &&
    typeof storage.removeItemDurable === 'function'
  ) {
    return storage;
  }
  return null;
}

export function isDurableKeyValueStorage(
  storage: SyncKeyValueStorage
): storage is DurableKeyValueStorage {
  const d = storage as DurableKeyValueStorage;
  return (
    typeof d.setItemDurable === 'function' && typeof d.removeItemDurable === 'function'
  );
}
