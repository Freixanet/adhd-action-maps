import { getStorage } from '@shared/storage';
import type { HistoryStore } from './history';
import { clearAllHistory, saveHistory } from './history';

const HIDDEN_KEY = 'nucleo-dev-history-hidden';
const BACKUP_KEY = 'nucleo-dev-history-backup';

export function isDevHistoryHidden(): boolean {
  return getStorage().getItem(HIDDEN_KEY) === '1';
}

function stashDevHistoryBackup(store: HistoryStore): void {
  getStorage().setItem(BACKUP_KEY, JSON.stringify(store));
  getStorage().setItem(HIDDEN_KEY, '1');
}

export function loadDevHistoryBackup(): HistoryStore | null {
  try {
    const raw = getStorage().getItem(BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HistoryStore;
  } catch {
    return null;
  }
}

function clearDevHistoryBackup(): void {
  getStorage().removeItem(BACKUP_KEY);
  getStorage().removeItem(HIDDEN_KEY);
}

/** Oculta el historial en UI guardando una copia local recuperable. No toca la nube. */
export function hideHistoryForDev(store: HistoryStore): HistoryStore {
  stashDevHistoryBackup(store);
  clearAllHistory();
  return { activeId: null, entries: [], collections: [] };
}

/** Restaura el historial desde la copia de seguridad dev. */
export function restoreHistoryFromDev(): HistoryStore | null {
  const backup = loadDevHistoryBackup();
  if (!backup) {
    clearDevHistoryBackup();
    return null;
  }
  saveHistory(backup);
  clearDevHistoryBackup();
  return backup;
}
