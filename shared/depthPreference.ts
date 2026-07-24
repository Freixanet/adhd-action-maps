import { getStorage } from './storage';
import type { MapDepth } from './contracts';

/** Composer depth choices — ids stay API-compatible (`estandar` = Inteligente). */
export const DEPTH_OPTIONS = [
  { id: 'rapido' as const, label: 'Rápido', hint: 'Versión corta' },
  { id: 'estandar' as const, label: 'Inteligente', hint: 'Mejor cobertura' },
] as const;

export type DepthPreference = MapDepth;

const STORAGE_KEY = 'tdah-depth-preference';
const SELECTABLE_DEPTH_IDS: ReadonlySet<string> = new Set(DEPTH_OPTIONS.map((o) => o.id));

export function getInitialDepthPreference(): DepthPreference {
  try {
    const stored = getStorage().getItem(STORAGE_KEY);
    if (stored && SELECTABLE_DEPTH_IDS.has(stored)) {
      return stored as DepthPreference;
    }
    // Legacy "profundo" is no longer offered — fall back to Inteligente.
    if (stored === 'profundo') return 'estandar';
  } catch {
    // Storage not ready yet
  }
  return 'estandar';
}

export function saveDepthPreference(value: DepthPreference): void {
  getStorage().setItem(STORAGE_KEY, value);
}
