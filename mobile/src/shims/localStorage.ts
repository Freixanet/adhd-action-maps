import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStorage } from '@shared/storage';

class LocalStorageShim {
  private cache: Record<string, string> = {};
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const keys = await AsyncStorage.getAllKeys();
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [key, value] of pairs) {
        if (value !== null) {
          this.cache[key] = value;
        }
      }
    } catch (error) {
      console.error('Error loading AsyncStorage into localStorage shim', error);
    }
    this.initialized = true;
  }

  getItem(key: string): string | null {
    return key in this.cache ? this.cache[key] : null;
  }

  setItem(key: string, value: string): void {
    const stringValue = String(value);
    this.cache[key] = stringValue;
    AsyncStorage.setItem(key, stringValue).catch((error) => {
      console.error(`Error saving key ${key} to AsyncStorage`, error);
    });
  }

  removeItem(key: string): void {
    delete this.cache[key];
    AsyncStorage.removeItem(key).catch((error) => {
      console.error(`Error removing key ${key} from AsyncStorage`, error);
    });
  }

  clear(): void {
    this.cache = {};
    AsyncStorage.clear().catch((error) => {
      console.error('Error clearing AsyncStorage', error);
    });
  }

  get length(): number {
    return Object.keys(this.cache).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.cache);
    return index >= 0 && index < keys.length ? keys[index] : null;
  }
}

export const localStorageShim = new LocalStorageShim();

declare global {
  // eslint-disable-next-line no-var
  var localStorage: Storage;
}

export async function bootstrapStorage(): Promise<void> {
  await localStorageShim.init();
  configureStorage(localStorageShim);
  globalThis.localStorage = localStorageShim as unknown as Storage;

  if (!localStorageShim.getItem('nucleo-app-variant')) {
    localStorageShim.setItem('nucleo-app-variant', 'comprension');
  }
}
