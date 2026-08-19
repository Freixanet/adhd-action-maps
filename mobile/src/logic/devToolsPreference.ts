import { getStorage } from '@shared/storage';

const STORAGE_KEY = 'nucleo.devToolsEnabled';

export function loadDevToolsEnabled(): boolean {
  try {
    return getStorage().getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveDevToolsEnabled(enabled: boolean): void {
  try {
    const storage = getStorage();
    if (enabled) {
      storage.setItem(STORAGE_KEY, '1');
    } else {
      storage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore persistence errors
  }
}
