/**
 * Durable KV adapter over AsyncStorage-like backends (React Native shim).
 * Cache updates only after successful persistence. Per-key ops are serialized.
 */

export type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: readonly string[]): Promise<readonly [string, string | null][]>;
  clear(): Promise<void>;
};

export type DurableCacheAdapter = {
  init(): Promise<void>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  setItemDurable(key: string, value: string): Promise<void>;
  removeItemDurable(key: string): Promise<void>;
  clear(): void;
  readonly length: number;
  key(index: number): string | null;
  /** Test/debug: snapshot of in-memory cache. */
  peekCache(key: string): string | null | undefined;
};

export function createAsyncStorageDurableAdapter(
  asyncStorage: AsyncStorageLike,
  options?: { onPersistError?: (message: string, error: unknown) => void }
): DurableCacheAdapter {
  const cache: Record<string, string> = {};
  const keyChains = new Map<string, Promise<unknown>>();
  let initialized = false;
  const onError =
    options?.onPersistError ??
    ((message: string, error: unknown) => {
      console.error(message, error);
    });

  function enqueue<T>(key: string, op: () => Promise<T>): Promise<T> {
    const prev = keyChains.get(key) ?? Promise.resolve();
    const next = prev.then(op, op);
    keyChains.set(
      key,
      next.then(
        () => undefined,
        () => undefined
      )
    );
    return next;
  }

  return {
    async init(): Promise<void> {
      if (initialized) return;
      try {
        const keys = await asyncStorage.getAllKeys();
        const pairs = await asyncStorage.multiGet(keys);
        for (const [key, value] of pairs) {
          if (value !== null) cache[key] = value;
        }
      } catch (error) {
        onError('Error loading AsyncStorage into durable adapter', error);
      }
      initialized = true;
    },

    getItem(key: string): string | null {
      return key in cache ? cache[key]! : null;
    },

    peekCache(key: string): string | null | undefined {
      return key in cache ? cache[key]! : undefined;
    },

    setItem(key: string, value: string): void {
      const stringValue = String(value);
      cache[key] = stringValue;
      void asyncStorage.setItem(key, stringValue).catch((error) => {
        onError(`Error saving key ${key} to AsyncStorage`, error);
      });
    },

    async setItemDurable(key: string, value: string): Promise<void> {
      const stringValue = String(value);
      await enqueue(key, async () => {
        // Persist first — only then update cache (rollback-safe on failure).
        await asyncStorage.setItem(key, stringValue);
        cache[key] = stringValue;
      });
    },

    removeItem(key: string): void {
      delete cache[key];
      void asyncStorage.removeItem(key).catch((error) => {
        onError(`Error removing key ${key} from AsyncStorage`, error);
      });
    },

    async removeItemDurable(key: string): Promise<void> {
      await enqueue(key, async () => {
        // Persist removal first — only then drop the cache entry.
        await asyncStorage.removeItem(key);
        delete cache[key];
      });
    },

    clear(): void {
      for (const k of Object.keys(cache)) delete cache[k];
      void asyncStorage.clear().catch((error) => {
        onError('Error clearing AsyncStorage', error);
      });
    },

    get length(): number {
      return Object.keys(cache).length;
    },

    key(index: number): string | null {
      const keys = Object.keys(cache);
      return index >= 0 && index < keys.length ? keys[index]! : null;
    },
  };
}
