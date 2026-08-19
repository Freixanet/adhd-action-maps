import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStorage, type DurableKeyValueStorage } from '@shared/storage';
import { createAsyncStorageDurableAdapter } from '@shared/durableKvAdapter';

const adapter = createAsyncStorageDurableAdapter(AsyncStorage);

/** Back-compat export — same adapter instance used by bootstrapStorage. */
export const localStorageShim = adapter as DurableKeyValueStorage & {
  init(): Promise<void>;
  length: number;
  key(index: number): string | null;
  clear(): void;
};

declare global {
  // eslint-disable-next-line no-var
  var localStorage: Storage;
}

export async function bootstrapStorage(): Promise<void> {
  try {
    const webStorage =
      typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function'
        ? window.localStorage
        : null;

    if (webStorage) {
      webStorage.getItem('nucleo-app-variant');
      const durableWeb: DurableKeyValueStorage = {
        getItem: (k) => webStorage.getItem(k),
        setItem: (k, v) => webStorage.setItem(k, v),
        removeItem: (k) => webStorage.removeItem(k),
        setItemDurable: async (k, v) => {
          webStorage.setItem(k, v);
        },
        removeItemDurable: async (k) => {
          webStorage.removeItem(k);
        },
      };
      configureStorage(durableWeb);
      if (!webStorage.getItem('nucleo-app-variant')) {
        webStorage.setItem('nucleo-app-variant', 'comprension');
      }
      return;
    }
  } catch (error) {
    console.warn('Browser localStorage unavailable; using in-memory shim.', error);
  }

  await adapter.init();
  configureStorage(adapter);
  try {
    globalThis.localStorage = adapter as unknown as Storage;
  } catch {
    // Some runtimes expose a read-only Window.localStorage getter.
  }

  if (!adapter.getItem('nucleo-app-variant')) {
    await adapter.setItemDurable('nucleo-app-variant', 'comprension');
  }
}
