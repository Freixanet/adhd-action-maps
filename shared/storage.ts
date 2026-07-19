export interface SyncKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
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
