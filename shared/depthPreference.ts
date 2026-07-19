import { getStorage } from './storage';
import type { MapDepth } from './contracts';

export const DEPTH_OPTIONS = [
  { id: 'rapido' as const, label: 'Rápido', hint: 'Menos pasos, ideas esenciales' },
  { id: 'estandar' as const, label: 'Estándar', hint: 'Equilibrio entre cobertura y brevedad' },
  { id: 'profundo' as const, label: 'Profundo', hint: 'Máximo detalle por unidad' },
] as const;

export type DepthPreference = MapDepth;

const STORAGE_KEY = 'tdah-depth-preference';

export function getInitialDepthPreference(): DepthPreference {
  try {
    const stored = getStorage().getItem(STORAGE_KEY);
    if (stored && DEPTH_OPTIONS.some((option) => option.id === stored)) {
      return stored as DepthPreference;
    }
  } catch {
    // Storage not ready yet
  }
  return 'estandar';
}

export function saveDepthPreference(value: DepthPreference): void {
  getStorage().setItem(STORAGE_KEY, value);
}
