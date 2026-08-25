/**
 * Tests the same durable adapter used by mobile AsyncStorage shim.
 */

import { describe, expect, it } from 'vitest';
import {
  createAsyncStorageDurableAdapter,
  type AsyncStorageLike,
} from './durableKvAdapter';

function createMemoryAsyncStorage(options?: {
  failSet?: boolean;
  failRemove?: boolean;
}): AsyncStorageLike & {
  store: Map<string, string>;
  setCalls: number;
  removeCalls: number;
} {
  const store = new Map<string, string>();
  let setCalls = 0;
  let removeCalls = 0;
  return {
    store,
    get setCalls() {
      return setCalls;
    },
    get removeCalls() {
      return removeCalls;
    },
    async getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    async setItem(key, value) {
      setCalls += 1;
      if (options?.failSet) throw new Error('async_storage_set_failed');
      store.set(key, value);
    },
    async removeItem(key) {
      removeCalls += 1;
      if (options?.failRemove) throw new Error('async_storage_remove_failed');
      store.delete(key);
    },
    async getAllKeys() {
      return [...store.keys()];
    },
    async multiGet(keys) {
      return keys.map((k) => [k, store.has(k) ? store.get(k)! : null]);
    },
    async clear() {
      store.clear();
    },
  };
}

describe('createAsyncStorageDurableAdapter (mobile path)', () => {
  it('setItemDurable failure leaves cache and backend unchanged', async () => {
    const backend = createMemoryAsyncStorage();
    const adapter = createAsyncStorageDurableAdapter(backend);
    await adapter.setItemDurable('k', 'v1');
    expect(adapter.getItem('k')).toBe('v1');
    expect(backend.store.get('k')).toBe('v1');

    const failing = createMemoryAsyncStorage({ failSet: true });
    // Seed failing backend+cache via adapter that shares... use fresh adapter with seeded store
    failing.store.set('k', 'v1');
    const adapter2 = createAsyncStorageDurableAdapter(failing);
    await adapter2.init();
    // init loads from backend
    expect(adapter2.getItem('k')).toBe('v1');

    await expect(adapter2.setItemDurable('k', 'v2')).rejects.toThrow(/set_failed/);
    expect(adapter2.getItem('k')).toBe('v1');
    expect(failing.store.get('k')).toBe('v1');
  });

  it('removeItemDurable failure leaves cache and backend unchanged', async () => {
    const backend = createMemoryAsyncStorage({ failRemove: true });
    backend.store.set('k', 'keep');
    const adapter = createAsyncStorageDurableAdapter(backend);
    await adapter.init();
    expect(adapter.getItem('k')).toBe('keep');

    await expect(adapter.removeItemDurable('k')).rejects.toThrow(/remove_failed/);
    expect(adapter.getItem('k')).toBe('keep');
    expect(backend.store.get('k')).toBe('keep');
  });

  it('does not point cache at a value that never persisted', async () => {
    const backend = createMemoryAsyncStorage({ failSet: true });
    const adapter = createAsyncStorageDurableAdapter(backend);
    await expect(adapter.setItemDurable('pending', '{"file":"/tmp/x.pdf"}')).rejects.toThrow();
    expect(adapter.peekCache('pending')).toBeUndefined();
    expect(backend.store.has('pending')).toBe(false);
  });

  it('serializes concurrent writes so the last commit wins', async () => {
    const store = new Map<string, string>();
    let gate: Promise<void> | null = null;
    let releaseGate: (() => void) | null = null;
    const backend: AsyncStorageLike = {
      async getItem(key) {
        return store.has(key) ? store.get(key)! : null;
      },
      async setItem(key, value) {
        if (gate) await gate;
        store.set(key, value);
      },
      async removeItem(key) {
        store.delete(key);
      },
      async getAllKeys() {
        return [...store.keys()];
      },
      async multiGet(keys) {
        return keys.map((k) => [k, store.has(k) ? store.get(k)! : null] as [string, string | null]);
      },
      async clear() {
        store.clear();
      },
    };

    const adapter = createAsyncStorageDurableAdapter(backend);
    gate = new Promise<void>((r) => {
      releaseGate = r;
    });

    const first = adapter.setItemDurable('k', 'slow');
    // Start second while first is blocked in setItem
    await Promise.resolve();
    const second = adapter.setItemDurable('k', 'fast');

    releaseGate!();
    await Promise.all([first, second]);

    expect(adapter.getItem('k')).toBe('fast');
    expect(store.get('k')).toBe('fast');
  });

  it('successful durable write updates cache only after backend commit', async () => {
    const order: string[] = [];
    const store = new Map<string, string>();
    const backend: AsyncStorageLike = {
      async getItem(key) {
        return store.has(key) ? store.get(key)! : null;
      },
      async setItem(key, value) {
        order.push('backend');
        store.set(key, value);
      },
      async removeItem(key) {
        store.delete(key);
      },
      async getAllKeys() {
        return [...store.keys()];
      },
      async multiGet(keys) {
        return keys.map((k) => [k, store.has(k) ? store.get(k)! : null]);
      },
      async clear() {
        store.clear();
      },
    };
    const adapter = createAsyncStorageDurableAdapter(backend);
    const p = adapter.setItemDurable('k', 'v');
    // Before await settles, cache must still be empty
    expect(adapter.peekCache('k')).toBeUndefined();
    await p;
    order.push('cache-visible');
    expect(adapter.getItem('k')).toBe('v');
    expect(order[0]).toBe('backend');
  });
});
